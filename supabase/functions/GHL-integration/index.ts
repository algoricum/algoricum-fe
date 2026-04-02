// supabase/functions/gohighlevel/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { importLeads, saveTokens } from "../_shared/GHL-service.ts";

const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

const CLIENT_ID = Deno.env.get("GHL_Client_ID") || "";
const CLIENT_SECRET = Deno.env.get("GHL_Client_Secret") || "";
const REDIRECT_URI = Deno.env.get("SUPABASE_URL")! + "/functions/v1/GHL-integration/auth/callback";
const GHL_AUTH_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";
const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

serve(async req => {
  // Handle CORS
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    // 1. Start Auth
    if (pathname.endsWith("/auth/start") && req.method === "GET") {
      const clinic_id = url.searchParams.get("clinic_id");
      const redirectTo = url.searchParams.get("redirectTo");
      if (!clinic_id) return new Response("Missing clinic_id", { status: 400 });
      const state = encodeURIComponent(`${clinic_id}|${redirectTo}`);
      const authUrl = `${GHL_AUTH_URL}?response_type=code&redirect_uri=${encodeURIComponent(
        REDIRECT_URI,
      )}&client_id=${CLIENT_ID}&scope=forms.write+forms.readonly+users.readonly+locations.readonly+contacts.readonly&state=${state}`;

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // 2. Handle Callback
    if (pathname.endsWith("/auth/callback") && req.method === "GET") {
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state") || "";
      // parse state -> clinic_id|redirect_to
      const decodedState = decodeURIComponent(stateRaw);
      const [clinic_id, redirectToEncoded] = decodedState.split("|");
      const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;

      if (!code || !clinic_id) return new Response("Missing code or clinic_id", { status: 400 });

      const tokenRes = await fetch(GHL_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return new Response(`Token exchange failed: ${err}`, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      await saveTokens(clinic_id, tokenData);

      // Immediately import leads once connected
      await importLeads(clinic_id);
      let redirectUrl = new URL(`${APP_URL}/onboarding`);
      if (redirectTo) {
        redirectUrl = new URL(redirectTo);
      }
      redirectUrl.searchParams.set("go_high_level_status", "success");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectUrl.toString(),
        },
      });
    }

    // 3. Manual Sync (can be called later)
    if (pathname.endsWith("/sync-leads") && req.method === "GET") {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return new Response("Missing clinic_id", { status: 400 });

      await importLeads(clinic_id);
      return new Response("Leads sync in progress", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Not Found", { status: 404, headers: { ...corsHeaders() } });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers: { ...corsHeaders() } });
  }
});
