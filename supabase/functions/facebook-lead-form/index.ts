import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  fetchFacebookLeadFormResponses,
  fetchAvailablePages,
  fetchAvailableForms,
  saveSelectedForms,
  handleAuthCallback,
  handleAuthStart,
  handleFacebookWebhook,
  verifyFacebookWebhook,
} from "../_shared/facebook-lead-form-service.ts";
import { supabase } from "../_shared/supabaseClient.ts";

serve(async req => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    if (path.endsWith("/auth/start") && method === "GET") return await handleAuthStart(req, url);
    if (path.endsWith("/auth/callback") && method === "GET") return await handleAuthCallback(req, url, supabase);
    if (path.endsWith("/fetch-facebook-lead-form-responses") && method === "POST")
      return await fetchFacebookLeadFormResponses(req, supabase);
    if (path.endsWith("/fetch-available-pages") && method === "POST") return await fetchAvailablePages(req, supabase);
    if (path.endsWith("/fetch-available-forms") && method === "POST") return await fetchAvailableForms(req, supabase);
    if (path.endsWith("/save-selected-forms") && method === "POST") return await saveSelectedForms(req, supabase);
    // Handle root-level webhook route: /webhook
    if (path.endsWith("/webhook") && method === "GET") {
      return await verifyFacebookWebhook(req, null, supabase);
    }
    if (path.endsWith("/webhook") && method === "POST") {
      return await handleFacebookWebhook(req, supabase);
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
