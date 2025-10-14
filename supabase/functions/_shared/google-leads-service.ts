import { supabase } from "./supabaseClient.ts";

const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

/**
 * Step 0 - Start OAuth Flow
 */
export async function startAuth(clinic_id: string, redirectTo: string) {
  console.log(`[OAUTH_START] Starting OAuth flow for clinic: ${clinic_id}`);
  console.log(`[OAUTH_START] Redirect URL: ${redirectTo}`);

  if (!clinic_id) {
    console.error(`[OAUTH_START] Missing clinic_id parameter`);
    throw new Error("Missing clinic_id");
  }

  const state = encodeURIComponent(`${clinic_id}|${redirectTo}`);
  const scopes = ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/userinfo.email"].join(" ");

  console.log(`[OAUTH_START] Generated state: ${state}`);
  console.log(`[OAUTH_START] Requested scopes: ${scopes}`);

  const redirectUri = new URL(redirectTo).origin + "/redirect-lead";
  console.log(`[OAUTH_START] Computed redirect URI: ${redirectUri}`);

  const authParams = {
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    state: state,
    prompt: "consent",
  };

  console.log(`[OAUTH_START] OAuth parameters:`, authParams);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(authParams).toString()}`;
  console.log(`[OAUTH_START] Generated auth URL: ${authUrl}`);

  return { auth_url: authUrl };
}

/**
 * Step 1 - Handle OAuth Callback
 */
export async function handleOAuthCallback(code: string, clinic_id: string, redirectTo: any) {
  console.log(`[OAUTH_CALLBACK] Processing OAuth callback`);
  console.log(`[OAUTH_CALLBACK] Clinic ID: ${clinic_id}`);
  console.log(`[OAUTH_CALLBACK] Code present: ${!!code}`);
  console.log(`[OAUTH_CALLBACK] Redirect to: ${redirectTo}`);

  if (!code || !clinic_id) {
    console.error(`[OAUTH_CALLBACK] Missing required parameters - code: ${!!code}, clinic_id: ${!!clinic_id}`);
    throw new Error("Missing code or clinic_id");
  }

  // Get Supabase client
  const { supabase } = await import("./supabaseClient.ts");

  // Exchange code for tokens
  const redirectUri = new URL(redirectTo).origin + "/redirect-lead";
  console.log(`[OAUTH_CALLBACK] Token exchange redirect URI: ${redirectUri}`);

  const tokenParams = {
    code,
    client_id: googleClientId,
    client_secret: googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  console.log(`[OAUTH_CALLBACK] Token exchange parameters:`, {
    ...tokenParams,
    client_secret: `${googleClientSecret.substring(0, 10)}...`,
    code: `${code.substring(0, 20)}...`,
  });

  console.log(`[OAUTH_CALLBACK] Making token exchange request...`);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenParams),
  });

  console.log(`[OAUTH_CALLBACK] Token exchange response status: ${tokenRes.status}`);

  const tokens = await tokenRes.json();
  console.log(`[OAUTH_CALLBACK] Token response:`, {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type,
    scope: tokens.scope,
    error: tokens.error,
  });

  if (tokens.error) {
    console.error(`[OAUTH_CALLBACK] Token exchange error:`, {
      error: tokens.error,
      errorDescription: tokens.error_description,
    });
    throw new Error(tokens.error_description);
  }

  const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  console.log(`[OAUTH_CALLBACK] Token expiry date: ${expiryDate}`);

  // Get Google Lead Forms integration
  console.log(`[OAUTH_CALLBACK] Looking up Google Lead Forms integration`);
  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("id")
    .eq("name", "Google Lead Forms")
    .single();

  if (integrationError || !integration) {
    console.error(`[OAUTH_CALLBACK] Google Lead Forms integration not found:`, integrationError);
    throw new Error("Google Lead Forms integration not found");
  }

  console.log(`[OAUTH_CALLBACK] Found integration ID: ${integration.id}`);

  const connectionData = {
    clinic_id,
    integration_id: integration.id,
    status: "active",
    expires_at: expiryDate,
    auth_data: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiryDate,
      scope: tokens.scope,
      token_type: tokens.token_type,
      // We'll need to add google_customer_id later when the user provides it
      // or when we can extract it from the Google Ads API
      needs_customer_id_setup: true,
    },
  };

  console.log(`[OAUTH_CALLBACK] Upserting connection data:`, {
    clinic_id: connectionData.clinic_id,
    integration_id: connectionData.integration_id,
    status: connectionData.status,
    expires_at: connectionData.expires_at,
    auth_data_keys: Object.keys(connectionData.auth_data),
  });

  const { data: connectionResult, error } = await supabase
    .from("integration_connections")
    .upsert(connectionData, { onConflict: "clinic_id,integration_id" })
    .select()
    .single();

  if (error) {
    console.error(`[OAUTH_CALLBACK] Database upsert error:`, error);
    throw new Error(error.message);
  }

  console.log(`[OAUTH_CALLBACK] Successfully stored connection for clinic: ${clinic_id}`, {
    connection_id: connectionResult.id,
    status: connectionResult.status,
  });

  // Automatically fetch accounts and lead forms after OAuth success
  console.log(`[OAUTH_CALLBACK] Auto-fetching accounts and lead forms...`);
  try {
    await fetchAccountsAndLeadForms(connectionResult.id, supabase);
    console.log(`[OAUTH_CALLBACK] Successfully auto-fetched accounts and forms`);
  } catch (error) {
    console.error(`[OAUTH_CALLBACK] Error auto-fetching accounts and forms:`, error);
    // Don't fail the OAuth if this fails - user can manually fetch later
  }

  return redirectTo;
}

/**
 * Step 2 - Insert or Update Lead into Supabase
 */
export async function insertLead(clinic_id: string, body: any) {
  console.log(`[LEAD_INSERT] Processing lead insertion for clinic: ${clinic_id}`);
  console.log(`[LEAD_INSERT] Webhook body structure:`, {
    hasLeadFormSubmissionData: !!body.leadFormSubmissionData,
    hasFieldValues: !!body.leadFormSubmissionData?.fieldValues,
    fieldValuesCount: body.leadFormSubmissionData?.fieldValues?.length || 0,
    bodyKeys: Object.keys(body || {}),
  });

  const leadData = body.leadFormSubmissionData?.fieldValues || [];
  console.log(`[LEAD_INSERT] Field values:`, leadData);

  let first_name = "";
  let last_name = "";
  let email = "";
  let phone = "";

  console.log(`[LEAD_INSERT] Processing ${leadData.length} form fields`);

  for (let i = 0; i < leadData.length; i++) {
    const field = leadData[i];
    const name = field.fieldName?.toLowerCase();
    const value = field.stringValue || "";

    console.log(`[LEAD_INSERT] Field ${i + 1}: ${name} = ${value}`);

    if (name?.includes("first")) {
      first_name = value;
      console.log(`[LEAD_INSERT] Mapped first name: ${first_name}`);
    } else if (name?.includes("last")) {
      last_name = value;
      console.log(`[LEAD_INSERT] Mapped last name: ${last_name}`);
    } else if (name?.includes("email")) {
      email = value;
      console.log(`[LEAD_INSERT] Mapped email: ${email}`);
    } else if (name?.includes("phone")) {
      phone = value;
      console.log(`[LEAD_INSERT] Mapped phone: ${phone}`);
    }
  }

  console.log(`[LEAD_INSERT] Extracted lead data:`, {
    first_name,
    last_name,
    email,
    phone,
    hasRequiredFields: !!(first_name || last_name) && !!email,
  });

  const leadRecord = {
    first_name,
    last_name,
    email,
    phone,
    clinic_id,
    source_id: "670f33cf-043d-407f-aca9-19613e329de4",
    status: "New",
    form_data: body,
  };

  console.log(`[LEAD_INSERT] Inserting lead record:`, {
    ...leadRecord,
    form_data: `${Object.keys(body || {}).length} keys`,
  });

  const { data, error } = await supabase.from("lead").insert(leadRecord);

  if (error) {
    console.error(`[LEAD_INSERT] Database insert error:`, error);
    throw new Error(error.message);
  }

  console.log(`[LEAD_INSERT] Successfully inserted lead`, {
    email,
    clinic_id,
    insertedData: data,
  });

  console.log(`[LEAD_INSERT] Creating redirect URL with APP_URL: ${APP_URL}`);
  const redirectUrl = new URL(`${APP_URL}/onboarding`);
  redirectUrl.searchParams.set("google_lead_form_status", "success");

  const finalRedirectUrl = redirectUrl.toString();
  console.log(`[LEAD_INSERT] Final redirect URL: ${finalRedirectUrl}`);

  return finalRedirectUrl;
}

/**
 * Step 2.5 - Fetch Google Ads Accounts and Lead Forms
 */
export async function fetchAccountsAndLeadForms(connection_id: string, supabase: any) {
  console.log(`[FETCH_ACCOUNTS] Fetching Google Ads accounts and lead forms for connection: ${connection_id}`);

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select(
        `
        id,
        clinic_id,
        status,
        expires_at,
        auth_data,
        integrations!inner(name)
      `,
      )
      .eq("id", connection_id)
      .eq("integrations.name", "Google Lead Forms")
      .single();

    if (connectionError || !connection) {
      console.error(`[FETCH_ACCOUNTS] Connection not found:`, connectionError);
      throw new Error("Connection not found");
    }

    console.log(`[FETCH_ACCOUNTS] Found connection:`, {
      id: connection.id,
      clinic_id: connection.clinic_id,
      status: connection.status,
      has_auth_data: !!connection.auth_data,
    });

    const authData = connection.auth_data || {};

    // Get Google Ads Developer Token
    const googleAdsDeveloperToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!googleAdsDeveloperToken) {
      console.error(`[FETCH_ACCOUNTS] Google Ads Developer Token not configured`);
      throw new Error("Google Ads Developer Token not configured");
    }

    // Refresh token if needed
    let currentAuthData = authData;
    const tokenExpiryDate = authData.token_expiry ? new Date(authData.token_expiry) : null;
    const now = new Date();
    const isTokenExpired = tokenExpiryDate && tokenExpiryDate <= now;

    console.log(`[FETCH_ACCOUNTS] Token check - Expired: ${isTokenExpired}, Expiry: ${tokenExpiryDate}, Now: ${now}`);

    if (isTokenExpired) {
      console.log(`[FETCH_ACCOUNTS] Token expired, refreshing...`);
      currentAuthData = await refreshGoogleTokenForIntegration(connection, supabase);
    }

    // Try to fetch accessible customers using Google Ads API
    const GOOGLE_ADS_DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    const API_VERSION = "v21"; // Latest stable version

    if (!GOOGLE_ADS_DEVELOPER_TOKEN) {
      console.warn(`[FETCH_ACCOUNTS] No Google Ads Developer Token found. Manual customer ID setup required.`);
    } else {
      console.log(`[FETCH_ACCOUNTS] Attempting to fetch accessible customers with Developer Token`);

      try {
        const customersResponse = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
            Authorization: `Bearer ${currentAuthData.access_token}`,
          },
        });

        console.log(`[FETCH_ACCOUNTS] Customers API response status: ${customersResponse.status}`);

        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          console.log(`[FETCH_ACCOUNTS] Customers API response:`, {
            hasResourceNames: !!customersData.resourceNames,
            customersCount: customersData.resourceNames?.length || 0,
          });

          if (customersData.resourceNames && customersData.resourceNames.length > 0) {
            // Extract customer IDs from resource names (format: customers/1234567890)
            const customerIds = customersData.resourceNames.map((resource: string) => resource.replace("customers/", ""));

            console.log(`[FETCH_ACCOUNTS] Found ${customerIds.length} accessible customers:`, customerIds);

            // If only one customer, auto-select it
            if (customerIds.length === 1) {
              const autoSelectedCustomerId = customerIds[0];
              console.log(`[FETCH_ACCOUNTS] Auto-selecting single customer: ${autoSelectedCustomerId}`);

              const updatedAuthData = {
                ...currentAuthData,
                google_customer_id: autoSelectedCustomerId,
                automatic_customer_discovery: true,
                customers_discovered_at: new Date().toISOString(),
                accessible_customer_ids: customerIds,
              };

              const { error: updateError } = await supabase
                .from("integration_connections")
                .update({
                  auth_data: updatedAuthData,
                })
                .eq("id", connection_id);

              if (updateError) {
                console.error(`[FETCH_ACCOUNTS] Error updating connection with auto-selected customer:`, updateError);
                throw new Error(`Failed to update connection: ${updateError.message}`);
              }

              return {
                success: true,
                connection_id: connection_id,
                auto_selected_customer_id: autoSelectedCustomerId,
                accessible_customers: customerIds,
                message: "Customer ID automatically discovered and selected.",
              };
            } else {
              // Multiple customers - let user choose
              console.log(`[FETCH_ACCOUNTS] Multiple customers found - requiring user selection`);

              const updatedAuthData = {
                ...currentAuthData,
                accessible_customer_ids: customerIds,
                needs_customer_selection: true,
                customers_discovered_at: new Date().toISOString(),
              };

              const { error: updateError } = await supabase
                .from("integration_connections")
                .update({
                  auth_data: updatedAuthData,
                })
                .eq("id", connection_id);

              if (updateError) {
                console.error(`[FETCH_ACCOUNTS] Error updating connection with customer options:`, updateError);
                throw new Error(`Failed to update connection: ${updateError.message}`);
              }

              return {
                success: false,
                connection_id: connection_id,
                needs_customer_selection: true,
                accessible_customers: customerIds,
                message: "Multiple Google Ads accounts found. Please select which account to use.",
              };
            }
          }
        } else {
          const errorText = await customersResponse.text();
          console.error(`[FETCH_ACCOUNTS] Customers API error:`, {
            status: customersResponse.status,
            statusText: customersResponse.statusText,
            error: errorText,
          });
        }
      } catch (apiError) {
        console.error(`[FETCH_ACCOUNTS] Google Ads API call failed:`, apiError);
      }
    }

    // Fallback to manual customer ID setup
    const updatedAuthData = {
      ...currentAuthData,
      needs_manual_customer_id_setup: true,
      automatic_account_discovery_failed: true,
      accounts_fetch_attempted_at: new Date().toISOString(),
      needs_customer_id_setup: true,
    };

    console.log(`[FETCH_ACCOUNTS] Falling back to manual customer ID setup`);
    console.log(`[FETCH_ACCOUNTS] Updating connection to indicate manual setup needed`);

    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        auth_data: updatedAuthData,
      })
      .eq("id", connection_id);

    if (updateError) {
      console.error(`[FETCH_ACCOUNTS] Error updating connection:`, updateError);
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    return {
      success: false,
      connection_id: connection_id,
      needs_manual_setup: true,
      message: "Google Ads integration requires manual customer ID setup. Please provide your Google Ads Customer ID to continue.",
    };
  } catch (error) {
    console.error(`[FETCH_ACCOUNTS] Error fetching accounts and forms:`, error);
    console.error(`[FETCH_ACCOUNTS] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Step 2.5 - Set Google Customer ID (Legacy - kept for compatibility)
 */
export async function setGoogleCustomerId(connection_id: string, google_customer_id: string, supabase: any) {
  console.log(`[SET_CUSTOMER_ID] Setting Google Customer ID for connection: ${connection_id}`);
  console.log(`[SET_CUSTOMER_ID] Customer ID: ${google_customer_id}`);

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select(
        `
        id,
        clinic_id,
        status,
        auth_data,
        integrations!inner(name)
      `,
      )
      .eq("id", connection_id)
      .eq("integrations.name", "Google Lead Forms")
      .single();

    if (connectionError || !connection) {
      console.error(`[SET_CUSTOMER_ID] Connection not found:`, connectionError);
      throw new Error("Connection not found");
    }

    // Update auth_data with Google Customer ID
    const updatedAuthData = {
      ...connection.auth_data,
      google_customer_id: google_customer_id,
      customer_id_set_at: new Date().toISOString(),
      needs_customer_id_setup: false,
    };

    console.log(`[SET_CUSTOMER_ID] Updating connection with customer ID`);
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        auth_data: updatedAuthData,
      })
      .eq("id", connection_id);

    if (updateError) {
      console.error(`[SET_CUSTOMER_ID] Error updating connection:`, updateError);
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    console.log(`[SET_CUSTOMER_ID] Successfully set Google Customer ID`);

    return {
      success: true,
      connection_id: connection_id,
      google_customer_id: google_customer_id,
      message: "Google Customer ID set successfully",
    };
  } catch (error) {
    console.error(`[SET_CUSTOMER_ID] Error setting customer ID:`, error);
    console.error(`[SET_CUSTOMER_ID] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Step 3 - Fetch Available Lead Forms from Google Ads
 */
export async function fetchAvailableLeadForms(connection_id: string, supabase: any) {
  console.log(`[LEAD_FORMS] Fetching available lead forms for connection: ${connection_id}`);

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select(
        `
        id,
        clinic_id,
        status,
        expires_at,
        auth_data,
        integrations!inner(name)
      `,
      )
      .eq("id", connection_id)
      .eq("integrations.name", "Google Lead Forms")
      .single();

    if (connectionError || !connection) {
      console.error(`[LEAD_FORMS] Connection not found:`, connectionError);
      throw new Error("Connection not found");
    }

    console.log(`[LEAD_FORMS] Found connection:`, {
      id: connection.id,
      clinic_id: connection.clinic_id,
      status: connection.status,
      has_auth_data: !!connection.auth_data,
      auth_data_keys: Object.keys(connection.auth_data || {}),
    });

    const authData = connection.auth_data || {};

    // Check if we have a Google Ads customer ID in auth_data
    const googleCustomerId = authData.google_customer_id;
    if (!googleCustomerId) {
      console.error(`[LEAD_FORMS] No Google Ads customer ID found in auth_data`);
      throw new Error("Google Ads customer ID not configured. Please reconnect the integration.");
    }

    console.log(`[LEAD_FORMS] Using Google Customer ID: ${googleCustomerId}`);

    // Check if we already have available forms in auth_data - use those instead of API call
    if (authData.available_forms && authData.available_forms.length > 0) {
      console.log(`[LEAD_FORMS] Found ${authData.available_forms.length} forms already cached in auth_data`);
      console.log(`[LEAD_FORMS] Using cached forms instead of API call to avoid permission issues`);

      const cachedForms = authData.available_forms.map((form: any) => ({
        id: form.id,
        name: form.name,
        business_name: form.business_name,
        call_to_action_type: form.call_to_action_type,
        resource_name: form.resource_name,
        google_customer_id: googleCustomerId,
      }));

      // Update the auth_data to ensure it's consistent
      const updatedAuthData = {
        ...authData,
        available_forms: cachedForms,
        forms_last_fetched: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("integration_connections")
        .update({ auth_data: updatedAuthData })
        .eq("id", connection_id);

      if (updateError) {
        console.warn(`[LEAD_FORMS] Warning: Failed to update cached forms timestamp:`, updateError);
      }

      return {
        success: true,
        lead_forms: cachedForms,
        connection_id: connection_id,
        google_customer_id: googleCustomerId,
        source: "cached",
      };
    }

    console.log(`[LEAD_FORMS] No cached forms found. Trying searchStream endpoint since search endpoint failed...`);

    // Get Google Ads Developer Token first (needed for all API calls)
    const googleAdsDeveloperToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!googleAdsDeveloperToken) {
      console.error(`[LEAD_FORMS] Google Ads Developer Token not configured`);
      return {
        success: false,
        error: "Google Ads Developer Token not configured",
        connection_id: connection_id,
        google_customer_id: googleCustomerId,
      };
    }

    // Use searchStream endpoint for lead forms (works with Basic Access)
    console.log(`[LEAD_FORMS] Attempting to fetch lead forms using searchStream endpoint...`);
    const streamUrl = `https://googleads.googleapis.com/v21/customers/${googleCustomerId}/googleAds:searchStream`;
    const leadFormsQuery = `
      SELECT 
        asset.id,
        asset.name,
        asset.lead_form_asset.business_name,
        asset.lead_form_asset.call_to_action_type,
        asset.lead_form_asset.call_to_action_description,
        asset.resource_name
      FROM asset 
      WHERE asset.type = 'LEAD_FORM'
      ORDER BY asset.name ASC
    `;

    try {
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
          "developer-token": googleAdsDeveloperToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: leadFormsQuery }),
      });

      console.log(`[LEAD_FORMS] SearchStream API Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LEAD_FORMS] SearchStream API error:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 500),
        });

        // If searchStream also fails, return empty forms with helpful message
        return {
          success: true,
          lead_forms: [],
          connection_id: connection_id,
          google_customer_id: googleCustomerId,
          source: "searchstream_failed",
          message: `SearchStream endpoint also failed with ${response.status}. You may need Standard Access to Google Ads API.`,
          upgrade_needed: true,
        };
      }

      const responseData = await response.json();
      console.log(`[LEAD_FORMS] SearchStream response:`, responseData);

      // Process the searchStream response format
      const leadForms = [];
      if (responseData && Array.isArray(responseData)) {
        for (const batch of responseData) {
          if (batch.results && Array.isArray(batch.results)) {
            leadForms.push(
              ...batch.results.map((result: any) => {
                const asset = result.asset;
                return {
                  id: asset.id,
                  name: asset.name,
                  business_name: asset.lead_form_asset?.business_name || "Unknown Business",
                  call_to_action_type: asset.lead_form_asset?.call_to_action_type || "CONTACT_US",
                  call_to_action_description: asset.lead_form_asset?.call_to_action_description || "",
                  resource_name: asset.resource_name,
                  google_customer_id: googleCustomerId,
                };
              }),
            );
          }
        }
      }

      console.log(`[LEAD_FORMS] Successfully parsed ${leadForms.length} lead forms from searchStream`);

      // If no forms found in manager account, try checking client accounts
      if (leadForms.length === 0) {
        console.log(`[LEAD_FORMS] No forms in manager account. Checking if this is a manager account with clients...`);

        // Try to get client accounts
        const clientsQuery = `
          SELECT
            customer_client.client_customer,
            customer_client.descriptive_name,
            customer_client.id
          FROM customer_client
          WHERE customer_client.level = 1
        `;

        try {
          const clientsResponse = await fetch(streamUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authData.access_token}`,
              "developer-token": googleAdsDeveloperToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: clientsQuery }),
          });

          if (clientsResponse.ok) {
            const clientsData = await clientsResponse.json();
            console.log(`[LEAD_FORMS] Clients response:`, clientsData);

            // Try to fetch forms from first client account if available
            if (clientsData && Array.isArray(clientsData)) {
              for (const batch of clientsData) {
                if (batch.results && Array.isArray(batch.results) && batch.results.length > 0) {
                  const firstClient = batch.results[0].customerClient;
                  const clientId = firstClient.id;
                  console.log(`[LEAD_FORMS] Trying to fetch forms from client account: ${clientId} (${firstClient.descriptiveName})`);

                  const clientStreamUrl = `https://googleads.googleapis.com/v21/customers/${clientId}/googleAds:searchStream`;
                  const clientFormsResponse = await fetch(clientStreamUrl, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${authData.access_token}`,
                      "developer-token": googleAdsDeveloperToken,
                      "login-customer-id": googleCustomerId.replace(/-/g, ""), // Use manager account as login customer
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ query: leadFormsQuery }),
                  });

                  console.log(`[LEAD_FORMS] Client forms API status: ${clientFormsResponse.status} ${clientFormsResponse.statusText}`);

                  if (clientFormsResponse.ok) {
                    const clientFormsData = await clientFormsResponse.json();
                    console.log(`[LEAD_FORMS] ✅ CLIENT FORMS DATA:`, JSON.stringify(clientFormsData, null, 2));

                    if (clientFormsData && Array.isArray(clientFormsData)) {
                      for (const clientBatch of clientFormsData) {
                        if (clientBatch.results && Array.isArray(clientBatch.results)) {
                          leadForms.push(
                            ...clientBatch.results.map((result: any) => {
                              const asset = result.asset;
                              return {
                                id: asset.id,
                                name: asset.name,
                                business_name: asset.lead_form_asset?.business_name || firstClient.descriptiveName,
                                call_to_action_type: asset.lead_form_asset?.call_to_action_type || "CONTACT_US",
                                call_to_action_description: asset.lead_form_asset?.call_to_action_description || "",
                                resource_name: asset.resource_name,
                                google_customer_id: clientId,
                                client_account: true,
                                client_name: firstClient.descriptiveName,
                              };
                            }),
                          );
                        }
                      }
                    }

                    if (leadForms.length > 0) {
                      console.log(`[LEAD_FORMS] Found ${leadForms.length} lead forms in client account ${clientId}`);
                      break; // Stop after finding forms in first client
                    }
                  } else {
                    const clientError = await clientFormsResponse.text();
                    console.log(`[LEAD_FORMS] ❌ CLIENT FORMS API FAILED:`, clientFormsResponse.status, clientError.substring(0, 300));
                  }
                }
              }
            }
          }
        } catch (clientError) {
          console.log(`[LEAD_FORMS] Error checking client accounts:`, clientError);
        }
      }

      console.log(`[LEAD_FORMS] Final total: ${leadForms.length} lead forms found`);

      // Update auth_data with the fetched forms
      const updatedAuthData = {
        ...authData,
        available_forms: leadForms,
        forms_last_fetched: new Date().toISOString(),
        forms_source: "searchstream",
        checked_client_accounts: leadForms.some(f => f.client_account),
      };

      const { error: updateError } = await supabase
        .from("integration_connections")
        .update({ auth_data: updatedAuthData })
        .eq("id", connection_id);

      if (updateError) {
        console.warn(`[LEAD_FORMS] Warning: Failed to cache forms:`, updateError);
      }

      return {
        success: true,
        lead_forms: leadForms,
        connection_id: connection_id,
        google_customer_id: googleCustomerId,
        source: "searchstream",
        message:
          leadForms.length > 0
            ? `Found ${leadForms.length} lead forms using searchStream endpoint`
            : "No lead forms found for this customer account",
      };
    } catch (error) {
      console.error(`[LEAD_FORMS] Error with searchStream endpoint:`, error);

      return {
        success: true,
        lead_forms: [],
        connection_id: connection_id,
        google_customer_id: googleCustomerId,
        source: "searchstream_error",
        message: "Failed to fetch lead forms. API access may be limited.",
        error: error.message,
        upgrade_needed: true,
      };
    }

    // Refresh token if needed
    let currentAuthData = authData;
    const tokenExpiryDate = authData.token_expiry ? new Date(authData.token_expiry) : null;
    const now = new Date();
    const isTokenExpired = tokenExpiryDate && tokenExpiryDate <= now;

    console.log(`[LEAD_FORMS] Token check - Expired: ${isTokenExpired}, Expiry: ${tokenExpiryDate}, Now: ${now}`);

    if (isTokenExpired) {
      console.log(`[LEAD_FORMS] Token expired, refreshing...`);
      currentAuthData = await refreshGoogleTokenForIntegration(connection, supabase);
    }

    // Use Google Ads API to fetch available lead forms
    const API_VERSION = "v21"; // Use same version as other endpoints
    const googleAdsUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${googleCustomerId}/googleAdsService:search`;

    const query = `
      SELECT 
        asset.id,
        asset.name,
        asset.lead_form_asset.business_name,
        asset.lead_form_asset.call_to_action_type,
        asset.lead_form_asset.call_to_action_description,
        asset.resource_name
      FROM asset 
      WHERE asset.type = 'LEAD_FORM'
      ORDER BY asset.name ASC
    `;

    console.log(`[LEAD_FORMS] Google Ads API URL: ${googleAdsUrl}`);
    console.log(`[LEAD_FORMS] Query: ${query.trim()}`);

    const requestHeaders = {
      Authorization: `Bearer ${currentAuthData.access_token}`,
      "developer-token": googleAdsDeveloperToken,
      "login-customer-id": googleCustomerId.replace(/-/g, ""), // Remove any dashes from customer ID
      "Content-Type": "application/json",
    };

    console.log(`[LEAD_FORMS] Request headers:`, {
      ...requestHeaders,
      Authorization: `Bearer ${currentAuthData.access_token.substring(0, 20)}...`,
      "developer-token": `${googleAdsDeveloperToken.substring(0, 20)}...`,
      "login-customer-id": requestHeaders["login-customer-id"],
    });

    console.log(`[LEAD_FORMS] Customer ID details:`, {
      original: googleCustomerId,
      formatted: googleCustomerId.replace(/-/g, ""),
      hasAccess: !!currentAuthData.accessible_customer_ids?.includes(googleCustomerId),
      accessibleIds: currentAuthData.accessible_customer_ids || [],
    });

    // Step 1: Test basic API access and permissions
    console.log(`[LEAD_FORMS] === PERMISSION DIAGNOSTIC START ===`);

    // Test 1: Check if we can access the customer at all
    console.log(`[LEAD_FORMS] Test 1: Basic customer access check...`);
    const basicTestUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${googleCustomerId}`;
    const basicTestResponse = await fetch(basicTestUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${currentAuthData.access_token}`,
        "developer-token": googleAdsDeveloperToken,
        "login-customer-id": googleCustomerId.replace(/-/g, ""),
      },
    });

    console.log(`[LEAD_FORMS] Test 1 Result - Customer access: ${basicTestResponse.status} ${basicTestResponse.statusText}`);
    if (!basicTestResponse.ok) {
      const basicError = await basicTestResponse.text();
      console.log(`[LEAD_FORMS] Test 1 Error Details:`, basicError.substring(0, 500));
    }

    // Test 2: Try to list accessible customers to verify our permissions
    console.log(`[LEAD_FORMS] Test 2: Checking accessible customers...`);
    const accessibleCustomersUrl = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;
    const accessibleResponse = await fetch(accessibleCustomersUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${currentAuthData.access_token}`,
        "developer-token": googleAdsDeveloperToken,
      },
    });

    console.log(`[LEAD_FORMS] Test 2 Result - Accessible customers: ${accessibleResponse.status}`);
    if (accessibleResponse.ok) {
      const accessibleData = await accessibleResponse.json();
      console.log(`[LEAD_FORMS] Accessible customers:`, accessibleData.resourceNames || []);
      const hasAccess = accessibleData.resourceNames?.some((name: string) => name.includes(googleCustomerId));
      console.log(`[LEAD_FORMS] Current customer ${googleCustomerId} in accessible list: ${hasAccess}`);
    } else {
      const accessError = await accessibleResponse.text();
      console.log(`[LEAD_FORMS] Test 2 Error:`, accessError.substring(0, 300));
    }

    // Test 3: Try a simple search query to test API access level
    console.log(`[LEAD_FORMS] Test 3: Testing API access level with simple query...`);
    const simpleTestUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${googleCustomerId}/googleAdsService:search`;
    const simpleQuery = `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`;

    const simpleTestResponse = await fetch(simpleTestUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ query: simpleQuery }),
    });

    console.log(`[LEAD_FORMS] Test 3 Result - Simple query: ${simpleTestResponse.status}`);
    if (!simpleTestResponse.ok) {
      const simpleError = await simpleTestResponse.text();
      console.log(`[LEAD_FORMS] Test 3 Error Details:`, simpleError.substring(0, 500));

      if (simpleTestResponse.status === 404) {
        console.log(`[LEAD_FORMS] 404 indicates either:`);
        console.log(`[LEAD_FORMS] - Basic Access only (need Standard Access for production)`);
        console.log(`[LEAD_FORMS] - Invalid customer ID`);
        console.log(`[LEAD_FORMS] - Customer not accessible with current token`);
      }
    } else {
      const simpleData = await simpleTestResponse.json();
      console.log(`[LEAD_FORMS] Test 3 Success - Customer data:`, simpleData);
    }

    console.log(`[LEAD_FORMS] === PERMISSION DIAGNOSTIC END ===`);

    // Now proceed with the original lead forms query
    console.log(`[LEAD_FORMS] Proceeding with lead forms query...`);
    const response = await fetch(googleAdsUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ query }),
    });

    console.log(`[LEAD_FORMS] API Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LEAD_FORMS] Google Ads API error:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });
      throw new Error(`Google Ads API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    const leadForms = responseData.results || [];

    console.log(`[LEAD_FORMS] API Response structure:`, {
      hasResults: !!responseData.results,
      resultsLength: leadForms.length,
      totalResultCount: responseData.totalResultCount,
      responseKeys: Object.keys(responseData),
    });

    console.log(`[LEAD_FORMS] Found ${leadForms.length} lead forms`);

    // Transform the results into a more usable format
    const formattedLeadForms = leadForms.map((result: any, index: number) => {
      const asset = result.asset;
      const leadFormAsset = asset.leadFormAsset || {};

      console.log(`[LEAD_FORMS] Processing lead form ${index + 1}:`, {
        id: asset.id,
        name: asset.name,
        businessName: leadFormAsset.businessName,
        callToActionType: leadFormAsset.callToActionType,
      });

      return {
        id: asset.id,
        name: asset.name || `Lead Form ${asset.id}`,
        business_name: leadFormAsset.businessName || "Unknown Business",
        call_to_action_type: leadFormAsset.callToActionType || "UNKNOWN",
        call_to_action_description: leadFormAsset.callToActionDescription || "",
        resource_name: asset.resourceName,
        google_customer_id: googleCustomerId,
      };
    });

    console.log(`[LEAD_FORMS] Formatted ${formattedLeadForms.length} lead forms for display`);

    return {
      success: true,
      lead_forms: formattedLeadForms,
      connection_id: connection_id,
      google_customer_id: googleCustomerId,
    };
  } catch (error) {
    console.error(`[LEAD_FORMS] Error fetching lead forms:`, error);
    console.error(`[LEAD_FORMS] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Step 4 - Save Selected Lead Forms
 */
export async function saveSelectedLeadForms(connection_id: string, selectedForms: any[], supabase: any) {
  console.log(`[SAVE_FORMS] Saving selected lead forms for connection: ${connection_id}`);
  console.log(`[SAVE_FORMS] Selected forms:`, selectedForms);

  // selectedForms now can be either:
  // 1. Array of form objects (legacy format)
  // 2. Array of form objects with google_customer_id (new format)

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select(
        `
        id,
        clinic_id,
        status,
        auth_data,
        integrations!inner(name)
      `,
      )
      .eq("id", connection_id)
      .eq("integrations.name", "Google Lead Forms")
      .single();

    if (connectionError || !connection) {
      console.error(`[SAVE_FORMS] Connection not found:`, connectionError);
      throw new Error("Connection not found");
    }

    // Prepare minimal form selection data to store in auth_data
    const formSelections = selectedForms.map(form => ({
      id: form.id,
      name: form.name,
      business_name: form.business_name,
      google_customer_id: form.google_customer_id,
      call_to_action_type: form.call_to_action_type,
      selected_at: new Date().toISOString(),
      is_active: true,
    }));

    console.log(`[SAVE_FORMS] Preparing to store ${formSelections.length} form selections in auth_data:`, formSelections);

    // Update connection status to active and store selected forms in auth_data
    console.log(`[SAVE_FORMS] Updating connection status to active`);
    const updatedAuthData = {
      ...connection.auth_data,
      selected_lead_forms: formSelections,
      lead_form_count: formSelections.length,
      selected_forms_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        status: "active",
        auth_data: updatedAuthData,
      })
      .eq("id", connection_id);

    if (updateError) {
      console.error(`[SAVE_FORMS] Error updating connection status:`, updateError);
      throw new Error(`Failed to update connection status: ${updateError.message}`);
    }

    console.log(`[SAVE_FORMS] Successfully saved ${formSelections.length} lead form selections to auth_data`);

    return {
      success: true,
      selected_forms: formSelections,
      connection_id: connection_id,
      message: `Successfully saved ${formSelections.length} lead form selections`,
    };
  } catch (error) {
    console.error(`[SAVE_FORMS] Error saving lead forms:`, error);
    console.error(`[SAVE_FORMS] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Helper - Refresh Google Token for Integration
 */
async function refreshGoogleTokenForIntegration(connection: any, supabase: any) {
  console.log(`[TOKEN_REFRESH] Starting token refresh for integration connection: ${connection.id}`);

  try {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!googleClientId || !googleClientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    const authData = connection.auth_data || {};
    const refreshToken = authData.refresh_token;

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    console.log(`[TOKEN_REFRESH] Making token refresh request`);
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[TOKEN_REFRESH] Token refresh failed:`, errorText);
      throw new Error(`Token refresh failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`[TOKEN_REFRESH] Token refresh successful`);

    const updatedAuthData = {
      ...authData,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      last_token_refresh: new Date().toISOString(),
    };

    const newExpiryDate = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        auth_data: updatedAuthData,
        expires_at: newExpiryDate,
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error(`[TOKEN_REFRESH] Database update error:`, updateError);
      throw new Error("Failed to update token in database");
    }

    return updatedAuthData;
  } catch (error) {
    console.error(`[TOKEN_REFRESH] Token refresh failed:`, error);

    // Mark connection as failed
    await supabase
      .from("integration_connections")
      .update({
        status: "failed",
      })
      .eq("id", connection.id);

    throw error;
  }
}

/**
 * Sync/Fetch Leads from Selected Lead Forms
 */
export async function syncLeadsFromForms(connection_id: string, supabase: any) {
  console.log(`[SYNC_LEADS] Starting lead sync for connection: ${connection_id}`);

  try {
    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select(
        `
        id,
        clinic_id,
        status,
        expires_at,
        auth_data,
        integrations!inner(name)
      `,
      )
      .eq("id", connection_id)
      .eq("integrations.name", "Google Lead Forms")
      .single();

    if (connectionError || !connection) {
      console.error(`[SYNC_LEADS] Connection not found:`, connectionError);
      throw new Error("Connection not found");
    }

    const authData = connection.auth_data || {};
    const googleCustomerId = authData.google_customer_id;
    const selectedForms = authData.selected_forms || [];

    if (!googleCustomerId) {
      throw new Error("Google Ads customer ID not configured");
    }

    if (selectedForms.length === 0) {
      throw new Error("No forms selected for sync");
    }

    console.log(`[SYNC_LEADS] Syncing ${selectedForms.length} forms for customer ${googleCustomerId}`);

    // Get Google Ads Developer Token
    const googleAdsDeveloperToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!googleAdsDeveloperToken) {
      throw new Error("Google Ads Developer Token not configured");
    }

    // Refresh token if needed
    let currentAuthData = authData;
    const tokenExpiryDate = authData.token_expiry ? new Date(authData.token_expiry) : null;
    const now = new Date();
    const isTokenExpired = tokenExpiryDate && tokenExpiryDate <= now;

    if (isTokenExpired) {
      console.log(`[SYNC_LEADS] Token expired, refreshing...`);
      currentAuthData = await refreshGoogleTokenForIntegration(connection, supabase);
    }

    // Create form asset IDs array for the query
    const formAssetIds = selectedForms.map(form => form.id);
    console.log(`[SYNC_LEADS] Form asset IDs:`, formAssetIds);

    // Use Google Ads API to fetch leads for selected forms
    const API_VERSION = "v21"; // Use same version as other endpoints
    const googleAdsUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${googleCustomerId}/googleAds:searchStream`;

    // Query to fetch leads from the selected lead forms
    const query = `
      SELECT 
        lead_form_submission_data.id,
        lead_form_submission_data.asset_id,
        lead_form_submission_data.asset_name,
        lead_form_submission_data.form_submission_date_time,
        lead_form_submission_data.custom_lead_form_submission_fields,
        lead_form_submission_data.lead_form_submission_fields
      FROM lead_form_submission_data 
      WHERE lead_form_submission_data.asset_id IN (${formAssetIds.join(", ")})
      ORDER BY lead_form_submission_data.form_submission_date_time DESC
    `;

    console.log(`[SYNC_LEADS] Leads query: ${query.trim()}`);

    const requestHeaders = {
      Authorization: `Bearer ${currentAuthData.access_token}`,
      "developer-token": googleAdsDeveloperToken,
      "login-customer-id": googleCustomerId.replace(/-/g, ""), // Remove any dashes from customer ID
      "Content-Type": "application/json",
    };

    const response = await fetch(googleAdsUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SYNC_LEADS] Google Ads API error:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Google Ads API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[SYNC_LEADS] SearchStream API response:`, JSON.stringify(data, null, 2));

    // Process searchStream response format (array of batches)
    const leads = [];
    if (data && Array.isArray(data)) {
      for (const batch of data) {
        if (batch.results && Array.isArray(batch.results)) {
          leads.push(...batch.results);
        }
      }
    }
    console.log(`[SYNC_LEADS] Found ${leads.length} leads to process`);

    // Process and save leads to database
    let processedCount = 0;
    let duplicateCount = 0;

    for (const leadData of leads) {
      try {
        const submissionData = leadData.leadFormSubmissionData;

        // Extract lead information
        const leadInfo = {
          google_submission_id: submissionData.id,
          asset_id: submissionData.assetId,
          asset_name: submissionData.assetName,
          submission_date: submissionData.formSubmissionDateTime,
          form_fields: submissionData.leadFormSubmissionFields || [],
          custom_fields: submissionData.customLeadFormSubmissionFields || [],
        };

        // Check if lead already exists
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("google_submission_id", leadInfo.google_submission_id)
          .eq("clinic_id", connection.clinic_id)
          .single();

        if (existingLead) {
          duplicateCount++;
          continue;
        }

        // Save lead to database
        const { error: insertError } = await supabase.from("leads").insert({
          clinic_id: connection.clinic_id,
          google_submission_id: leadInfo.google_submission_id,
          source: "Google Lead Forms",
          form_name: leadInfo.asset_name,
          submission_data: leadInfo,
          created_at: leadInfo.submission_date,
        });

        if (insertError) {
          console.error(`[SYNC_LEADS] Error inserting lead:`, insertError);
        } else {
          processedCount++;
        }
      } catch (error) {
        console.error(`[SYNC_LEADS] Error processing lead:`, error);
      }
    }

    console.log(`[SYNC_LEADS] Sync completed - Processed: ${processedCount}, Duplicates: ${duplicateCount}`);

    return {
      success: true,
      leads_found: leads.length,
      leads_processed: processedCount,
      duplicates_skipped: duplicateCount,
      forms_synced: selectedForms.length,
    };
  } catch (error) {
    console.error(`[SYNC_LEADS] Sync failed:`, error);
    throw error;
  }
}
