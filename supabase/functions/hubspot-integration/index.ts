import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// Property mapping configuration
function getHubSpotPropertiesToFetch() {
  return [
    // Standard HubSpot properties
    "email",
    "firstname",
    "lastname",
    "phone",
    "createdate",
    "lastmodifieddate",
    // Common alternative property names
    "first_name",
    "last_name",
    "phone_number",
    "mobilephone",
    "email_address",
    "primary_email",
    "work_email",
    // Custom property variations (add your custom fields here)
    "custom_first_name",
    "custom_last_name",
    "custom_email",
    "custom_phone"
  ];
}
async function discoverHubSpotProperties(accessToken, requestId) {
  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      const properties = data.results.map((prop)=>({
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
function mapHubSpotContactToLead(contact, clinic_id, source_id) {
  const props = contact.properties || {};
  // Property mapping with fallbacks
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
  // Helper function to get first non-null/non-empty value
  const getFirstValidValue = (values)=>{
    for (const value of values){
      if (value && typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
    return null;
  };
  const mappedLead = {
    clinic_id: clinic_id,
    first_name: getFirstValidValue(propertyMappings.first_name),
    last_name: getFirstValidValue(propertyMappings.last_name),
    email: getFirstValidValue(propertyMappings.email),
    phone: getFirstValidValue(propertyMappings.phone),
    status: 'New',
    source_id,
    created_at: props.createdate ? new Date(props.createdate).toISOString() : null,
    updated_at: props.lastmodifieddate ? new Date(props.lastmodifieddate).toISOString() : null
  };
  // Validate that we have at least an email or phone
  if (!mappedLead.email && !mappedLead.phone) {
    console.warn(`Contact ${contact.id} has no valid email or phone`, {
      availableProps: Object.keys(props),
      contactId: contact.id
    });
    return null;
  }
  return mappedLead;
}
serve(async (req)=>{
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
  // Always allow OPTIONS
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] ✅ OPTIONS - Public access`);
    return new Response("ok", {
      headers: corsHeaders
    });
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
      return new Response(createTestSuccessHtml(), {
        headers: {
          "Content-Type": "text/html",
          ...corsHeaders
        }
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
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // Handle POST requests (both authenticated and cron)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      // Handle cron job for syncing all connections (no auth required for service role)
      if (body.mode === 'sync_all_connections') {
        console.log(`[${requestId}] 🕐 Starting cron job - sync all HubSpot connections`);
        return await handleSyncAllConnections(req, requestId);
      }
      // All other POST requests require authentication - pass the parsed body
      return await handleAuthenticatedRequest(req, body, requestId);
    } catch (error) {
      console.error(`[${requestId}] Error parsing POST body:`, error);
      return new Response(JSON.stringify({
        error: "Invalid JSON body"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
  // For authenticated DELETE operations
  if (req.method === "DELETE") {
    try {
      const body = await req.json();
      return await handleAuthenticatedRequest(req, body, requestId);
    } catch (error) {
      console.error(`[${requestId}] Error parsing DELETE body:`, error);
      return new Response(JSON.stringify({
        error: "Invalid JSON body"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
  console.log(`[${requestId}] ❌ Method not allowed: ${req.method}`);
  return new Response(JSON.stringify({
    error: "Method not allowed"
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
});
async function handleSyncAllConnections(req, requestId) {
  console.log(`[${requestId}] 🔄 Processing sync for all HubSpot connections`);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing Supabase environment variables`);
    return new Response(JSON.stringify({
      error: "Configuration error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  try {
    // Get all active HubSpot connections
    const { data: connections, error: connError } = await supabase.from("hubspot_connections").select("user_id, clinic_id, access_token, last_sync_at").eq("connection_status", "connected");
    if (connError) {
      console.error(`[${requestId}] Failed to fetch connections:`, connError);
      return new Response(JSON.stringify({
        error: "Failed to fetch connections"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!connections || connections.length === 0) {
      console.log(`[${requestId}] No active HubSpot connections found`);
      return new Response(JSON.stringify({
        message: "No active connections to sync",
        syncedCount: 0
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`[${requestId}] Found ${connections.length} active connections to sync`);
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    // Sync contacts for each connection
    for (const connection of connections){
      try {
        console.log(`[${requestId}] Syncing contacts for user ${connection.user_id}, clinic ${connection.clinic_id}`);
        // Create sync data object instead of parsing request body
        const syncData = {
          userId: connection.user_id,
          clinic_id: connection.clinic_id
        };
        const syncResponse = await handleSyncContacts(syncData, supabase, `${requestId}-${connection.user_id}`);
        if (syncResponse.status === 200) {
          successCount++;
          console.log(`[${requestId}] ✅ Successfully synced user ${connection.user_id}`);
        } else {
          errorCount++;
          const errorText = await syncResponse.text();
          errors.push({
            userId: connection.user_id,
            error: errorText
          });
          console.error(`[${requestId}] ❌ Failed to sync user ${connection.user_id}:`, errorText);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          userId: connection.user_id,
          error: error.message
        });
        console.error(`[${requestId}] ❌ Exception syncing user ${connection.user_id}:`, error.message);
      }
      // Add small delay between syncs to avoid rate limits
      await new Promise((resolve)=>setTimeout(resolve, 1000));
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
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(`[${requestId}] Cron job failed:`, error.message);
    return new Response(JSON.stringify({
      error: "Cron job failed",
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}
async function processOAuthCallback(req, requestId) {
  console.log(`[${requestId}] 🔄 Processing OAuth callback`);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const htmlHeaders = {
    "Content-Type": "text/html",
    ...corsHeaders
  };
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
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithError.toString()
      }
    });
  }
  if (!code || !state) {
    console.error(`[${requestId}] Missing parameters`, {
      hasCode: !!code,
      hasState: !!state
    });
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
    console.log(`[${requestId}] State decoded`, {
      userId: stateData.userId,
      clinic_id: stateData.clinic_id
    });
    // Get clinic_id from state instead of request body
    const clinic_id = stateData.clinic_id;
    if (!clinic_id) {
      console.error(`[${requestId}] Missing clinic_id in state`);
      throw new Error("Missing clinic_id in OAuth state");
    }
    // Exchange code for tokens
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
      console.error(`[${requestId}] Token exchange failed`, {
        status: tokenResponse.status,
        errorText
      });
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }
    const tokens = await tokenResponse.json();
    console.log(`[${requestId}] Tokens received`, {
      hasAccessToken: !!tokens.access_token
    });
    // Discover available properties (for debugging and mapping)
    await discoverHubSpotProperties(tokens.access_token, requestId);
    // Get account info
    const accountResponse = await fetch("https://api.hubapi.com/integrations/v1/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });
    let accountData = {
      companyName: "Unknown",
      portalId: "unknown"
    };
    if (accountResponse.ok) {
      accountData = await accountResponse.json();
    }
    // **UPDATED: Initial contacts sync with 120-day filter**
    let totalContacts = 0;
    const contacts = [];
    let after = null;
    // Filter for contacts created or modified in the last 120 days
    const afterDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`[${requestId}] Starting initial contacts sync for contacts newer than ${afterDate} (120 days)`);
    // Define all possible property names to fetch
    const propertiesToFetch = getHubSpotPropertiesToFetch();
    do {
      const searchBody = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "createdate",
                operator: "GTE",
                value: afterDate
              }
            ]
          },
          {
            filters: [
              {
                propertyName: "lastmodifieddate",
                operator: "GTE",
                value: afterDate
              }
            ]
          }
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
        console.error(`[${requestId}] Contacts search failed`, {
          status: contactsResponse.status
        });
        throw new Error(`Contacts search failed: ${contactsResponse.status}`);
      }
      const contactsData = await contactsResponse.json();
      totalContacts = contactsData.total || 0;
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    }while (after)
    console.log(`[${requestId}] Fetched ${contacts.length} contacts from last 120 days`);
    // Save contacts to lead table
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (contacts.length > 0) {
      // Fetch source_id for 'HubSpot'
      const { data: sourceData, error: sourceError } = await supabase.from('lead_source').select('id').eq('name', 'Hubspot').single();
      if (sourceError || !sourceData) {
        console.error(`[${requestId}] Error fetching lead source:`, sourceError);
        throw new Error("Could not find HubSpot in lead_source table");
      }
      const source_id = sourceData.id;
      console.log(`[${requestId}] Using clinic_id from state: ${clinic_id}`);
      const leadsToInsert = contacts.map((contact)=>{
        if (!contact.id) {
          console.warn(`[${requestId}] Contact missing ID`, {
            contact
          });
          return null;
        }
        return mapHubSpotContactToLead(contact, clinic_id, source_id);
      }).filter((lead)=>lead !== null);
      if (leadsToInsert.length === 0) {
        console.warn(`[${requestId}] No valid leads to insert`);
      } else {
        let retries = 3;
        let leadError = null;
        while(retries > 0){
          try {
            const { error } = await supabase.from("lead").upsert(leadsToInsert);
            if (error) {
              console.error(`[${requestId}] Lead save error`, {
                error: JSON.stringify(error),
                leadSample: leadsToInsert[0]
              });
              leadError = error;
              retries--;
              if (retries === 0) throw new Error(`Lead save failed after retries: ${JSON.stringify(error)}`);
              await new Promise((resolve)=>setTimeout(resolve, 1000));
              continue;
            }
            console.log(`[${requestId}] Successfully saved ${leadsToInsert.length} leads`);
            break;
          } catch (err) {
            console.error(`[${requestId}] Lead save attempt failed`, {
              error: err.message
            });
            leadError = err;
            retries--;
            if (retries === 0) throw new Error(`Lead save failed after retries: ${err.message}`);
            await new Promise((resolve)=>setTimeout(resolve, 1000));
          }
        }
        if (leadError) throw leadError;
      }
    }
    // Save connection details
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const { error: dbError } = await supabase.from("hubspot_connections").upsert({
      user_id: stateData.userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      account_name: accountData.companyName || `Hub ${accountData.portalId}`,
      contact_count: totalContacts,
      hub_id: accountData.portalId?.toString(),
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
      contactCount: totalContacts,
      dealCount: 0
    };
    const redirectUrl = stateData.redirectUrl || "http://localhost:3001/onboarding";
    const redirectUrlWithParams = new URL(redirectUrl);
    redirectUrlWithParams.searchParams.set("hubspot_status", "success");
    redirectUrlWithParams.searchParams.set("account_name", accountInfo.accountName);
    redirectUrlWithParams.searchParams.set("contact_count", accountInfo.contactCount.toString());
    redirectUrlWithParams.searchParams.set("user_id", stateData.userId);
    console.log(`[${requestId}] Redirecting to: ${redirectUrlWithParams.toString()}`);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrlWithParams.toString()
      }
    });
  } catch (error) {
    console.error(`[${requestId}] Callback processing error`, {
      error: error.message,
      stack: error.stack
    });
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
// Updated function signature to accept parsed body
async function handleAuthenticatedRequest(req, body, requestId) {
  console.log(`[${requestId}] Handling authenticated request`);
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({
      error: "Missing authorization header"
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");
  if (!supabaseUrl || !supabaseServiceKey || !clientId || !clientSecret || !redirectUri) {
    return new Response(JSON.stringify({
      error: "Configuration error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/sync-contacts')) {
      return await SyncContacts(supabase, requestId);
    }
    return await handleConnect(body, supabase, clientId, redirectUri, requestId);
  }
  if (req.method === "DELETE") {
    return await handleDisconnect(body, supabase, requestId);
  }
  return new Response(JSON.stringify({
    error: "Method not allowed"
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
// Updated function signature to accept parsed body directly
async function refreshHubSpotToken(refreshToken, supabase, userId, requestId) {
  console.log(`[${requestId}] Refreshing HubSpot token`);
  const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken
    })
  });
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error(`[${requestId}] Token refresh failed`, {
      status: tokenResponse.status,
      error: errorData
    });
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json();
  // Update the connection with new tokens
  const { error: updateError } = await supabase.from('hubspot_connections').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
  }).eq('user_id', userId);
  if (updateError) {
    console.error(`[${requestId}] Failed to update tokens`, updateError);
    throw new Error('Failed to save new tokens');
  }
  console.log(`[${requestId}] Token refreshed successfully`);
  return tokenData.access_token;
}
async function makeHubSpotRequest(url, options, accessToken, refreshToken, supabase, userId, requestId) {
  // First attempt with current token
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`
    }
  });
  // If unauthorized, try refreshing token and retry once
  if (response.status === 401) {
    console.log(`[${requestId}] Received 401, attempting token refresh`);
    try {
      const newAccessToken = await refreshHubSpotToken(refreshToken, supabase, userId, requestId);
      // Retry the request with new token
      return await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`
        }
      });
    } catch (refreshError) {
      console.error(`[${requestId}] Token refresh failed`, refreshError);
      return response; // Return original 401 response
    }
  }
  return response;
}


async function SyncContacts(supabase, requestId) {
  console.log(`[${requestId}] Handling contacts sync for all clinics`);

  // Fetch all active HubSpot connections with associated clinic data
  const { data: connections, error: connError } = await supabase
    .from("hubspot_connections")
    .select(`
      user_id,
      access_token,
      refresh_token,
      hub_id,
      last_sync_at,
      token_expires_at,
      clinic:clinic!hubspot_connections_user_id_fkey (
        id,
        owner_id
      )
    `)
    .eq("connection_status", "connected");

  if (connError || !connections || connections.length === 0) {
    console.error(`[${requestId}] Connection fetch error`, connError);
    return new Response(
      JSON.stringify({ error: "No active HubSpot connections found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results = [];
  
  // Process each connection/clinic pair
  for (const connection of connections) {
    const userId = connection.user_id;
    const clinic_id = connection.clinic?.id;
    
    if (!clinic_id) {
      console.warn(`[${requestId}] No clinic found for user ${userId}, skipping`);
      continue;
    }

    let accessToken = connection.access_token;
    const refreshToken = connection.refresh_token;

    if (!refreshToken) {
      console.warn(`[${requestId}] No refresh token for user ${userId}, skipping`);
      results.push({
        userId,
        clinic_id,
        success: false,
        message: "No refresh token available. Please reconnect HubSpot."
      });
      continue;
    }

    // Check if token is expired and refresh proactively
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt && expiresAt < fiveMinutesFromNow) {
      console.log(`[${requestId}] Token expires soon for user ${userId}, refreshing proactively`);
      try {
        accessToken = await refreshHubSpotToken(refreshToken, supabase, userId, requestId);
      } catch (error) {
        console.error(`[${requestId}] Proactive token refresh failed for user ${userId}`, error);
        results.push({
          userId,
          clinic_id,
          success: false,
          message: "Failed to refresh access token. Please reconnect HubSpot."
        });
        continue;
      }
    }

    // Fetch contacts from last 15 minutes
    const afterDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const contacts = [];
    let after = null;

    console.log(`[${requestId}] Fetching contacts for user ${userId} modified since ${afterDate}`);

    const propertiesToFetch = getHubSpotPropertiesToFetch();

    do {
      const searchBody = {
        filterGroups: [{
          filters: [{
            propertyName: "lastmodifieddate",
            operator: "GTE",
            value: afterDate,
          }],
        }],
        properties: propertiesToFetch,
        limit: 100,
        after: after || undefined,
      };

      try {
        const contactsResponse = await makeHubSpotRequest(
          "https://api.hubapi.com/crm/v3/objects/contacts/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(searchBody),
          },
          accessToken,
          refreshToken,
          supabase,
          userId,
          requestId
        );

        if (!contactsResponse.ok) {
          const errorText = await contactsResponse.text();
          console.error(`[${requestId}] Contacts search failed for user ${userId}`, {
            status: contactsResponse.status,
            error: errorText
          });
          results.push({
            userId,
            clinic_id,
            success: false,
            message: `Failed to fetch contacts: ${contactsResponse.status}`
          });
          break;
        }

        const contactsData = await contactsResponse.json();
        contacts.push(...contactsData.results);
        after = contactsData.paging?.next?.after || null;
      } catch (error) {
        console.error(`[${requestId}] Error during contacts fetch for user ${userId}`, error);
        results.push({
          userId,
          clinic_id,
          success: false,
          message: "Network error while fetching contacts"
        });
        break;
      }
    } while (after);

    console.log(`[${requestId}] Fetched ${contacts.length} contacts for user ${userId}`);

    // Save contacts to lead table
    if (contacts.length > 0) {
      const { data: sourceData, error: sourceError } = await supabase
        .from('lead_source')
        .select('id')
        .eq('name', 'Hubspot')
        .single();

      if (sourceError || !sourceData) {
        console.error(`[${requestId}] Error fetching lead source for user ${userId}`, sourceError);
        results.push({
          userId,
          clinic_id,
          success: false,
          message: "Could not find HubSpot in lead_source table"
        });
        continue;
      }

      const source_id = sourceData.id;

      const leadsToInsert = contacts
        .map((contact) => {
          if (!contact.id) {
            console.warn(`[${requestId}] Contact missing ID for user ${userId}`, { contact });
            return null;
          }
          return mapHubSpotContactToLead(contact, clinic_id, source_id);
        })
        .filter(lead => lead !== null);

      if (leadsToInsert.length === 0) {
        console.warn(`[${requestId}] No valid leads to insert for user ${userId}`);
      } else {
        let retries = 3;
        let leadError = null;
        while (retries > 0) {
          try {
            const { error } = await supabase
              .from("lead")
              .upsert(leadsToInsert);

            if (error) {
              console.error(`[${requestId}] Lead save error for user ${userId}`, {
                error: JSON.stringify(error),
                leadSample: leadsToInsert[0]
              });
              leadError = error;
              retries--;
              if (retries === 0) throw new Error(`Lead save failed after retries: ${JSON.stringify(error)}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            console.log(`[${requestId}] Successfully saved ${leadsToInsert.length} leads for user ${userId}`);
            break;
          } catch (err) {
            console.error(`[${requestId}] Lead save attempt failed for user ${userId}`, { error: err.message });
            leadError = err;
            retries--;
            if (retries === 0) throw new Error(`Lead save failed after retries: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        if (leadError) {
          results.push({
            userId,
            clinic_id,
            success: false,
            message: `Failed to save leads for user ${userId}`
          });
          continue;
        }
      }
    }

    // Update last_sync_at
    const { error: updateError } = await supabase
      .from("hubspot_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      console.error(`[${requestId}] Update last_sync_at error for user ${userId}`, updateError);
    }

    results.push({
      userId,
      clinic_id,
      success: true,
      message: `Synced ${contacts.length} leads`,
      contactCount: contacts.length
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      results,
      totalClinicsProcessed: connections.length
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}


async function handleSyncContacts(body, supabase, requestId) {
  console.log(`[${requestId}] Handling contacts sync`);
  const { userId, clinic_id } = body;
  console.log("data is ", userId, clinic_id);
  if (!userId) {
    return new Response(JSON.stringify({
      error: "Missing userId"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // Get connection details - FIXED: Added missing fields
  const { data: connection, error: connError } = await supabase.from("hubspot_connections").select("access_token, refresh_token, hub_id, last_sync_at, token_expires_at").eq("user_id", userId).limit(1).single();
  if (connError || !connection) {
    console.error(`[${requestId}] Connection fetch error`, connError);
    return new Response(JSON.stringify({
      error: "No active HubSpot connection found"
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  let accessToken = connection.access_token;
  const refreshToken = connection.refresh_token;
  if (!refreshToken) {
    return new Response(JSON.stringify({
      error: "No refresh token available. Please reconnect HubSpot."
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // Check if token is expired and refresh proactively
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  if (expiresAt && expiresAt < fiveMinutesFromNow) {
    console.log(`[${requestId}] Token expires soon, refreshing proactively`);
    try {
      accessToken = await refreshHubSpotToken(refreshToken, supabase, userId, requestId);
    } catch (error) {
      console.error(`[${requestId}] Proactive token refresh failed`, error);
      return new Response(JSON.stringify({
        error: "Failed to refresh access token. Please reconnect HubSpot."
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
  // Fetch contacts from last 15 minutes (as per your current setting)
  const afterDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const contacts = [];
  let after = null;
  console.log(`[${requestId}] Fetching contacts modified since ${afterDate} (15 minutes ago)`);
  // Define all possible property names to fetch
  const propertiesToFetch = getHubSpotPropertiesToFetch();
  do {
    const searchBody = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: afterDate
            }
          ]
        }
      ],
      properties: propertiesToFetch,
      limit: 100,
      after: after || undefined
    };
    try {
      const contactsResponse = await makeHubSpotRequest("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(searchBody)
      }, accessToken, refreshToken, supabase, userId, requestId);
      if (!contactsResponse.ok) {
        const errorText = await contactsResponse.text();
        console.error(`[${requestId}] Contacts search failed`, {
          status: contactsResponse.status,
          error: errorText
        });
        return new Response(JSON.stringify({
          error: `Failed to fetch contacts: ${contactsResponse.status}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const contactsData = await contactsResponse.json();
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    } catch (error) {
      console.error(`[${requestId}] Error during contacts fetch`, error);
      return new Response(JSON.stringify({
        error: "Network error while fetching contacts"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }while (after)
  console.log(`[${requestId}] Fetched ${contacts.length} contacts modified in last 15 minutes`);
  // Save contacts to lead table
  if (contacts.length > 0) {
    const { data: sourceData, error: sourceError } = await supabase.from('lead_source').select('id').eq('name', 'Hubspot').single();
    if (sourceError || !sourceData) {
      console.error(`[${requestId}] Error fetching lead source:`, sourceError);
      return new Response(JSON.stringify({
        error: "Could not find HubSpot in lead_source table"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const source_id = sourceData.id;
    const leadsToInsert = contacts.map((contact)=>{
      if (!contact.id) {
        console.warn(`[${requestId}] Contact missing ID`, {
          contact
        });
        return null;
      }
      return mapHubSpotContactToLead(contact, clinic_id, source_id);
    }).filter((lead)=>lead !== null);
    if (leadsToInsert.length === 0) {
      console.warn(`[${requestId}] No valid leads to insert`);
    } else {
      let retries = 3;
      let leadError = null;
      while(retries > 0){
        try {
          const { error } = await supabase.from("lead").upsert(leadsToInsert);
          if (error) {
            console.error(`[${requestId}] Lead save error`, {
              error: JSON.stringify(error),
              leadSample: leadsToInsert[0]
            });
            leadError = error;
            retries--;
            if (retries === 0) throw new Error(`Lead save failed after retries: ${JSON.stringify(error)}`);
            await new Promise((resolve)=>setTimeout(resolve, 1000));
            continue;
          }
          console.log(`[${requestId}] Successfully saved ${leadsToInsert.length} leads`);
          break;
        } catch (err) {
          console.error(`[${requestId}] Lead save attempt failed`, {
            error: err.message
          });
          leadError = err;
          retries--;
          if (retries === 0) throw new Error(`Lead save failed after retries: ${err.message}`);
          await new Promise((resolve)=>setTimeout(resolve, 1000));
        }
      }
      if (leadError) throw leadError;
    }
  }
  // Update last_sync_at
  const { error: updateError } = await supabase.from("hubspot_connections").update({
    last_sync_at: new Date().toISOString()
  }).eq("user_id", userId);
  if (updateError) {
    console.error(`[${requestId}] Update last_sync_at error`, updateError);
  }
  return new Response(JSON.stringify({
    success: true,
    message: `Synced ${contacts.length} leads`,
    contactCount: contacts.length
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function createErrorHtml(title, message) {
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
// Updated function signature to accept parsed body directly
async function handleConnect(body, supabase, clientId, redirectUri, requestId) {
  console.log(`[${requestId}] Connect handler`);
  const { userId, redirectUrl, clinic_id } = body; // Extract clinic_id here
  if (!userId || !redirectUrl) {
    return new Response(JSON.stringify({
      error: "Missing userId or redirectUrl"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // Update database
  await supabase.from("hubspot_connections").upsert({
    user_id: userId,
    connection_status: "connecting",
    error_message: null
  });
  // Create auth URL with clinic_id included in state
  const state = btoa(JSON.stringify({
    userId,
    redirectUrl,
    clinic_id,
    timestamp: Date.now()
  }));
  const scopes = [
    "crm.objects.contacts.read",
    "crm.objects.leads.read"
  ].join(" ");
  const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  return new Response(JSON.stringify({
    authUrl: authUrl.toString()
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
// Updated function signature to accept parsed body directly
async function handleDisconnect(body, supabase, requestId) {
  console.log(`[${requestId}] Disconnect handler`);
  const { userId } = body;
  if (!userId) {
    return new Response(JSON.stringify({
      error: "Missing userId"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // Update database
  await supabase.from("hubspot_connections").update({
    connection_status: "disconnected",
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    error_message: null,
    first_sync_completed: false
  }).eq("user_id", userId);
  return new Response(JSON.stringify({
    success: true,
    message: "Successfully disconnected from HubSpot"
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
