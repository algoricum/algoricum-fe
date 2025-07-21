import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
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

  // Always allow OPTIONS
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] ✅ OPTIONS - Public access`);
    return new Response("ok", { headers: corsHeaders });
  }

  // 🔥 IMMEDIATE OAuth callback handling - FIRST CHECK
  const code = url.searchParams.get("code");
  if (req.method === "GET" && code) {
    console.log(`[${requestId}] 🔥 OAUTH CALLBACK IMMEDIATE PROCESSING`);
    console.log(`[${requestId}] Code: ${code?.substring(0, 10)}...`);
    console.log(`[${requestId}] State: ${url.searchParams.get("state")?.substring(0, 20)}...`);
    
    return await processOAuthCallback(req, requestId);
  }

  // Health check - also public
  if (req.method === "GET") {
    console.log(`[${requestId}] ✅ Health check - Public access`);
    
    const testParam = url.searchParams.get("test");
    if (testParam === "callback") {
      return new Response(
        createTestSuccessHtml(),
        { headers: { "Content-Type": "text/html", ...corsHeaders } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        public: true,
        environment: {
          hasClientId: !!Deno.env.get("HUBSPOT_CLIENT_ID"),
          redirectUri: Deno.env.get("HUBSPOT_REDIRECT_URI")
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // For authenticated operations (POST, DELETE), we'll handle auth separately
  if (req.method === "POST" || req.method === "DELETE") {
    return await handleAuthenticatedRequest(req, requestId);
  }

  console.log(`[${requestId}] ❌ Method not allowed: ${req.method}`);
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

async function processOAuthCallback(req: Request, requestId: string) {
  console.log(`[${requestId}] 🔄 Processing OAuth callback`);
  
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const htmlHeaders = { "Content-Type": "text/html", ...corsHeaders };

  if (error) {
    console.error(`[${requestId}] OAuth error: ${error}`);
    
    // Redirect back to frontend with OAuth error
    let redirectUrl = "http://localhost:3001/onboarding";
    try {
      if (state) {
        const stateData = JSON.parse(atob(state));
        redirectUrl = stateData.redirectUrl || redirectUrl;
      }
    } catch (e) {
      console.error("Could not parse state for OAuth error redirect");
    }
    
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", `OAuth error: ${error}`);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithError.toString()
      }
    });
  }

  if (!code || !state) {
    console.error(`[${requestId}] Missing parameters`, { hasCode: !!code, hasState: !!state });
    
    // Redirect back to frontend with missing params error
    const redirectUrl = "http://localhost:3001/onboarding";
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", "Missing code or state parameter");

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithError.toString()
      }
    });
  }

  // Get environment variables
  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing environment variables`);
    return new Response(
      createErrorHtml("Configuration Error", "Missing environment variables"),
      { headers: htmlHeaders }
    );
  }

  try {
    // Decode state
    const stateData = JSON.parse(atob(state));
    console.log(`[${requestId}] State decoded`, { userId: stateData.userId });

    // Exchange code for tokens
    console.log(`[${requestId}] Exchanging code for tokens`);
    const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[${requestId}] Token exchange failed`, { status: tokenResponse.status, errorText });
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log(`[${requestId}] Tokens received`, { hasAccessToken: !!tokens.access_token });

    // Get account info
    const accountResponse = await fetch("https://api.hubapi.com/integrations/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let accountData = { companyName: "Unknown", portalId: "unknown" };
    if (accountResponse.ok) {
      accountData = await accountResponse.json();
    }

    // Get contacts count
    const contactsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let contactsData = { total: 0 };
    if (contactsResponse.ok) {
      contactsData = await contactsResponse.json();
    }

    // Save to database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    const { error: dbError } = await supabase
      .from("hubspot_connections")
      .upsert({
        user_id: stateData.userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        account_name: accountData.companyName || `Hub ${accountData.portalId}`,
        contact_count: contactsData.total || 0,
        hub_id: accountData.portalId?.toString(),
        connection_status: "connected",
        last_sync_at: new Date().toISOString(),
        error_message: null,
      });

    if (dbError) {
      console.error(`[${requestId}] Database error`, dbError);
      throw new Error("Database save failed");
    }

    console.log(`[${requestId}] ✅ Success - Connection saved`);

    const accountInfo = {
      accountName: accountData.companyName || `Hub ${accountData.portalId}`,
      contactCount: contactsData.total || 0,
      dealCount: 0,
    };

    // Instead of returning HTML, redirect back to frontend with success data
    const redirectUrl = stateData.redirectUrl || "http://localhost:3001/onboarding";
    const redirectUrlWithParams = new URL(redirectUrl);
    
    // Add success parameters
    redirectUrlWithParams.searchParams.set("hubspot_status", "success");
    redirectUrlWithParams.searchParams.set("account_name", accountInfo.accountName);
    redirectUrlWithParams.searchParams.set("contact_count", accountInfo.contactCount.toString());
    redirectUrlWithParams.searchParams.set("user_id", stateData.userId);

    console.log(`[${requestId}] Redirecting to: ${redirectUrlWithParams.toString()}`);

    // Return a redirect response
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithParams.toString()
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Callback processing error`, error);
    
    // Redirect back to frontend with error
    let redirectUrl = "http://localhost:3001/onboarding";
    try {
      const stateData = JSON.parse(atob(state));
      redirectUrl = stateData.redirectUrl || redirectUrl;
    } catch (e) {
      console.error("Could not parse state for error redirect");
    }
    
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", error.message);

    console.log(`[${requestId}] Redirecting with error to: ${redirectUrlWithError.toString()}`);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithError.toString()
      }
    });
  }
}

async function handleAuthenticatedRequest(req: Request, requestId: string) {
  console.log(`[${requestId}] Handling authenticated request`);
  
  // Check for authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");

  if (!supabaseUrl || !supabaseServiceKey || !clientId || !clientSecret || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "POST") {
    return await handleConnect(req, supabase, clientId, redirectUri, requestId);
  }

  if (req.method === "DELETE") {
    return await handleDisconnect(req, supabase, requestId);
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Helper functions for HTML responses
function createSuccessHtml(accountInfo: any, redirectUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connected Successfully</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      text-align: center; 
      padding: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
    }
    .container {
      background: white;
      color: #333;
      padding: 40px;
      border-radius: 15px;
      max-width: 400px;
      margin: 0 auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .success { color: #4caf50; font-size: 48px; margin-bottom: 20px; }
    .loading { color: #666; margin-top: 20px; }
    .close-btn {
      background: #4caf50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 15px;
    }
    .close-btn:hover { background: #45a049; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Successfully Connected!</h1>
    <p>Connected to <strong>${accountInfo.accountName}</strong></p>
    <p>${accountInfo.contactCount} contacts</p>
    <p class="loading">This window will close automatically...</p>
    <button class="close-btn" onclick="closeWindow()" style="display: none;">Close Window</button>
  </div>
  <script>
    console.log('🎯 Sending success message to parent');
    
    function sendMessage() {
      try {
        if (window.opener && !window.opener.closed) {
          console.log('📡 Posting message to opener');
          window.opener.postMessage({
            type: 'hubspot_success',
            accountInfo: ${JSON.stringify(accountInfo)}
          }, '${redirectUrl}');
          console.log('✅ Message sent successfully');
        } else {
          console.warn('⚠️ No opener window available');
        }
      } catch (e) {
        console.error('❌ Failed to post message:', e);
      }
    }
    
    function closeWindow() {
      console.log('🔄 Attempting to close window');
      try {
        if (window.opener) {
          window.close();
          console.log('✅ Window close requested');
        } else {
          console.log('ℹ️ Manual close required - no opener reference');
          showManualCloseOption();
        }
      } catch (e) {
        console.error('❌ Cannot close window:', e);
        showManualCloseOption();
      }
    }
    
    function showManualCloseOption() {
      document.querySelector('.loading').innerHTML = 'Please close this window manually';
      document.querySelector('.close-btn').style.display = 'inline-block';
    }
    
    // Send message immediately
    sendMessage();
    
    // Try to close after 2 seconds
    setTimeout(() => {
      closeWindow();
      // If window is still open after 3 more seconds, show manual option
      setTimeout(() => {
        if (!window.closed) {
          showManualCloseOption();
        }
      }, 3000);
    }, 2000);
    
    // Also try to close when user clicks anywhere (backup)
    document.addEventListener('click', closeWindow);
  </script>
</body></html>`;
}

function createErrorHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      text-align: center; 
      padding: 50px;
      background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
      color: white;
      margin: 0;
    }
    .container {
      background: white;
      color: #333;
      padding: 40px;
      border-radius: 15px;
      max-width: 400px;
      margin: 0 auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .error { color: #f44336; font-size: 48px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error">✗</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p>This window will close automatically...</p>
  </div>
  <script>
    setTimeout(() => window.close(), 3000);
  </script>
</body></html>`;
}

function createTestSuccessHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Success</title>
</head>
<body>
  <h1>✅ Test Callback Works!</h1>
  <p>OAuth callback processing is working correctly.</p>
</body></html>`;
}

// Connect and disconnect handlers (simplified versions)
async function handleConnect(req: Request, supabase: any, clientId: string, redirectUri: string, requestId: string) {
  console.log(`[${requestId}] Connect handler`);
  
  const { userId, redirectUrl } = await req.json();
  
  if (!userId || !redirectUrl) {
    return new Response(
      JSON.stringify({ error: "Missing userId or redirectUrl" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update database
  await supabase
    .from("hubspot_connections")
    .upsert({
      user_id: userId,
      connection_status: "connecting",
      error_message: null,
    });

  // Create auth URL
  const state = btoa(JSON.stringify({ userId, redirectUrl, timestamp: Date.now() }));
  const scopes = ["crm.objects.contacts.read"].join(" ");
  
  const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return new Response(
    JSON.stringify({ authUrl: authUrl.toString() }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDisconnect(req: Request, supabase: any, requestId: string) {
  console.log(`[${requestId}] Disconnect handler`);
  
  const { userId } = await req.json();
  
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Missing userId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update database
  await supabase
    .from("hubspot_connections")
    .update({
      connection_status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      error_message: null,
    })
    .eq("user_id", userId);

  return new Response(
    JSON.stringify({ success: true, message: "Successfully disconnected from HubSpot" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}