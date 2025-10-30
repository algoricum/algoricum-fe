// supabase/functions/_shared/hubspot-service.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chunkArray, enqueueLead } from "./Lead-enqueue.ts";
import { cleanHubSpotContacts } from "./gpt-extractor-service.ts";

// Environment variables at top level
const HUBSPOT_CLIENT_ID = Deno.env.get("HUBSPOT_CLIENT_ID");
const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET");
const HUBSPOT_REDIRECT_URI = Deno.env.get("HUBSPOT_REDIRECT_URI");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL");

// Helper function to get HubSpot integration ID
async function getHubSpotIntegrationId(supabase: any): Promise<string> {
  const { data: integration, error } = await supabase.from("integrations").select("id").eq("name", "Hubspot").single();

  if (error || !integration) {
    throw new Error("HubSpot integration not found in integrations table");
  }

  return integration.id;
}

async function getHubSpotConnection(supabase: any, clinic_id: string, integrationId: string) {
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("auth_data, expires_at, updated_at, clinic_id")
    .eq("clinic_id", clinic_id)
    .eq("integration_id", integrationId)
    .eq("status", "active")
    .limit(1)
    .single();

  return { connection, error };
}

async function getHubSpotAuthData(supabase: any, clinic_id: string, integrationId: string) {
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("auth_data")
    .eq("clinic_id", clinic_id)
    .eq("integration_id", integrationId)
    .single();

  return { authData: connection?.auth_data || {}, error };
}

async function updateHubSpotConnection(supabase: any, clinic_id: string, integrationId: string, updates: any) {
  const { error } = await supabase
    .from("integration_connections")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinic_id)
    .eq("integration_id", integrationId);

  return { error };
}

async function getAllConnectedClinics(supabase: any, integrationId: string) {
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("clinic_id")
    .eq("integration_id", integrationId)
    .eq("status", "active");

  return { connections, error };
}

async function processHubSpotContacts(contacts: any[], clinic_id: string, supabase: any, requestId: string) {
  if (contacts.length === 0) {
    console.log(`[${requestId}] No contacts to process for clinic ${clinic_id}`);
    return { success: true, processedCount: 0 };
  }

  const { data: sourceData, error: sourceError } = await supabase.from("lead_source").select("id").eq("name", "Hubspot").single();

  if (sourceError || !sourceData) {
    console.error(`[${requestId}] Error fetching lead source for clinic ${clinic_id}:`, sourceError);
    throw new Error("Could not find HubSpot in lead_source table");
  }

  const source_id = sourceData.id;

  // Clean contacts with GPT before processing
  const cleanedContacts = await cleanHubSpotContacts(contacts, requestId);

  const leadsToInsert = cleanedContacts
    .map(contact => ({
      clinic_id,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      status: "New",
      source_id,
    }))
    .filter(lead => lead.email || lead.phone);

  if (leadsToInsert.length === 0) {
    console.warn(`[${requestId}] No valid leads to insert for clinic ${clinic_id}`);
    return { success: true, processedCount: 0 };
  }

  try {
    // Use the queue system to process leads
    const chunks = chunkArray(leadsToInsert, 50); // Process in chunks of 50
    console.log(`[${requestId}] Enqueuing ${leadsToInsert.length} leads in ${chunks.length} chunks for clinic ${clinic_id}`);

    for (const chunk of chunks) {
      await enqueueLead(chunk, clinic_id);
    }

    console.log(`[${requestId}] Successfully enqueued ${leadsToInsert.length} leads for clinic ${clinic_id}`);
    return { success: true, processedCount: leadsToInsert.length };
  } catch (err) {
    console.error(`[${requestId}] Lead enqueue failed for clinic ${clinic_id}`, { error: err.message });
    throw new Error(`Lead enqueue failed for clinic ${clinic_id}: ${err.message}`);
  }
}

// Property mapping configuration
export function getHubSpotPropertiesToFetch() {
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
    "custom_phone",
  ];
}

export async function discoverHubSpotProperties(accessToken: string, requestId: string) {
  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      const properties = data.results.map((prop: any) => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        fieldType: prop.fieldType,
      }));
      console.log(`[${requestId}] Available HubSpot properties:`, properties);
      return properties;
    }
  } catch (error) {
    console.warn(`[${requestId}] Could not fetch HubSpot properties:`, error.message);
  }
  return [];
}

export async function refreshHubSpotToken(refreshToken: string, supabase: any, clinic_id: string, requestId: string) {
  console.log(`[${requestId}] Refreshing HubSpot token for clinic ${clinic_id}`);
  const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HUBSPOT_CLIENT_ID!,
      client_secret: HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error(`[${requestId}] Token refresh failed for clinic ${clinic_id}`, { status: tokenResponse.status, error: errorData });
    throw new Error(`Token refresh failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  const integrationId = await getHubSpotIntegrationId(supabase);

  // Get current auth_data to preserve other fields
  const { authData: currentAuthData } = await getHubSpotAuthData(supabase, clinic_id, integrationId);

  const updatedAuthData = {
    ...currentAuthData,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  };

  const { error: updateError } = await updateHubSpotConnection(supabase, clinic_id, integrationId, {
    auth_data: updatedAuthData,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  });

  if (updateError) {
    console.error(`[${requestId}] Failed to update tokens for clinic ${clinic_id}`, updateError);
    throw new Error("Failed to save new tokens");
  }

  console.log(`[${requestId}] Token refreshed successfully for clinic ${clinic_id}`);
  return tokenData.access_token;
}

export async function makeHubSpotRequest(
  url: string,
  options: any,
  accessToken: string,
  refreshToken: string,
  supabase: any,
  clinic_id: string,
  requestId: string,
) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    console.log(`[${requestId}] Received 401 for clinic ${clinic_id}, attempting token refresh`);
    try {
      const newAccessToken = await refreshHubSpotToken(refreshToken, supabase, clinic_id, requestId);
      return await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newAccessToken}` },
      });
    } catch (refreshError) {
      console.error(`[${requestId}] Token refresh failed for clinic ${clinic_id}`, refreshError);
      return response;
    }
  }
  return response;
}

export async function syncAllConnections(requestId: string) {
  console.log(`[${requestId}] 🔄 Processing sync for all HubSpot connections`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[${requestId}] Missing Supabase environment variables`);
    throw new Error("Configuration error - Missing Supabase environment variables");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const integrationId = await getHubSpotIntegrationId(supabase);

  const { data: connections, error: connError } = await supabase
    .from("integration_connections")
    .select("clinic_id, auth_data, expires_at, updated_at")
    .eq("integration_id", integrationId)
    .eq("status", "active")
    .not("auth_data->access_token", "is", null)
    .not("auth_data->refresh_token", "is", null);

  if (connError) {
    console.error(`[${requestId}] Failed to fetch connections:`, connError);
    throw new Error("Failed to fetch connections");
  }

  if (!connections || connections.length === 0) {
    console.log(`[${requestId}] No active HubSpot connections found`);
    return {
      success: true,
      message: "No active connections to sync",
      syncedCount: 0,
      totalConnections: 0,
      successCount: 0,
      errorCount: 0,
      timestamp: new Date().toISOString(),
    };
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
      const syncResult = await syncContactsForClinic(syncData, `${requestId}-${clinic_id}`);
      if (syncResult.success) {
        successCount++;
      } else {
        errorCount++;
        errors.push({ clinic_id, error: syncResult.error });
        console.error(`[${requestId}] ❌ Failed to sync clinic ${clinic_id}:`, syncResult.error);
      }
    } catch (error) {
      errorCount++;
      errors.push({ clinic_id, error: error.message });
      console.error(`[${requestId}] ❌ Exception syncing clinic ${clinic_id}:`, error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const summary = {
    success: true,
    totalConnections: connections.length,
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  };

  console.log(`[${requestId}] ✅ Cron job completed:`, summary);
  return summary;
}

export async function processOAuthCallback(code: string, state: string, error?: string, requestId?: string) {
  const reqId = requestId || crypto.randomUUID();
  console.log(`[${reqId}] 🔄 Processing OAuth callback`);

  if (error) {
    console.error(`[${reqId}] OAuth error: ${error}`);
    let redirectUrl = FRONTEND_URL || "http://localhost:3000";
    try {
      if (state) {
        const stateData = JSON.parse(atob(state));
        redirectUrl = stateData.redirectUrl || redirectUrl;
      }
    } catch (e) {
      console.error("Could not parse state for OAuth error redirect", e);
    }
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", `OAuth error: ${error}`);

    return {
      success: false,
      redirectUrl: redirectUrlWithError.toString(),
      error: `OAuth error: ${error}`,
    };
  }

  if (!code || !state) {
    console.error(`[${reqId}] Missing parameters`, { hasCode: !!code, hasState: !!state });
    const redirectUrl = FRONTEND_URL || "http://localhost:3001";
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", "Missing code or state parameter");

    return {
      success: false,
      redirectUrl: redirectUrlWithError.toString(),
      error: "Missing code or state parameter",
    };
  }

  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET || !HUBSPOT_REDIRECT_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[${reqId}] Missing environment variables`);
    return {
      success: false,
      error: "Configuration Error - Missing environment variables",
    };
  }

  try {
    const stateData = JSON.parse(atob(state));
    console.log(`[${reqId}] State decoded`, { clinic_id: stateData.clinic_id });
    const clinic_id = stateData.clinic_id;
    if (!clinic_id) {
      console.error(`[${reqId}] Missing clinic_id in state`);
      throw new Error("Missing clinic_id in OAuth state");
    }

    console.log(`[${reqId}] Exchanging code for tokens`);
    const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[${reqId}] Token exchange failed`, { status: tokenResponse.status, errorText });
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log(`[${reqId}] Tokens received`, { hasAccessToken: !!tokens.access_token });

    await discoverHubSpotProperties(tokens.access_token, reqId);

    const accountResponse = await fetch("https://api.hubapi.com/integrations/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let accountData = { companyName: "Unknown", portalId: "unknown" };
    if (accountResponse.ok) {
      accountData = await accountResponse.json();
    }

    const afterDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`[${reqId}] Starting initial contacts sync for contacts newer than ${afterDate} (120 days)`);
    const propertiesToFetch = getHubSpotPropertiesToFetch();
    const contacts = [];
    let after: string | null = null;

    do {
      const searchBody = {
        filterGroups: [
          { filters: [{ propertyName: "createdate", operator: "GTE", value: afterDate }] },
          { filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: afterDate }] },
        ],
        properties: propertiesToFetch,
        limit: 100,
        after: after || undefined,
      };

      const contactsResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      });

      if (!contactsResponse.ok) {
        console.error(`[${reqId}] Contacts search failed`, { status: contactsResponse.status });
        throw new Error(`Contacts search failed: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    } while (after);

    console.log(`[${reqId}] Fetched ${contacts.length} contacts from last 120 days`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log(`[${reqId}] Using clinic_id from state: ${clinic_id}`);

    // Process contacts using shared function
    await processHubSpotContacts(contacts, clinic_id, supabase, reqId);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const integrationId = await getHubSpotIntegrationId(supabase);

    const authData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      account_name: accountData.companyName || `Hub ${accountData.portalId}`,
      contact_count: contacts.length,
      hub_id: accountData.portalId?.toString(),
      scope: ["crm.objects.contacts.read"].join(" "),
    };

    const { error: dbError } = await supabase.from("integration_connections").upsert({
      clinic_id,
      integration_id: integrationId,
      auth_data: authData,
      expires_at: expiresAt.toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error(`[${reqId}] Database error`, dbError);
      throw new Error(`Connection save failed: ${JSON.stringify(dbError)}`);
    }

    console.log(`[${reqId}] ✅ Success - Connection saved and initial sync completed (120-day filter)`);
    const accountInfo = {
      accountName: accountData.companyName || `Hub ${accountData.portalId}`,
      contactCount: contacts.length,
      dealCount: 0,
    };

    const redirectUrl = stateData.redirectUrl || FRONTEND_URL || "http://localhost:3001";
    const redirectUrlWithParams = new URL(redirectUrl);
    redirectUrlWithParams.searchParams.set("hubspot_status", "success");
    redirectUrlWithParams.searchParams.set("account_name", accountInfo.accountName);
    redirectUrlWithParams.searchParams.set("contact_count", accountInfo.contactCount.toString());
    redirectUrlWithParams.searchParams.set("clinic_id", stateData.clinic_id);

    console.log(`[${reqId}] Redirecting to: ${redirectUrlWithParams.toString()}`);
    return {
      success: true,
      redirectUrl: redirectUrlWithParams.toString(),
      accountInfo,
    };
  } catch (error) {
    console.error(`[${reqId}] Callback processing error`, { error: error.message, stack: error.stack });
    let redirectUrl = FRONTEND_URL || "http://localhost:3001";
    try {
      const stateData = JSON.parse(atob(state));
      redirectUrl = stateData.redirectUrl || redirectUrl;
    } catch (e) {
      console.error("Could not parse state for error redirect", e);
    }
    const redirectUrlWithError = new URL(redirectUrl);
    redirectUrlWithError.searchParams.set("hubspot_status", "error");
    redirectUrlWithError.searchParams.set("error_message", error.message);

    console.log(`[${reqId}] Redirecting with error to: ${redirectUrlWithError.toString()}`);
    return {
      success: false,
      redirectUrl: redirectUrlWithError.toString(),
      error: error.message,
    };
  }
}

export async function syncContactsForClinic(body: any, requestId: string) {
  console.log(`[${requestId}] Handling contacts sync for a single connection`);
  const { clinic_id } = body;
  if (!clinic_id) {
    return {
      success: false,
      error: "Missing clinic_id",
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      error: "Configuration error - Missing Supabase environment variables",
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const integrationId = await getHubSpotIntegrationId(supabase);

  // Fetch connection details including clinic_id
  const { connection, error: connError } = await getHubSpotConnection(supabase, clinic_id, integrationId);

  if (connError || !connection) {
    console.error(`[${requestId}] Connection fetch error for clinic ${clinic_id}`, connError);
    return {
      success: false,
      error: "No active HubSpot connection found",
    };
  }

  let accessToken = connection.auth_data?.access_token;
  const refreshToken = connection.auth_data?.refresh_token;
  if (!refreshToken) {
    return {
      success: false,
      error: "No refresh token available. Please reconnect HubSpot.",
    };
  }

  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt && expiresAt < fiveMinutesFromNow) {
    console.log(`[${requestId}] Token expires soon for clinic ${clinic_id}, refreshing proactively`);
    try {
      accessToken = await refreshHubSpotToken(refreshToken, supabase, clinic_id, requestId);
    } catch (error) {
      console.error(`[${requestId}] Proactive token refresh failed for clinic ${clinic_id}`, error);
      return {
        success: false,
        error: "Failed to refresh access token. Please reconnect HubSpot.",
      };
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
      after: after || undefined,
    };

    try {
      const contactsResponse = await makeHubSpotRequest(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(searchBody),
        },
        accessToken,
        refreshToken,
        supabase,
        clinic_id,
        requestId,
      );

      if (!contactsResponse.ok) {
        const errorText = await contactsResponse.text();
        console.error(`[${requestId}] Contacts search failed for clinic ${clinic_id}`, {
          status: contactsResponse.status,
          error: errorText,
        });
        return {
          success: false,
          error: `Failed to fetch contacts: ${contactsResponse.status}`,
        };
      }

      const contactsData = await contactsResponse.json();
      contacts.push(...contactsData.results);
      after = contactsData.paging?.next?.after || null;
    } catch (error) {
      console.error(`[${requestId}] Error during contacts fetch for clinic ${clinic_id}`, error);
      return {
        success: false,
        error: "Network error while fetching contacts",
      };
    }
  } while (after);

  console.log(`[${requestId}] Fetched ${contacts.length} contacts modified in last 15 minutes for clinic ${clinic_id}`);

  // Process contacts using shared function
  await processHubSpotContacts(contacts, clinic_id, supabase, requestId);

  const updatedAuthData = {
    ...connection.auth_data,
    contact_count: contacts.length,
  };

  const { error: updateError } = await updateHubSpotConnection(supabase, clinic_id, integrationId, {
    auth_data: updatedAuthData,
  });

  if (updateError) {
    console.error(`[${requestId}] Update last_sync_at error for clinic ${clinic_id}`, updateError);
  }

  return {
    success: true,
    message: `Synced ${contacts.length} leads for clinic ${clinic_id}`,
    contactCount: contacts.length,
  };
}

export async function syncAllClinicContacts(authHeader: string, requestId: string) {
  console.log(`[${requestId}] Handling sync for all connected clinics`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !HUBSPOT_REDIRECT_URI) {
    return {
      success: false,
      error: "Configuration error - Missing environment variables",
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const integrationId = await getHubSpotIntegrationId(supabase);

  // Get all connected clinic IDs
  const { connections, error: connError } = await getAllConnectedClinics(supabase, integrationId);

  if (connError || !connections || connections.length === 0) {
    return {
      success: false,
      error: "No active connections found",
    };
  }

  const results = [];
  for (const connection of connections) {
    const syncBody = {
      clinic_id: connection.clinic_id,
      redirectUri: HUBSPOT_REDIRECT_URI,
    };
    try {
      const result = await syncContactsForClinic(syncBody, `${requestId}-${connection.clinic_id}`);
      results.push({ clinic_id: connection.clinic_id, ...result });
    } catch (error) {
      results.push({ clinic_id: connection.clinic_id, success: false, error: error.message });
    }
  }

  return {
    success: true,
    message: `Synced contacts for ${connections.length} clinics`,
    results,
  };
}

export function createErrorHtml(title: string, message: string) {
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

export function createTestSuccessHtml() {
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

export async function initializeOAuth(redirectUrl: string, clinic_id: string, requestId: string) {
  console.log(`[${requestId}] Connect handler`);

  if (!redirectUrl || !clinic_id) {
    return {
      success: false,
      error: "Missing redirectUrl or clinic_id",
    };
  }

  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      error: "Configuration error - Missing environment variables",
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const integrationId = await getHubSpotIntegrationId(supabase);

  await supabase.from("integration_connections").upsert({
    clinic_id,
    integration_id: integrationId,
    status: "pending",
    auth_data: {},
    updated_at: new Date().toISOString(),
  });

  const state = btoa(JSON.stringify({ redirectUrl, clinic_id, timestamp: Date.now() }));
  const scopes = ["crm.objects.contacts.read"].join(" ");
  const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
  authUrl.searchParams.set("client_id", HUBSPOT_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", HUBSPOT_REDIRECT_URI);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return {
    success: true,
    authUrl: authUrl.toString(),
  };
}

export async function disconnectConnection(clinic_id: string, requestId: string) {
  console.log(`[${requestId}] Disconnect handler`);

  if (!clinic_id) {
    return {
      success: false,
      error: "Missing clinic_id",
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      error: "Configuration error - Missing Supabase environment variables",
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const integrationId = await getHubSpotIntegrationId(supabase);

  await updateHubSpotConnection(supabase, clinic_id, integrationId, {
    status: "inactive",
    auth_data: {},
    expires_at: null,
  });

  return {
    success: true,
    message: "Successfully disconnected from HubSpot",
  };
}
