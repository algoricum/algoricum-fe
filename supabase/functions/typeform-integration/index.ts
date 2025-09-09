// supabase/functions/typeform-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import * as service from "../_shared/typeformService.ts";

serve(async req => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle OPTIONS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    if (req.method === "GET" && path.endsWith("/auth/start")) {
      return await service.startAuth(url);
    }

    if (req.method === "GET" && path.endsWith("/auth/callback")) {
      return await service.handleCallback(url);
    }

    if (req.method === "POST" && path.endsWith("/update-forms")) {
      return await service.updateForms(req);
    }

    if (req.method === "POST" && path.endsWith("/webhook")) {
      return await service.handleWebhook(req, url);
    }

    if (req.method === "POST" && path.endsWith("/getSheets")) {
      return await service.getForms(req);
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("❌ Unexpected error in router:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
