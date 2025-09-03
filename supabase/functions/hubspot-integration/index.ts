import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { hubspotcorsHeaders as corsHeaders } from "../_shared/cors.ts";
import {
  createTestSuccessHtml,
  disconnectConnection,
  initializeOAuth,
  processOAuthCallback,
  syncAllClinicContacts,
  syncAllConnections
} from '../_shared/hubspot-service.ts';

// Environment variables at top level
const HUBSPOT_CLIENT_ID = Deno.env.get("HUBSPOT_CLIENT_ID");
const HUBSPOT_REDIRECT_URI = Deno.env.get("HUBSPOT_REDIRECT_URI");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL");


serve(async (req) => {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  console.log(`[${requestId}] 🚀 PUBLIC REQUEST`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    searchParams: Object.fromEntries(url.searchParams.entries()),
    hasCode: !!url.searchParams.get("code"),
    hasState: !!url.searchParams.get("state"),
    hasAuthHeader: !!req.headers.get("authorization"),
    userAgent: req.headers.get("user-agent")?.substring(0, 50)
  });

  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] ✅ OPTIONS - Public access`);
    return new Response("ok", { headers: corsHeaders });
  }

  const code = url.searchParams.get("code");
  if (req.method === "GET" && code) {
    console.log(`[${requestId}] 🔥 OAUTH CALLBACK IMMEDIATE PROCESSING`);
    console.log(`[${requestId}] Code: ${code?.substring(0, 10)}...`);
    console.log(`[${requestId}] State: ${url.searchParams.get("state")?.substring(0, 20)}...`);
    return await handleOAuthCallbackRoute(req, requestId);
  }

  if (req.method === "GET") {
    console.log(`[${requestId}] ✅ Health check - Public access`);
    const testParam = url.searchParams.get("test");
    if (testParam === "callback") {
      return new Response(createTestSuccessHtml(), {
        headers: { "Content-Type": "text/html", ...corsHeaders }
      });
    }
    return new Response(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      public: true,
      environment: {
        hasClientId: !!HUBSPOT_CLIENT_ID,
        redirectUri: HUBSPOT_REDIRECT_URI
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!req.headers.get("authorization")) {
        console.log(`[${requestId}] 🕐 Starting cron job - sync all HubSpot connections`);
        return await handleSyncAllConnectionsRoute(requestId);
      }
      return await handleAuthenticatedRequest(req, body, requestId);
    } catch (error) {
      console.error(`[${requestId}] Error parsing POST body:`, error);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const body = await req.json();
      return await handleAuthenticatedRequest(req, body, requestId);
    } catch (error) {
      console.error(`[${requestId}] Error parsing DELETE body:`, error);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  console.log(`[${requestId}] ❌ Method not allowed: ${req.method}`);
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

async function handleSyncAllConnectionsRoute(requestId: string) {
  try {
    const result = await syncAllConnections(requestId);
    return new Response(JSON.stringify({
      success: true,
      message: "Sync completed for all connections",
      ...result
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`[${requestId}] Sync all connections error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

async function handleOAuthCallbackRoute(req: Request, requestId: string) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  
  try {
    const result = await processOAuthCallback(code!, state!, error || undefined, requestId);
    
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": result.redirectUrl }
    });
  } catch (err) {
    console.error(`[${requestId}] OAuth callback route error:`, err);
    const fallbackUrl = FRONTEND_URL || "http://localhost:3001";
    const errorUrl = new URL(fallbackUrl);
    errorUrl.searchParams.set("hubspot_status", "error");
    errorUrl.searchParams.set("error_message", err.message);
    
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": errorUrl.toString() }
    });
  }
}

async function handleAuthenticatedRequest(req: Request, body: any, requestId: string) {
  console.log(`[${requestId}] Handling authenticated request`);
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI) {
    return new Response(JSON.stringify({ error: "Configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/sync-contacts')) {
      try {
        const result = await syncAllClinicContacts(authHeader, requestId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    return await handleConnectRoute(body, requestId);
  }

  if (req.method === "DELETE") {
    return await handleDisconnectRoute(body, requestId);
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleConnectRoute(body: any, requestId: string) {
  try {
    const { redirectUrl, clinic_id } = body;
    const result = await initializeOAuth(redirectUrl, clinic_id, requestId);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`[${requestId}] Connect route error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

async function handleDisconnectRoute(body: any, requestId: string) {
  try {
    const { clinic_id } = body;
    const result = await disconnectConnection(clinic_id, requestId);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`[${requestId}] Disconnect route error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}