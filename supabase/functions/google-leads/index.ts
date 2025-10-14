import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  fetchAccountsAndLeadForms,
  fetchAvailableLeadForms,
  handleOAuthCallback,
  insertLead,
  saveSelectedLeadForms,
  setGoogleCustomerId,
  startAuth,
  syncLeadsFromForms,
} from "../_shared/google-leads-service.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
serve(async req => {
  console.log(`[GOOGLE_LEADS] Incoming request: ${req.method} ${req.url}`);
  console.log(`[GOOGLE_LEADS] Request headers:`, Object.fromEntries(req.headers.entries()));

  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    console.log(`[GOOGLE_LEADS] Handling CORS preflight request`);
    return optionsResponse;
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;
    console.log(`[GOOGLE_LEADS] Processing route: ${method} ${pathname}`);

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 0️⃣ OAuth Start (GET /auth/start)
    if (pathname.includes("/auth/start") && method === "GET") {
      console.log(`[GOOGLE_LEADS] Route matched: auth/start`);

      const clinicId = url.searchParams.get("clinic_id");
      const redirectTo = url.searchParams.get("redirect_to");

      console.log(`[GOOGLE_LEADS] OAuth start request:`, { clinicId, redirectTo });

      if (!clinicId) {
        console.error(`[GOOGLE_LEADS] Missing clinic_id parameter`);
        return new Response("Missing clinic_id parameter", {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Starting OAuth for clinic: ${clinicId}`);
        const authUrl = await startAuth(clinicId, redirectTo, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Redirecting to OAuth URL: ${authUrl}`);

        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders(), Location: authUrl },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error starting OAuth:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to start OAuth",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 0️⃣ Start OAuth (Legacy POST endpoint)
    if (pathname.includes("/start-auth") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: start-auth`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Request body:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders() },
        });
      }

      const { clinic_id, redirectTo } = requestBody;
      console.log(`[GOOGLE_LEADS] Starting OAuth for clinic: ${clinic_id}, redirect: ${redirectTo}`);

      const result = await startAuth(clinic_id, redirectTo);
      console.log(`[GOOGLE_LEADS] OAuth start result:`, result);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders() } });
    }

    // 1️⃣ OAuth Callback
    if (pathname.includes("/oauth/callback") && method === "GET") {
      console.log(`[GOOGLE_LEADS] Route matched: oauth/callback`);

      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state") || "";
      const error = url.searchParams.get("error");

      console.log(`[GOOGLE_LEADS] OAuth callback parameters:`, {
        hasCode: !!code,
        state: stateRaw,
        error: error,
      });

      if (error) {
        console.error(`[GOOGLE_LEADS] OAuth error received:`, error);
        return new Response(JSON.stringify({ error: `OAuth error: ${error}` }), {
          status: 400,
          headers: { ...corsHeaders() },
        });
      }

      if (!code) {
        console.error(`[GOOGLE_LEADS] No authorization code provided`);
        return new Response(JSON.stringify({ error: "No authorization code provided" }), {
          status: 400,
          headers: { ...corsHeaders() },
        });
      }

      // parse state -> clinic_id|redirect_to
      console.log(`[GOOGLE_LEADS] Parsing state parameter: ${stateRaw}`);
      const decodedState = decodeURIComponent(stateRaw);
      const [clinic_id, redirectToEncoded] = decodedState.split("|");
      const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;

      console.log(`[GOOGLE_LEADS] Parsed state:`, {
        clinic_id,
        redirectTo,
        decodedState,
      });

      console.log(`[GOOGLE_LEADS] Handling OAuth callback...`);
      const tokens = await handleOAuthCallback(code, clinic_id, redirectTo);
      console.log(`[GOOGLE_LEADS] OAuth callback completed, redirect URL: ${tokens}`);

      const redirectURL = new URL(tokens);
      redirectURL.searchParams.set("google_lead_form_status", "success");

      console.log(`[GOOGLE_LEADS] Final redirect URL: ${redirectURL.toString()}`);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectURL.toString(),
        },
      });
    }

    // 2️⃣ Webhook Handler
    if (pathname.includes("/webhook") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: webhook`);

      const clinic_id = url.searchParams.get("clinic_id");
      console.log(`[GOOGLE_LEADS] Webhook clinic_id: ${clinic_id}`);

      if (!clinic_id) {
        console.error(`[GOOGLE_LEADS] Missing clinic_id parameter`);
        return new Response("Missing clinic_id", { status: 400, headers: { ...corsHeaders() } });
      }

      let webhookBody;
      try {
        webhookBody = await req.json();
        console.log(`[GOOGLE_LEADS] Webhook body received:`, JSON.stringify(webhookBody, null, 2));
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse webhook body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in webhook body" }), {
          status: 400,
          headers: { ...corsHeaders() },
        });
      }

      console.log(`[GOOGLE_LEADS] Processing lead insertion...`);
      const redirectUrl = await insertLead(clinic_id, webhookBody);
      console.log(`[GOOGLE_LEADS] Lead insertion completed, redirect URL: ${redirectUrl}`);

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders(), Location: redirectUrl },
      });
    }

    // 2️⃣.5 Fetch Accounts and Lead Forms
    if (pathname.includes("/fetch-accounts-and-forms") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: fetch-accounts-and-forms`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Fetch accounts request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { connection_id } = requestBody;

      if (!connection_id) {
        console.error(`[GOOGLE_LEADS] Missing connection_id parameter`);
        return new Response(JSON.stringify({ error: "connection_id is required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Fetching accounts and forms for connection: ${connection_id}`);
        const result = await fetchAccountsAndLeadForms(connection_id, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Successfully fetched accounts and forms`);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error fetching accounts and forms:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch accounts and forms",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2️⃣.5 Set Google Customer ID (Legacy)
    if (pathname.includes("/set-customer-id") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: set-customer-id`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Set customer ID request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { connection_id, google_customer_id } = requestBody;

      if (!connection_id || !google_customer_id) {
        console.error(`[GOOGLE_LEADS] Missing required parameters`);
        return new Response(JSON.stringify({ error: "connection_id and google_customer_id are required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Setting customer ID ${google_customer_id} for connection: ${connection_id}`);
        const result = await setGoogleCustomerId(connection_id, google_customer_id, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Successfully set customer ID`);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error setting customer ID:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to set customer ID",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2️⃣.6 Select Customer from Multiple Options
    if (pathname.includes("/select-customer") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: select-customer`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Select customer request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { connection_id, selected_customer_id } = requestBody;

      if (!connection_id || !selected_customer_id) {
        console.error(`[GOOGLE_LEADS] Missing required parameters`);
        return new Response(JSON.stringify({ error: "connection_id and selected_customer_id are required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Selecting customer ${selected_customer_id} for connection: ${connection_id}`);
        const result = await setGoogleCustomerId(connection_id, selected_customer_id, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Successfully selected customer`);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error selecting customer:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to select customer",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 3️⃣ Fetch Available Lead Forms
    if (pathname.includes("/fetch-lead-forms") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: fetch-lead-forms`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Fetch forms request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { connection_id } = requestBody;

      if (!connection_id) {
        console.error(`[GOOGLE_LEADS] Missing connection_id parameter`);
        return new Response(JSON.stringify({ error: "connection_id is required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Fetching lead forms for connection: ${connection_id}`);
        const result = await fetchAvailableLeadForms(connection_id, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Successfully fetched ${result.lead_forms.length} lead forms`);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error fetching lead forms:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch lead forms",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 4️⃣ Save Selected Lead Forms
    if (pathname.includes("/save-selected-forms") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: save-selected-forms`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Save forms request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { connection_id, selected_forms } = requestBody;

      if (!connection_id) {
        console.error(`[GOOGLE_LEADS] Missing connection_id parameter`);
        return new Response(JSON.stringify({ error: "connection_id is required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      if (!selected_forms || !Array.isArray(selected_forms)) {
        console.error(`[GOOGLE_LEADS] Missing or invalid selected_forms parameter`);
        return new Response(JSON.stringify({ error: "selected_forms array is required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Saving ${selected_forms.length} selected forms for connection: ${connection_id}`);
        const result = await saveSelectedLeadForms(connection_id, selected_forms, supabaseAdmin);
        console.log(`[GOOGLE_LEADS] Successfully saved lead form selections`);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error saving selected forms:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to save selected forms",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    // 5️⃣ Sync Leads from Selected Forms
    if (pathname.includes("/sync") && method === "POST") {
      console.log(`[GOOGLE_LEADS] Route matched: sync`);

      let requestBody;
      try {
        requestBody = await req.json();
        console.log(`[GOOGLE_LEADS] Sync request:`, requestBody);
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Failed to parse request body:`, error);
        return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      const { clinic_id } = requestBody;

      if (!clinic_id) {
        console.error(`[GOOGLE_LEADS] Missing clinic_id parameter`);
        return new Response(JSON.stringify({ error: "clinic_id is required" }), {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }

      try {
        console.log(`[GOOGLE_LEADS] Starting sync for clinic: ${clinic_id}`);

        // Get the connection for this clinic
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("integration_connections")
          .select("*")
          .eq("clinic_id", clinic_id)
          .eq("integration_id", (await supabaseAdmin.from("integrations").select("id").eq("name", "Google Lead Forms").single()).data?.id)
          .single();

        if (connectionError || !connection) {
          console.error(`[GOOGLE_LEADS] Connection not found:`, connectionError);
          return new Response(JSON.stringify({ error: "Google Lead Forms integration not found for this clinic" }), {
            status: 404,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          });
        }

        console.log(`[GOOGLE_LEADS] Found connection:`, connection.id);

        // Check if we have selected forms and customer ID
        const authData = connection.auth_data;
        if (!authData?.google_customer_id) {
          return new Response(JSON.stringify({ error: "No Google Customer ID configured" }), {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          });
        }

        if (!authData?.selected_forms || authData.selected_forms.length === 0) {
          return new Response(JSON.stringify({ error: "No forms selected for sync" }), {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          });
        }

        console.log(`[GOOGLE_LEADS] Syncing ${authData.selected_forms.length} forms for customer ${authData.google_customer_id}`);

        // Call the actual sync function to fetch leads from Google Ads API
        const result = await syncLeadsFromForms(connection.id, supabaseAdmin);

        console.log(`[GOOGLE_LEADS] Sync completed:`, result);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`[GOOGLE_LEADS] Error during sync:`, error);
        return new Response(
          JSON.stringify({
            error: "Failed to sync leads",
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
    }

    console.log(`[GOOGLE_LEADS] No route matched for: ${method} ${pathname}`);
    return new Response("Not found", { status: 404, headers: { ...corsHeaders() } });
  } catch (err) {
    console.error(`[GOOGLE_LEADS] Unhandled error:`, err);
    console.error(`[GOOGLE_LEADS] Error stack:`, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders() } });
  }
});
