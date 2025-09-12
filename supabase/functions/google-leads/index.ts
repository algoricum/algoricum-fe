import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { handleOAuthCallback, insertLead, startAuth } from "../_shared/google-leads-service.ts";
serve(async req => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const url = new URL(req.url);

    // 0️⃣ Start OAuth
    if (url.pathname.includes("/start-auth") && req.method === "POST") {
      const { clinic_id, redirectTo } = await req.json();
      const result = await startAuth(clinic_id, redirectTo);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders() } });
    }

    // 1️⃣ OAuth Callback
    if (url.pathname.includes("/oauth/callback") && req.method === "GET") {
      const code = url.searchParams.get("code")!;
      const stateRaw = url.searchParams.get("state") || "";

      // parse state -> clinic_id|redirect_to
      const decodedState = decodeURIComponent(stateRaw);
      const [clinic_id, redirectToEncoded] = decodedState.split("|");
      const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;
      const tokens = await handleOAuthCallback(code, clinic_id, redirectTo);
      console.error(tokens);
      const redirectURL = new URL(tokens);
      redirectURL.searchParams.set("google_lead_form_status", "success");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectURL.toString(),
        },
      });
    }

    // 2️⃣ Webhook Handler
    if (url.pathname.includes("/webhook") && req.method === "POST") {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return new Response("Missing clinic_id", { status: 400, headers: { ...corsHeaders() } });

      const body = await req.json();
      const redirectUrl = await insertLead(clinic_id, body);

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders(), Location: redirectUrl },
      });
    }

    return new Response("Not found", { status: 404, headers: { ...corsHeaders() } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders() } });
  }
});
