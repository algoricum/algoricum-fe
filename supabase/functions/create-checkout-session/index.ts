import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import Stripe from "npm:stripe";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-04-10",
});
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: corsHeaders,
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }
  try {
    const { clinic_id, price_id, success_url: customSuccessUrl } = await req.json();
    if (!clinic_id || !price_id) {
      return new Response("Missing clinic_id or price_id", {
        status: 400,
        headers: corsHeaders,
      });
    }
    const { data: clinic, error: clinicError } = await supabase
      .from("clinic")
      .select("id, stripe_customer_id, name, email,owner_id")
      .eq("id", clinic_id)
      .single();
    if (clinicError || !clinic) {
      return new Response("Clinic not found", {
        status: 404,
        headers: corsHeaders,
      });
    }
    const { data: user, error: userError } = await supabase.from("user").select("id, email").eq("id", clinic.owner_id).single();
    if (userError || !user) {
      return new Response("User not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Fetch plan details based on price_id
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, amount, interval, features, trial_days")
      .eq("price_id", price_id)
      .eq("active", true)
      .single();

    if (planError || !plan) {
      return new Response("Plan not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Determine plan type based on amount (0 = free, >0 = paid)
    const plan_type = plan.amount === 0 ? "free" : "paid";
    const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";
    let stripeCustomerId = clinic.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: clinic.name || "Unknown Client",
        email: clinic.email || user.email || undefined,
        metadata: {
          clinic_id,
        },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("clinic")
        .update({
          stripe_customer_id: stripeCustomerId,
        })
        .eq("id", clinic_id);
    }
    const { data: existingSub } = await supabase
      .from("stripe_subscriptions")
      .select("status")
      .eq("clinic_id", clinic_id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .single();

    if (existingSub && existingSub.status === "active") {
      // Redirect to billing portal for active subscriptions
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${APP_URL}/dashboard`,
      });
      return new Response(
        JSON.stringify({
          url: portalSession.url,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Create checkout session based on plan type
    let sessionConfig;

    if (plan_type === "free") {
      // Free plan: only prefilled email checkbox, no payment required
      sessionConfig = {
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [
          {
            price: price_id,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            clinic_id,
            plan_type: "free",
            plan_id: plan.id,
            plan_name: plan.name,
          },
        },
        payment_method_collection: "if_required",
        customer_update: {
          address: "never",
          name: "never",
          shipping: "never",
        },
        success_url: customSuccessUrl || `${APP_URL}/billing`,
        cancel_url: `${APP_URL}/billing`,
      };
    } else {
      // Paid plan: require card info collection
      sessionConfig = {
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [
          {
            price: price_id,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            clinic_id,
            plan_type: "paid",
            plan_id: plan.id,
            plan_name: plan.name,
          },
        },
        payment_method_collection: "always",
        success_url: customSuccessUrl || `${APP_URL}/billing`,
        cancel_url: `${APP_URL}/billing`,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("Checkout session error:", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
