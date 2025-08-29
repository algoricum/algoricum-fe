import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";



  import {  corsHeaders, handleOptions } from "../_shared/cors.ts";
import { initiateOAuthFlow, listGoogleSpreadsheets, saveSelectedSheets, submitFormResponse, syncSheets,handleOAuthCallback } from "../_shared/google-form-service.ts";

serve(async req => {
    const optionsResponse = handleOptions(req);
     if (optionsResponse) return optionsResponse;
 
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    console.log("Debug - Path:", path, "Method:", method);


   
    // Route handlers
    if (method === "POST" && (path.includes("/initiate-oauth") || path.endsWith("/initiate-oauth"))) {
      return await initiateOAuthFlow(req);
    }

    if (method === "GET" && (path.includes("/oauth/callback") || path.endsWith("/oauth/callback"))) {
      return await handleOAuthCallback(req, supabase);
    }

    if (method === "POST" && (path.includes("/list-spreadsheets") || path.endsWith("/list-spreadsheets"))) {
      return await listGoogleSpreadsheets(req, supabase);
    }

    if (method === "POST" && (path.includes("/save-selected-sheets") || path.endsWith("/save-selected-sheets"))) {
      return await saveSelectedSheets(req, supabase);
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
