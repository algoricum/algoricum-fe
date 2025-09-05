import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hubspotcorsHeaders as corsHeaders } from "../_shared/cors.ts";

// Property mapping configuration
function getHubSpotPropertiesToFetch() {
  return [
    "email",
    "firstname",
    "lastname",
    "phone",
    "createdate",
    "lastmodifieddate",
    "first_name",
    "last_name",
    "phone_number",
    "mobilephone",
    "email_address",
    "primary_email",
    "work_email",
    "custom_first_name",
    "custom_last_name",
    "custom_email",
    "custom_phone"
  ];
}

async function discoverHubSpotProperties(accessToken: string, requestId: string) {
  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      const properties = data.results.map((prop: any) => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        fieldType: prop.fieldType
      }));
      console.log(`[${requestId}] Available HubSpot properties:`, properties);
      return properties;
    }
  } catch (error) {
    console.warn(`[${requestId}] Could not fetch HubSpot properties:`, error.message);
  }
  return [];
}

function mapHubSpotContactToLead(contact: any, clinic_id: string, source_id: string) {
  const props = contact.properties || {};
  const propertyMappings = {
    first_name: [
      props.firstname,
      props.first_name,
      props.custom_first_name
    ],
    last_name: [
      props.lastname,
      props.last_name,
      props.custom_last_name
    ],
    email: [
      props.email,
      props.email_address,
      props.primary_email,
      props.work_email,
      props.custom_email
    ],
    phone: [
      props.phone,
      props.phone_number,
      props.mobilephone,
      props.custom_phone
    ]
  };

  const getFirstValidValue = (values: any[]) => {
    for (const value of values) {
      if (value && typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
    return null;
  };

  const mappedLead = {
    clinic_id,
    first_name: getFirstValidValue(propertyMappings.first_name),
    last_name: getFirstValidValue(propertyMappings.last_name),
    email: getFirstValidValue(propertyMappings.email),
    phone: getFirstValidValue(propertyMappings.phone),
    status: 'New',
    source_id,
    created_at: new Date(props.createdate).toISOString(),
    updated_at: new Date(props.lastmodifieddate).toISOString()
  };

  if (!mappedLead.email && !mappedLead.phone) {
    console.warn(`Contact ${contact.id} has no valid email or phone`, {
      availableProps: Object.keys(props),
      contactId: contact.id
    });
    return null;
  }
  return mappedLead;
}

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
    return await processOAuthCallback(req, requestId);
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
        hasClientId: !!Deno.env.get("HUBSPOT_CLIENT_ID"),
        redirectUri: Deno.env.get("HUBSPOT_REDIRECT_URI")
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
        return await handleSyncAllConnections(req, requestId);
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

async function handleSyncAllConnections(req: Request, requestId: string) {
  console.log(`[${requestId}] 🔄 Processing sync for all HubSpot connections`);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing Supabase environment variables`);
    return new Response(JSON.stringify({ error: "Configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: connections, error: connError } = await supabase
    .from("hubspot_connections")
    .select("clinic_id, access_token, refresh_token, token_expires_at, last_sync_at")
    .eq("connection_status", "connected")
    .not("access_token", "is", null)
    .not("refresh_token", "is", null);

  if (connError) {
    console.error(`[${requestId}] Failed to fetch connections:`, connError);
    return new Response(JSON.stringify({ error: "Failed to fetch connections" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!connections || connections.length === 0) {
    console.log(`[${requestId}] No active HubSpot connections found`);
    return new Response(JSON.stringify({
      message: "No active connections to sync",
      syncedCount: 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  console.log(`[${requestId}] Found ${connections.length} active connections to sync`);
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const connection of connections) {
    const clinic_id = connection.clinic_id;
    if (!clinic_id) {
      console.warn(`[${requestId}] No clinic_id found, skipping`);
      errorCount++;
      continue;
    }

    try {
      console.log(`[${requestId}] Syncing contacts for clinic ${clinic_id}`);
      const syncData = { clinic_id };
      const syncResponse = await handleSyncContacts(syncData, supabase, `${requestId}-${clinic_id}`);
      if (syncResponse.status === 200) {
        successCount++;
      } else {
        errorCount++;
        const errorText = await syncResponse.text();
        errors.push({ clinic_id, error: errorText });
        console.error(`[${requestId}] ❌ Failed to sync clinic ${clinic_id}:`, errorText);
      }
    } catch (error) {
      errorCount++;
      errors.push({ clinic_id, error: error.message });
      console.error(`[${requestId}] ❌ Exception syncing clinic ${clinic_id}:`, error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const summary = {
    totalConnections: connections.length,
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  };
  console.log(`[${requestId}] ✅ Cron job completed:`, summary);
  return new Response(JSON.stringify({
    success: true,
    message: "Sync completed for all connections",
    ...summary
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function processOAuthCallback(req: Request, requestId: string) {
  console.log(`[${requestId}] 🔄 Processing OAuth callback`);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const htmlHeaders = { "Content-Type": "text/html", ...corsHeaders };

  if (error) {
    console.error(`[${requestId}] OAuth error: ${error}`);
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
      headers: { ...corsHeaders, "Location": redirectUrlWithError.toString() }
    });
  }

  if (!code || !state) {
    console.error(`[${requestId}] Missing parameters`, { hasCode: !!code, hasState: !!state });
    const redirectUrl = "http://localhost:3001/onboarding";
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", "Missing code or state parameter");
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": redirectUrlWithError.toString() }
    });
  }

  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing environment variables`);
    return new Response(createErrorHtml("Configuration Error", "Missing environment variables"), {
      headers: htmlHeaders
    });
  }

  try {
    const stateData = JSON.parse(atob(state));
    console.log(`[${requestId}] State decoded`, { clinic_id: stateData.clinic_id });
    const clinic_id = stateData.clinic_id;
    if (!clinic_id) {
      console.error(`[${requestId}] Missing clinic_id in state`);
      throw new Error("Missing clinic_id in OAuth state");
    }

    console.log(`[${requestId}] Exchanging code for tokens`);
    const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[${requestId}] Token exchange failed`, { status: tokenResponse.status, errorText });
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log(`[${requestId}] Tokens received`, { hasAccessToken: !!tokens.access_token });

    await discoverHubSpotProperties(tokens.access_token, requestId);

    const accountResponse = await fetch("https://api.hubapi.com/integrations/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    let accountData = { companyName: "Unknown", portalId: "unknown" };
    if (accountResponse.ok) {
      accountData = await accountResponse.json();
    }

    const afterDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`[${requestId}] Starting initial contacts sync for contacts newer than ${afterDate} (120 days)`);
    const propertiesToFetch = getHubSpotPropertiesToFetch();
    const contacts = [];
    let after: string | null = null;

    do {
      const searchBody = {
        filterGroups: [
          { filters: [{ propertyName: "createdate", operator: "GTE", value: afterDate }] },
          { filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: afterDate }] }
        ],
        properties: propertiesToFetch,
        limit: 100,
        after: after || undefined
      };

      const contactsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(searchBody)
      });

      if (!contactsResponse.ok) {
        console.error(`[${requestId}] Contacts search failed`, { status: contactsResponse.status });
        throw new Error(`Contacts search failed: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    } while (after);

    console.log(`[${requestId}] Fetched ${contacts.length} contacts from last 120 days`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (contacts.length > 0) {
      const { data: sourceData, error: sourceError } = await supabase
        .from('lead_source')
        .select('id')
        .eq('name', 'Hubspot')
        .single();

      if (sourceError || !sourceData) {
        console.error(`[${requestId}] Error fetching lead source:`, sourceError);
        throw new Error("Could not find HubSpot in lead_source table");
      }

      const source_id = sourceData.id;
      console.log(`[${requestId}] Using clinic_id from state: ${clinic_id}`);
      const leadsToInsert = contacts
        .map((contact) => {
          if (!contact.id) {
            console.warn(`[${requestId}] Contact missing ID`, { contact });
            return null;
          }
          return mapHubSpotContactToLead(contact, clinic_id, source_id);
        })
        .filter((lead) => lead !== null);

      if (leadsToInsert.length === 0) {
        console.warn(`[${requestId}] No valid leads to insert`);
      } else {
        let retries = 3;
        let leadError = null;
        while (retries > 0) {
          try {
            const { error } = await supabase.from("lead").upsert(leadsToInsert);
            if (error) {
              console.error(`[${requestId}] Lead save error`, { error: JSON.stringify(error), leadSample: leadsToInsert[0] });
              leadError = error;
              retries--;
              if (retries === 0) throw new Error(`Lead save failed after retries: ${JSON.stringify(error)}`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            console.log(`[${requestId}] Successfully saved ${leadsToInsert.length} leads`);
            break;
          } catch (err) {
            console.error(`[${requestId}] Lead save attempt failed`, { error: err.message });
            leadError = err;
            retries--;
            if (retries === 0) throw new Error(`Lead save failed after retries: ${err.message}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        if (leadError) throw leadError;
      }
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const { error: dbError } = await supabase.from("hubspot_connections").upsert({
      clinic_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      account_name: accountData.companyName || `Hub ${accountData.portalId}`,
      contact_count: contacts.length,
      hub_id: accountData.portalId?.toString(),
      scope: ["crm.objects.contacts.read", "crm.objects.leads.read"].join(" "),
      connection_status: "connected",
      last_sync_at: new Date().toISOString(),
      error_message: null
    });

    if (dbError) {
      console.error(`[${requestId}] Database error`, dbError);
      throw new Error(`Connection save failed: ${JSON.stringify(dbError)}`);
    }

    console.log(`[${requestId}] ✅ Success - Connection saved and initial sync completed (120-day filter)`);
    const accountInfo = {
      accountName: accountData.companyName || `Hub ${accountData.portalId}`,
      contactCount: contacts.length,
      dealCount: 0
    };

    const redirectUrl = stateData.redirectUrl || "http://localhost:3001/onboarding";
    const redirectUrlWithParams = new URL(redirectUrl);
    redirectUrlWithParams.searchParams.set("hubspot_status", "success");
    redirectUrlWithParams.searchParams.set("account_name", accountInfo.accountName);
    redirectUrlWithParams.searchParams.set("contact_count", accountInfo.contactCount.toString());
    redirectUrlWithParams.searchParams.set("clinic_id", stateData.clinic_id);
    console.log(`[${requestId}] Redirecting to: ${redirectUrlWithParams.toString()}`);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, "Location": redirectUrlWithParams.toString() }
    });
  } catch (error) {
    console.error(`[${requestId}] Callback processing error`, { error: error.message, stack: error.stack });
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
      headers: { ...corsHeaders, "Location": redirectUrlWithError.toString() }
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");

  if (!supabaseUrl || !supabaseServiceKey || !clientId || !clientSecret || !redirectUri) {
    return new Response(JSON.stringify({ error: "Configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/sync-contacts')) {
      // Get all connected clinic IDs
      const { data: connections, error: connError } = await supabase
        .from("hubspot_connections")
        .select("clinic_id")
        .eq("connection_status", "connected")
        .not("access_token", "is", null)
        .not("refresh_token", "is", null);

      if (connError || !connections || connections.length === 0) {
        return new Response(JSON.stringify({ error: "No active connections found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const results = [];
      for (const connection of connections) {
        const syncBody = { 
          clinic_id: connection.clinic_id,
          redirectUri: redirectUri 
        };
        try {
          const result = await handleSyncContacts(syncBody, supabase, `${requestId}-${connection.clinic_id}`);
          const resultData = await result.json();
          results.push({ clinic_id: connection.clinic_id, ...resultData });
        } catch (error) {
          results.push({ clinic_id: connection.clinic_id, error: error.message });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Synced contacts for ${connections.length} clinics`,
        results
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return await handleConnect(body, supabase, clientId, redirectUri, requestId);
  }

  if (req.method === "DELETE") {
    return await handleDisconnect(body, supabase, requestId);
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function refreshHubSpotToken(refreshToken: string, supabase: any, clinic_id: string, requestId: string) {
  console.log(`[${requestId}] Refreshing HubSpot token for clinic ${clinic_id}`);
  const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: Deno.env.get("HUBSPOT_CLIENT_ID")!,
      client_secret: Deno.env.get("HUBSPOT_CLIENT_SECRET")!,
      refresh_token: refreshToken
    })
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error(`[${requestId}] Token refresh failed for clinic ${clinic_id}`, { status: tokenResponse.status, error: errorData });
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  const { error: updateError } = await supabase.from('hubspot_connections').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
  }).eq('clinic_id', clinic_id);

  if (updateError) {
    console.error(`[${requestId}] Failed to update tokens for clinic ${clinic_id}`, updateError);
    throw new Error('Failed to save new tokens');
  }

  console.log(`[${requestId}] Token refreshed successfully for clinic ${clinic_id}`);
  return tokenData.access_token;
}

async function makeHubSpotRequest(url: string, options: any, accessToken: string, refreshToken: string, supabase: any, clinic_id: string, requestId: string) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    console.log(`[${requestId}] Received 401 for clinic ${clinic_id}, attempting token refresh`);
    try {
      const newAccessToken = await refreshHubSpotToken(refreshToken, supabase, clinic_id, requestId);
      return await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newAccessToken}` }
      });
    } catch (refreshError) {
      console.error(`[${requestId}] Token refresh failed for clinic ${clinic_id}`, refreshError);
      return response;
    }
  }
  return response;
}

async function handleSyncContacts(body: any, supabase: any, requestId: string) {
  console.log(`[${requestId}] Handling contacts sync for a single connection`);
  const { clinic_id } = body;
  if (!clinic_id) {
    return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Fetch connection details including clinic_id
  const { data: connection, error: connError } = await supabase
    .from("hubspot_connections")
    .select("access_token, refresh_token, hub_id, last_sync_at, token_expires_at, clinic_id")
    .eq("clinic_id", clinic_id)
    .eq("connection_status", "connected")
    .not("access_token", "is", null)
    .not("refresh_token", "is", null)
    .limit(1)
    .single();

  if (connError || !connection) {
    console.error(`[${requestId}] Connection fetch error for clinic ${clinic_id}`, connError);
    return new Response(JSON.stringify({ error: "No active HubSpot connection found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let accessToken = connection.access_token;
  const refreshToken = connection.refresh_token;
  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "No refresh token available. Please reconnect HubSpot." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt && expiresAt < fiveMinutesFromNow) {
    console.log(`[${requestId}] Token expires soon for clinic ${clinic_id}, refreshing proactively`);
    try {
      accessToken = await refreshHubSpotToken(refreshToken, supabase, clinic_id, requestId);
    } catch (error) {
      console.error(`[${requestId}] Proactive token refresh failed for clinic ${clinic_id}`, error);
      return new Response(JSON.stringify({ error: "Failed to refresh access token. Please reconnect HubSpot." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  const afterDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const contacts = [];
  let after: string | null = null;
  console.log(`[${requestId}] Fetching contacts modified since ${afterDate} (15 minutes ago) for clinic ${clinic_id}`);
  const propertiesToFetch = getHubSpotPropertiesToFetch();

  do {
    const searchBody = {
      filterGroups: [{ filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: afterDate }] }],
      properties: propertiesToFetch,
      limit: 100,
      after: after || undefined
    };

    try {
      const contactsResponse = await makeHubSpotRequest(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(searchBody)
        },
        accessToken,
        refreshToken,
        supabase,
        clinic_id,
        requestId
      );

      if (!contactsResponse.ok) {
        const errorText = await contactsResponse.text();
        console.error(`[${requestId}] Contacts search failed for clinic ${clinic_id}`, { status: contactsResponse.status, error: errorText });
        return new Response(JSON.stringify({ error: `Failed to fetch contacts: ${contactsResponse.status}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const contactsData = await contactsResponse.json();
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    } catch (error) {
      console.error(`[${requestId}] Error during contacts fetch for clinic ${clinic_id}`, error);
      return new Response(JSON.stringify({ error: "Network error while fetching contacts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } while (after);

  console.log(`[${requestId}] Fetched ${contacts.length} contacts modified in last 15 minutes for clinic ${clinic_id}`);

  if (contacts.length > 0) {
    const { data: sourceData, error: sourceError } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'Hubspot')
      .single();

    if (sourceError || !sourceData) {
      console.error(`[${requestId}] Error fetching lead source for clinic ${clinic_id}:`, sourceError);
      return new Response(JSON.stringify({ error: "Could not find HubSpot in lead_source table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const source_id = sourceData.id;
    const leadsToInsert = contacts
      .map((contact) => {
        if (!contact.id) {
          console.warn(`[${requestId}] Contact missing ID for clinic ${clinic_id}`, { contact });
          return null;
        }
        return mapHubSpotContactToLead(contact, clinic_id, source_id);
      })
      .filter((lead) => lead !== null);

    if (leadsToInsert.length === 0) {
      console.warn(`[${requestId}] No valid leads to insert for clinic ${clinic_id}`);
    } else {
      let retries = 3;
      let leadError = null;
      while (retries > 0) {
        try {
          const { error } = await supabase.from("lead").upsert(leadsToInsert);
          if (error) {
            console.error(`[${requestId}] Lead save error for clinic ${clinic_id}`, { error: JSON.stringify(error), leadSample: leadsToInsert[0] });
            leadError = error;
            retries--;
            if (retries === 0) throw new Error(`Lead save failed after retries: ${JSON.stringify(error)}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          console.log(`[${requestId}] Successfully saved ${leadsToInsert.length} leads for clinic ${clinic_id}`);
          break;
        } catch (err) {
          console.error(`[${requestId}] Lead save attempt failed for clinic ${clinic_id}`, { error: err.message });
          leadError = err;
          retries--;
          if (retries === 0) throw new Error(`Lead save failed after retries: ${err.message}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (leadError) throw leadError;
    }
  }

  const { error: updateError } = await supabase
    .from("hubspot_connections")
    .update({ last_sync_at: new Date().toISOString(), contact_count: contacts.length })
    .eq("clinic_id", clinic_id);

  if (updateError) {
    console.error(`[${requestId}] Update last_sync_at error for clinic ${clinic_id}`, updateError);
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Synced ${contacts.length} leads for clinic ${clinic_id}`,
    contactCount: contacts.length
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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

async function handleConnect(body: any, supabase: any, clientId: string, redirectUri: string, requestId: string) {
  console.log(`[${requestId}] Connect handler`);
  const { redirectUrl, clinic_id } = body;
  if (!redirectUrl || !clinic_id) {
    return new Response(JSON.stringify({ error: "Missing redirectUrl or clinic_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  await supabase.from("hubspot_connections").upsert({
    clinic_id,
    connection_status: "connecting",
    error_message: null
  });

  const state = btoa(JSON.stringify({ redirectUrl, clinic_id, timestamp: Date.now() }));
  const scopes = ["crm.objects.contacts.read", "crm.objects.leads.read"].join(" ");
  const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleDisconnect(body: any, supabase: any, requestId: string) {
  console.log(`[${requestId}] Disconnect handler`);
  const { clinic_id } = body;
  if (!clinic_id) {
    return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  await supabase.from("hubspot_connections").update({
    connection_status: "disconnected",
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
  }).eq("clinic_id", clinic_id);

  return new Response(JSON.stringify({
    success: true,
    message: "Successfully disconnected from HubSpot"
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}