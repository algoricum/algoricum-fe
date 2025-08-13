// supabase/functions/google-leads/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const googleRedirectUri = Deno.env.get("GOOGLE_LEAD_REDIRECT_URI")!;
const googleAdsDeveloperToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
const webhookSecret = Deno.env.get("GOOGLE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // 0️⃣ Start OAuth Flow
    if (url.pathname.includes("/start-auth") && req.method === "POST") {
      const { clinic_id } = await req.json();

      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "Missing clinic_id" }), { status: 400, headers: corsHeaders });
      }

      const scopes = ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/userinfo.email"].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: googleRedirectUri,
        response_type: "code",
        scope: scopes,
        access_type: "offline",
        state: clinic_id,
        prompt: "consent",
      }).toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), { headers: corsHeaders });
    }

    // 1️⃣ OAuth callback handler
    if (url.pathname.includes("/oauth/callback") && req.method === "GET") {
      const code = url.searchParams.get("code");
      const clinic_id = url.searchParams.get("state");

      if (!code || !clinic_id) {
        return new Response(JSON.stringify({ error: "Missing code or clinic_id" }), { status: 400, headers: corsHeaders });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (tokens.error) throw new Error(tokens.error_description);

      let access_token = tokens.access_token as string;
      const refresh_token = tokens.refresh_token || null;
      let token_expiry = new Date(Date.now() + tokens.expires_in * 1000);

      // Get Google Ads customerId
      const custRes = await fetch("https://googleads.googleapis.com/v19/customers:listAccessibleCustomers", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": googleAdsDeveloperToken,
          "Content-Type": "application/json",
        },
      });

      if (!custRes.ok) {
        const errorText = await custRes.text();
        throw new Error(`Google Ads API error: ${custRes.status} ${errorText}`);
      }

      const customerData = await custRes.json();
      if (!customerData.resourceNames || customerData.resourceNames.length === 0) {
        throw new Error("No accessible Google Ads customers found");
      }
      const customerId = customerData.resourceNames[0].split("/")[1];

      // Retrieve lead form asset (not submission data)
      const formRes = await fetch(`https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": googleAdsDeveloperToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            SELECT asset.resource_name
            FROM asset
            LIMIT 1
          `,
        }),
      });

      if (!formRes.ok) {
        const errorText = await formRes.text();
        throw new Error(`Google Ads API error (fetching lead form asset): ${formRes.status} ${errorText}`);
      }

      const formData = await formRes.json();
      console.log("Lead form asset response:", JSON.stringify(formData, null, 2));

      if (!formData.results || formData.results.length === 0) {
        // No lead form assets found; store connection with pending status
        await supabase.from("google_lead_form_connections").upsert({
          clinic_id,
          google_customer_id: customerId,
          lead_form_id: null,
          campaign_id: null,
          access_token,
          refresh_token,
          token_expiry,
          webhook_url: null,
          last_sync_at: null,
          sync_status: "pending",
          developer_token: googleAdsDeveloperToken,
        });
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
        redirectUrl.searchParams.set("google_lead_form_status", "success");
        return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl.toString(),
      },
    });
      }

      const leadFormAsset = formData.results[0]?.asset?.resource_name;
      if (!leadFormAsset) {
        throw new Error("No valid lead form asset found in response");
      }

      // Register webhook using lead_form_asset resource
      const webhookUrl = `${supabaseUrl}/functions/v1/google-leads/webhook?clinic_id=${clinic_id}`;
      const webhookRes = await fetch(`https://googleads.googleapis.com/v19/${leadFormAsset}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": googleAdsDeveloperToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          update: {
            webhook: {
              advertiserWebhookUrl: webhookUrl,
              advertiserWebhookLeadKey: webhookSecret,
            },
          },
          updateMask: "webhook.advertiserWebhookUrl,webhook.advertiserWebhookLeadKey",
        }),
      });

      if (!webhookRes.ok) {
        const errorText = await webhookRes.text();
        throw new Error(`Failed to register webhook: ${webhookRes.status} ${errorText}`);
      }

      // Save connection info to DB
      await supabase.from("google_lead_form_connections").upsert({
        clinic_id,
        google_customer_id: customerId,
        lead_form_id: leadFormAsset,
        campaign_id: null,
        access_token,
        refresh_token,
        token_expiry,
        webhook_url: webhookUrl,
        last_sync_at: null,
        sync_status: "active",
        developer_token: googleAdsDeveloperToken,
      });

      // --- Historical leads fetch logic starts here ---

      // Refresh access token if expired
      if (token_expiry <= new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: refresh_token || "",
            grant_type: "refresh_token",
          }),
        });
        const refreshTokens = await refreshRes.json();
        if (refreshTokens.error) throw new Error(refreshTokens.error_description);

        access_token = refreshTokens.access_token;
        token_expiry = new Date(Date.now() + refreshTokens.expires_in * 1000);

        // Update DB token info
        await supabase
          .from("google_lead_form_connections")
          .update({
            access_token,
            token_expiry,
          })
          .eq("clinic_id", clinic_id);
      }

      // Query last 30 days leads (limit 100)
      const query = `
        SELECT lead_form_submission_data.id, lead_form_submission_data.field_values
        FROM lead_form_submission_data
        WHERE segments.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        LIMIT 100
      `;

      const leadsRes = await fetch(`https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": googleAdsDeveloperToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!leadsRes.ok) {
        const errorText = await leadsRes.text();
        throw new Error(`Google Ads API error (fetching leads): ${leadsRes.status} ${errorText}`);
      }

      const leadsData = await leadsRes.json();
      console.log("Historical leads response:", JSON.stringify(leadsData, null, 2));

      for (const result of leadsData.results ?? []) {
        const leadData = result.leadFormSubmissionData?.fieldValues || [];

        // Extract fields
        let first_name = "";
        let last_name = "";
        let email = "";
        let phone = "";

        for (const field of leadData) {
          const name = field.fieldName?.toLowerCase();
          const value = field.stringValue || "";

          if (name?.includes("first")) first_name = value;
          else if (name?.includes("last")) last_name = value;
          else if (name?.includes("email")) email = value;
          else if (name?.includes("phone")) phone = value;
        }

        // Insert lead directly
        await supabase.from("lead").upsert({
          first_name,
          last_name,
          email,
          phone,
          clinic_id,
          source_id: "670f33cf-043d-407f-aca9-19613e329de4",
          status: "New",
          form_data: result.leadFormSubmissionData,
        });
      }

      // --- End historical fetch ---

      return new Response(JSON.stringify({ message: "Connected, webhook registered, and historical leads fetched successfully" }), {
        headers: corsHeaders,
      });
    }

    // 2️⃣ Webhook receiver - direct lead insert
    if (url.pathname.includes("/webhook") && req.method === "POST") {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) {
        return new Response("Missing clinic_id", { status: 400, headers: corsHeaders });
      }

      const body = await req.json();

      // TODO: validate webhook signature using webhookSecret for security

      const leadData = body.leadFormSubmissionData?.fieldValues || [];

      // Extract lead info
      let first_name = "";
      let last_name = "";
      let email = "";
      let phone = "";

      for (const field of leadData) {
        const name = field.fieldName?.toLowerCase();
        const value = field.stringValue || "";

        if (name?.includes("first")) first_name = value;
        else if (name?.includes("last")) last_name = value;
        else if (name?.includes("email")) email = value;
        else if (name?.includes("phone")) phone = value;
      }

      const { error: leadError } = await supabase.from("lead").insert({
        first_name,
        last_name,
        email,
        phone,
        clinic_id,
        source_id: "670f33cf-043d-407f-aca9-19613e329de4",
        status: "New",
        form_data: body,
      });

      if (leadError) {
        return new Response(JSON.stringify({ error: leadError.message }), { status: 500, headers: corsHeaders });
      }

      const redirectUrl = new URL(`${APP_URL}/onboarding`);
        redirectUrl.searchParams.set("google_lead_form_status", "success");
        return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl.toString(),
      },
    });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});