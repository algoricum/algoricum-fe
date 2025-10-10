import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  getAccessToken,
  getLatestConnection,
  handleOAuthCallback,
  initiateOAuthFlow,
  listGoogleSpreadsheets,
  processSelectedFiles,
  saveSelectedSheets,
  submitFormResponse,
  syncSheets,
} from "../_shared/google-form-service.ts";
import { supabase } from "../_shared/supabaseClient.ts";
serve(async req => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    console.log("🌐 Incoming request - Path:", path, "Method:", method);
    console.log("🔗 Full URL:", req.url);
    console.log("🎯 Headers:", Object.fromEntries(req.headers.entries()));
    // Route handlers
    if (method === "POST" && (path.includes("/initiate-oauth") || path.endsWith("/initiate-oauth"))) {
      console.log("🚀 Routing to initiateOAuthFlow");
      return await initiateOAuthFlow(req);
    }
    if (method === "GET" && (path.includes("/oauth/callback") || path.endsWith("/oauth/callback"))) {
      console.log("🔄 Routing to handleOAuthCallback");
      console.log("🗄️ Supabase client:", supabase ? "initialized" : "not initialized");
      return await handleOAuthCallback(req, supabase);
    }
    if (method === "POST" && (path.includes("/list-spreadsheets") || path.endsWith("/list-spreadsheets"))) {
      return await listGoogleSpreadsheets(req, supabase);
    }
    if (method === "POST" && (path.includes("/save-selected-sheets") || path.endsWith("/save-selected-sheets"))) {
      return await saveSelectedSheets(req, supabase);
    }
    if (method === "POST" && (path.includes("/process-selected-files") || path.endsWith("/process-selected-files"))) {
      return await processSelectedFiles(req, supabase);
    }
    if (method === "POST" && (path.includes("/get-access-token") || path.endsWith("/get-access-token"))) {
      return await getAccessToken(req, supabase);
    }
    if (method === "POST" && (path.includes("/get-latest-connection") || path.endsWith("/get-latest-connection"))) {
      return await getLatestConnection(req, supabase);
    }
    if (method === "POST" && (path.includes("/sync-sheets") || path.endsWith("/sync-sheets"))) {
      return await syncSheets(req, supabase);
    }
    if (method === "POST" && (path.includes("/public/submit") || path.endsWith("/public/submit"))) {
      return await submitFormResponse(req, supabase);
    }
    // Route not found
    return new Response(
      JSON.stringify({
        error: "Route not found",
        debug: {
          receivedPath: path,
          receivedMethod: method,
        },
        availableRoutes: [
          "GET /google-form-integration (health check)",
          "POST /google-form-integration/initiate-oauth",
          "GET /google-form-integration/oauth/callback",
          "POST /google-form-integration/list-spreadsheets",
          "POST /google-form-integration/save-selected-sheets",
          "POST /google-form-integration/get-access-token",
          "POST /google-form-integration/get-latest-connection",
          "POST /google-form-integration/process-selected-files",
          "POST /google-form-integration/sync-sheets",
          "POST /google-form-integration/public/submit",
        ],
      }),
      {
        status: 404,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  }
});
