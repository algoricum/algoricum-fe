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
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { clinic_id, price_id } = await req.json();

    if (!clinic_id || !price_id) {
      return new Response("Missing clinic_id or price_id", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinic")
      .select("id, stripe_customer_id, name, email")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response("Clinic not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";

    let stripeCustomerId = clinic.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: clinic.name || "Unknown Client",
        email: clinic.email || undefined,
        metadata: { clinic_id },
      });

      stripeCustomerId = customer.id;

      await supabase
        .from("clinic")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", clinic_id);
    }

    const { data: existingSub } = await supabase
      .from("stripe_subscriptions")
      .select("status, trial_end")
      .eq("clinic_id", clinic_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const now = new Date();

    if (existingSub) {
      const isActive = existingSub.status === "active";
      const isTrialing =
        existingSub.status === "trialing" &&
        existingSub.trial_end &&
        new Date(existingSub.trial_end) > now;

      if (isActive || isTrialing) {
        // Redirect to billing portal
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${APP_URL}/dashboard`,
        });

        return new Response(JSON.stringify({ url: portalSession.url }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      if (existingSub.status === "paused") {
        // Create checkout session without trial
        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: [
            {
              price: price_id,
              quantity: 1,
            },
          ],
          subscription_data: {
            metadata: { clinic_id },
          },
          success_url: `${APP_URL}/billing`,
          cancel_url: `${APP_URL}/biling`,
        });

        return new Response(JSON.stringify({ url: session.url }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    }

    // No existing subscription — allow trial
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { clinic_id },
        trial_period_days: 14,
      },
      success_url: `${APP_URL}/billing`,
      cancel_url: `${APP_URL}/billing`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Checkout session error:", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
