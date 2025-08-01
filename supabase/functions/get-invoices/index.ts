import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { clinic_id } = await req.json();

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinic")
      .select("stripe_customer_id")
      .eq("id", clinic_id)
      .maybeSingle();

    if (clinicError || !clinic?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "Clinic not found or missing customer ID" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const invoices = await stripe.invoices.list({
      customer: clinic.stripe_customer_id,
      limit: 20,
    });

    const filtered = invoices.data.map(inv => ({
      id: inv.id,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
    }));

    return new Response(JSON.stringify({ invoices: filtered }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
