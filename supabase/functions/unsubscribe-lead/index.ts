import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Handle GET requests for unsubscribe links and POST requests for clinic unsubscribe
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle /unsubscribe-daily-remainder route
    if (pathname.includes("unsubscribe-daily-remainder")) {
      let clinic_id;

      let user_id: string | undefined;

      if (req.method === "POST") {
        const body = await req.json();
        clinic_id = body.clinic_id;
        user_id = body.user_id;

        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (req.method === "GET") {
        clinic_id = url.searchParams.get("clinic_id");
      }

      // Additional validation for undefined or invalid clinic_id
      if (!clinic_id || clinic_id === "undefined" || clinic_id === "null") {
        if (req.method === "GET") {
          const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
          redirectUrl.searchParams.set("message", "Invalid unsubscribe link - missing clinic ID.");
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: redirectUrl.toString() },
          });
        }
        return new Response(JSON.stringify({ error: "clinic_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update is_subscribed — POST scoped to specific user, GET applies to all clinic users
      let query = supabaseClient
        .from("user_clinic")
        .update({
          is_subscribed: false,
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinic_id);

      if (user_id) {
        query = query.eq("user_id", user_id);
      }

      const { error: updateError } = await query;

      if (updateError) {
        console.error("Daily reminder unsubscribe error:", updateError);
        if (req.method === "GET") {
          const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
          redirectUrl.searchParams.set("message", "There was an error processing your unsubscribe request. Please try again.");
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: redirectUrl.toString() },
          });
        }
        return new Response(JSON.stringify({ error: "Failed to unsubscribe clinic users from daily reminders" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
        redirectUrl.searchParams.set("message", "You have been successfully unsubscribed from daily reminders.");
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: redirectUrl.toString() },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "All users in clinic have been unsubscribed from daily reminders successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle POST request for clinic-wide unsubscribe (requires service role key)
    if (req.method === "POST") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { clinic_id } = await req.json();

      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "clinic_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update is_subscribed to false for all users in the clinic
      const { error: updateError } = await supabaseClient
        .from("user_clinic")
        .update({
          is_subscribed: false,
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinic_id);

      if (updateError) {
        console.error("Clinic unsubscribe error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to unsubscribe clinic users" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "All users in clinic have been unsubscribed successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle GET request for individual lead unsubscribe
    const leadId = url.searchParams.get("lead_id");

    if (!leadId) {
      const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
      redirectUrl.searchParams.set("message", "Invalid unsubscribe link - missing lead ID.");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl.toString() },
      });
    }

    // Get lead info including email
    const { data: lead, error: fetchError } = await supabaseClient.from("lead").select("status, email").eq("id", leadId).single();

    if (fetchError || !lead) {
      const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
      redirectUrl.searchParams.set("message", "Lead not found. You may have already been unsubscribed.");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl.toString() },
      });
    }

    // Check if already unsubscribed
    if (lead.status === "Cold") {
      const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
      redirectUrl.searchParams.set("message", "Already unsubscribed from emails.");
      redirectUrl.searchParams.set("email", lead.email || "");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl.toString() },
      });
    }

    // Mark lead as cold
    const { error: updateError } = await supabaseClient
      .from("lead")
      .update({
        status: "Cold",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("Update error:", updateError);
      const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
      redirectUrl.searchParams.set("message", "There was an error processing your request. Please try again.");
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl.toString() },
      });
    }

    // Redirect to frontend with success message
    const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
    redirectUrl.searchParams.set("message", "You have been successfully unsubscribed from our mailing list.");
    redirectUrl.searchParams.set("email", lead.email || "");
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl.toString() },
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    const redirectUrl = new URL(`${Deno.env.get("FRONTEND_URL")}/unsubscribe-lead`);
    redirectUrl.searchParams.set("message", "There was an error processing your unsubscribe request. Please contact us directly.");
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl.toString() },
    });
  }
});
