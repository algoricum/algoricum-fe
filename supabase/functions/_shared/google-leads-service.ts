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
    const API_VERSION = "v16"; // Latest stable version

    if (!GOOGLE_ADS_DEVELOPER_TOKEN) {
      console.warn(`[FETCH_ACCOUNTS] No Google Ads Developer Token found. Manual customer ID setup required.`);
    } else {
      console.log(`[FETCH_ACCOUNTS] Attempting to fetch accessible customers with Developer Token`);

      try {
        const customersResponse = await fetch(`https://googleads.googleapis.com/v${API_VERSION}/customers:listAccessibleCustomers`, {
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

    // Get Google Ads Developer Token
    const googleAdsDeveloperToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!googleAdsDeveloperToken) {
      console.error(`[LEAD_FORMS] Google Ads Developer Token not configured`);
      throw new Error("Google Ads Developer Token not configured");
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
    const googleAdsUrl = `https://googleads.googleapis.com/v14/customers/${googleCustomerId}/googleAdsService:search`;

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
      "Content-Type": "application/json",
    };

    console.log(`[LEAD_FORMS] Request headers:`, {
      ...requestHeaders,
      Authorization: `Bearer ${currentAuthData.access_token.substring(0, 20)}...`,
      "developer-token": `${googleAdsDeveloperToken.substring(0, 20)}...`,
    });

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
