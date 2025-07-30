import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractStripeSubscriptionId(type: string, object: any): string | null {
  if (type.startsWith("customer.subscription.")) return object.id ?? null;
  if (type.startsWith("invoice.")) {
    if (object.subscription) return object.subscription;
    if (object.parent?.subscription_details?.subscription) return object.parent.subscription_details.subscription;
    for (const line of object.lines?.data || []) {
      const subId = line?.parent?.subscription_item_details?.subscription;
      if (subId) return subId;
    }
  }
  return null;
}

function formatInvoiceAmount(payload: any): { amount: string; isCredit: boolean } {
  if (!Array.isArray(payload.lines?.data)) return { amount: "unknown amount", isCredit: false };

  const totalCents = payload.lines.data.reduce((sum: number, line: any) => {
    return sum + (line.amount || 0);
  }, 0);

  const currency = payload.currency?.toUpperCase() || "USD";
  const formattedAmount = `$${(Math.abs(totalCents) / 100).toFixed(2)} ${currency}`;
  const isCredit = totalCents < 0;

  return { amount: formattedAmount, isCredit };
}

async function formatEventSummary(event: Stripe.Event, supabase: any): Promise<string> {
  const { type, data } = event;
  const payload = data?.object;

  const { amount, isCredit } = formatInvoiceAmount(payload);

  let planName: string | null = null;
  let priceAmount: string | null = null;

  const price_id = payload?.items?.data?.[0]?.price?.id ?? null;

  if (price_id) {
    const { data: planRecord } = await supabase
      .from("plans")
      .select("name, amount, interval, currency")
      .eq("price_id", price_id)
      .maybeSingle();

    if (planRecord) {
      planName = planRecord.name;
      const interval = planRecord.interval;
      priceAmount = `$${Number(planRecord.amount).toFixed(2)} ${planRecord.currency?.toUpperCase() ?? "USD"} / ${interval}`;
    }
  }

  switch (type) {
    case "customer.subscription.created":
      return planName ? `Subscription started: ${planName} (${priceAmount})` : `Subscription started`;

    case "customer.subscription.updated":
      return planName ? `Subscription updated to ${planName} (${priceAmount})` : `Subscription updated`;

    case "customer.subscription.deleted":
      return `Subscription cancelled`;

    case "customer.subscription.trial_will_end":
      return payload.trial_end ? `Trial ends on ${new Date(payload.trial_end * 1000).toLocaleDateString()}` : "Trial ending soon";

    case "invoice.paid":
      return isCredit ? `Invoice paid (credit): -${amount}` : `Invoice paid: ${amount}`;

    case "invoice.payment_failed":
      return `Payment failed: ${amount}`;

    case "invoice.finalized":
      return `Invoice finalized: ${amount}`;

    case "invoice.upcoming":
      const next = payload.next_payment_attempt ? new Date(payload.next_payment_attempt * 1000).toLocaleDateString() : "soon";
      return `Upcoming invoice: ${amount} on ${next}`;

    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("OK", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Missing Stripe Signature or Secret", { status: 400, headers: corsHeaders });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const { type, data } = event;
  const object = data.object as any;

  const stripe_subscription_id = extractStripeSubscriptionId(type, object);
  let clinic_id = object.metadata?.clinic_id ?? null;

  if (!clinic_id && object.customer) {
    const customer = await stripe.customers.retrieve(object.customer as string);
    clinic_id = (customer as Stripe.Customer).metadata?.clinic_id ?? null;
  }

  // --- Handle subscription changes first ---
  if (type.startsWith("customer.subscription.")) {
    if (!clinic_id) {
      console.warn("No clinic_id in metadata");
      return new Response("No clinic_id", { status: 200, headers: corsHeaders });
    }

    const status = object.status;
    const trial_end = object.trial_end ? new Date(object.trial_end * 1000).toISOString() : null;
    const current_period_end = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null;
    const price_id = object.items?.data?.[0]?.price?.id ?? null;

    if (type === "customer.subscription.deleted") {
      await supabase
        .from("stripe_subscriptions")
        .update({ status: "paused" })
        .eq("clinic_id", clinic_id);
    } else {
      await supabase.from("stripe_subscriptions").upsert(
        {
          stripe_subscription_id,
          clinic_id,
          stripe_price_id: price_id,
          status,
          trial_end,
          current_period_end,
        },
        { onConflict: "clinic_id" }
      );
    }
  }

  // --- Fetch internal subscription ID AFTER upserting ---
  let internal_subscription_id: number | null = null;
  if (clinic_id) {
    const { data: subRecord } = await supabase
      .from("stripe_subscriptions")
      .select("id")
      .eq("clinic_id", clinic_id)
      .maybeSingle();
    internal_subscription_id = subRecord?.id ?? null;
  }

  // --- Format and log event ---
  const summary = await formatEventSummary(event, supabase);

  await supabase.from("stripe_events").insert({
    event_id: event.id,
    type,
    payload: data,
    stripe_subscription_id,
    subscription_id: internal_subscription_id,
    summary,
  });

  return new Response("Webhook processed", {
    status: 200,
    headers: corsHeaders,
  });
});
