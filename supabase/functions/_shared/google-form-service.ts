import { corsHeaders } from "./cors.ts";
import { extractAndCleanContacts } from "./gpt-extractor-service.ts";
import { chunkArray, enqueueLead } from "./Lead-enqueue.ts";
const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

// Helper functions for common response patterns
function createErrorResponse(message: string, status: number = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function createSuccessResponse(data: any, message?: string) {
  const responseData = message ? { ...data, message } : data;
  return new Response(JSON.stringify(responseData), {
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function createRedirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders(),
      Location: url,
    },
  });
}

async function validateConnection(supabase: any, connectionId: string) {
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (connectionError || !connection) {
    return { connection: null, error: createErrorResponse("Connection not found", 404) };
  }

  return { connection, error: null };
}

async function getConnectionWithTokenRefresh(supabase: any, connectionId: string) {
  const { connection, error } = await validateConnection(supabase, connectionId);
  if (error) return { connection: null, error };

  // Refresh token if needed
  let currentConnection = connection;
  if (connection.auth_data?.token_expiry && new Date(connection.auth_data.token_expiry) <= new Date()) {
    try {
      currentConnection = await refreshGoogleToken(connection, supabase);
    } catch (refreshError) {
      return {
        connection: null,
        error: createErrorResponse(`Failed to refresh access token, ${refreshError}`, 401),
      };
    }
  }

  return { connection: currentConnection, error: null };
}

// Helper functions for integration_connections table
async function getGoogleFormsIntegrationId(supabase: any): Promise<string> {
  const { data: integration, error } = await supabase.from("integrations").select("id").eq("name", "Google Forms").single();

  if (error || !integration) {
    throw new Error("Google Forms integration not found in integrations table");
  }

  return integration.id;
}

async function createIntegrationConnection(supabase: any, clinicId: string, integrationId: string, authData: any) {
  const connectionData = {
    clinic_id: clinicId,
    integration_id: integrationId,
    status: "active",
    auth_data: authData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(connectionData, {
      onConflict: "clinic_id,integration_id",
    })
    .select()
    .single();

  return { data, error };
}

async function updateIntegrationConnection(supabase: any, connectionId: string, updates: any) {
  const { data, error } = await supabase
    .from("integration_connections")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .select()
    .single();

  return { data, error };
}

console.log("🔧 Environment check:", {
  googleClientId: googleClientId ? "present" : "missing",
  googleClientSecret: googleClientSecret ? "present" : "missing",
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "not set",
  APP_URL,
});
// Initiate OAuth Flow
export async function initiateOAuthFlow(req) {
  try {
    const body = await req.json();
    const { clinic_id, user_id, redirectTo } = body;
    console.log("📋 OAuth initiation parameters:", { clinic_id, user_id, redirectTo });

    if (!clinic_id) {
      console.error("❌ Missing clinic_id in OAuth initiation");
      return createErrorResponse("clinic_id is required");
    }
    const state = btoa(
      JSON.stringify({
        clinic_id,
        user_id,
        redirectTo,
        timestamp: Date.now(),
      }),
    );
    const scopes = [
      "https://www.googleapis.com/auth/drive.file", // Files selected through Picker become accessible
      "https://www.googleapis.com/auth/spreadsheets.readonly", // Read spreadsheet content
    ];
    // Use the frontend redirect URI instead of Supabase function
    const redirectUri = new URL(redirectTo).origin + "/redirect-form";

    console.log("🔧 Redirect URI construction:", {
      redirectTo,
      origin: new URL(redirectTo).origin,
      finalRedirectUri: redirectUri,
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", googleClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    console.log("🔗 Using redirect URI:", redirectUri);

    console.log("✅ OAuth flow initiated successfully, auth URL generated:", authUrl.toString());

    return createSuccessResponse(
      {
        auth_url: authUrl.toString(),
        instructions: "Redirect user to auth_url to complete OAuth flow",
      },
      "OAuth flow initiated",
    );
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return createErrorResponse(`Failed to initiate OAuth flow: ${error.message}`, 500);
  }
}
// Handle OAuth Callback
export async function handleOAuthCallback(req, supabase) {
  let redirectUri;
  try {
    console.log("🔄 Starting OAuth callback handling...");
    let stateData;
    const url = new URL(req.url);
    const rawCode = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Decode the authorization code as Google returns it URL-encoded
    const code = rawCode ? decodeURIComponent(rawCode) : null;

    console.log("📋 OAuth callback parameters:", {
      rawCode: rawCode ? "present" : "missing",
      decodedCode: code ? "present" : "missing",
      state: state ? "present" : "missing",
      error,
    });
    if (!code || !state) {
      console.log("❌ Missing OAuth parameters - code:", code ? "present" : "missing", "state:", state ? "present" : "missing");
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "missing_parameters");
      return createRedirectResponse(redirectUrl.toString());
    }
    try {
      stateData = JSON.parse(atob(state));
      redirectUri = stateData.redirectTo;
      console.log("✅ State data parsed successfully:", {
        clinic_id: stateData.clinic_id,
        user_id: stateData.user_id,
        redirectTo: stateData.redirectTo,
      });
    } catch (e) {
      console.error("❌ Error parsing state:", e.message);
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "invalid_state");
      return createRedirectResponse(redirectUrl.toString());
    }
    if (error) {
      const redirectUrl = new URL(`${redirectUri}`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", error);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectUrl.toString(),
        },
      });
    }
    // Exchange code for tokens
    console.log("🔑 Starting token exchange...");
    const tokenUrl = "https://oauth2.googleapis.com/token";

    // Use the same frontend redirect URI as in OAuth initiation
    const redirectUriForToken = new URL(redirectUri).origin + "/redirect-form";

    console.log("📤 Token exchange parameters:", {
      client_id: googleClientId ? `${googleClientId.substring(0, 20)}...` : "missing",
      client_secret: googleClientSecret ? `${googleClientSecret.substring(0, 10)}...` : "missing",
      code: code ? "present" : "missing",
      redirect_uri: redirectUriForToken,
    });

    console.log("🔍 Full token request details:", {
      url: tokenUrl,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      bodyParams: {
        client_id: googleClientId ? "present" : "missing",
        client_secret: googleClientSecret ? "present" : "missing",
        code: "present",
        grant_type: "authorization_code",
        redirect_uri: redirectUriForToken,
      },
    });

    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUriForToken,
    });
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    console.log("📥 Token exchange response status:", tokenResponse.status);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("❌ Token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        rawCode: rawCode,
        decodedCode: code,
      });
      const redirectUrl = new URL(`${redirectUri}`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "token_exchange_failed");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectUrl.toString(),
        },
      });
    }
    const tokenData = await tokenResponse.json();
    console.log("✅ Token exchange successful, received tokens:", {
      access_token: tokenData.access_token ? "present" : "missing",
      refresh_token: tokenData.refresh_token ? "present" : "missing",
      expires_in: tokenData.expires_in,
    });

    // Get Google Forms integration ID
    const integrationId = await getGoogleFormsIntegrationId(supabase);

    // Create connection record in integration_connections table
    const authData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      user_id: stateData.user_id,
    };

    console.log("💾 Attempting to create integration connection:", {
      clinic_id: stateData.clinic_id,
      integration_id: integrationId,
      user_id: stateData.user_id,
      token_expiry: authData.token_expiry,
    });

    const { data: connection, error: connectionError } = await createIntegrationConnection(
      supabase,
      stateData.clinic_id,
      integrationId,
      authData,
    );

    if (connectionError) {
      console.error("❌ Database error creating connection:", connectionError);
      console.error("❌ Auth data that failed:", authData);
      const redirectUrl = new URL(`${redirectUri}`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "database_error");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectUrl.toString(),
        },
      });
    }

    console.log("✅ Connection created successfully:", {
      connection_id: connection.id,
      clinic_id: connection.clinic_id,
      sync_status: connection.sync_status,
    });

    // Redirect to success page with connection ID
    const redirectUrl = new URL(`${redirectUri}`);
    redirectUrl.searchParams.set("google_form_status", "success");
    redirectUrl.searchParams.set("connection_id", connection.id);
    redirectUrl.searchParams.set("account_name", "Google Forms Connected");

    console.log("🔀 Redirecting to success page:", redirectUrl.toString());

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(),
        Location: redirectUrl.toString(),
      },
    });
  } catch (error) {
    console.error("❌ OAuth callback unexpected error:", error);
    console.error("❌ Error stack:", error.stack);
    const redirectUrl = new URL(`${APP_URL}/onboarding`);
    redirectUrl.searchParams.set("google_form_status", "error");
    redirectUrl.searchParams.set("error", "unexpected_error");
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(),
        Location: redirectUrl.toString(),
      },
    });
  }
}
// List Google Spreadsheets
export async function listGoogleSpreadsheets(req, supabase) {
  try {
    const body = await req.json();
    const { connection_id } = body;

    if (!connection_id) {
      return createErrorResponse("connection_id is required");
    }

    const { connection: currentConnection, error } = await getConnectionWithTokenRefresh(supabase, connection_id);
    if (error) return error;
    // Get spreadsheets from Google Drive
    const spreadsheetsUrl = "https://www.googleapis.com/drive/v3/files";
    const query = 'mimeType="application/vnd.google-apps.spreadsheet"';
    console.log("📊 Fetching spreadsheets from Google Drive...");
    console.log("🔍 Query:", query);
    console.log("🔑 Using access token:", currentConnection.auth_data?.access_token ? "present" : "missing");
    console.log("🔐 Connection scopes granted:", currentConnection.auth_data?.scope || "not recorded");
    console.log("⏰ Token expiry:", currentConnection.auth_data?.token_expiry);

    const spreadsheetsResponse = await fetch(`${spreadsheetsUrl}?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${currentConnection.auth_data.access_token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📥 Google Drive API response status:", spreadsheetsResponse.status);

    if (!spreadsheetsResponse.ok) {
      const errorText = await spreadsheetsResponse.text();
      console.error("❌ Failed to fetch spreadsheets:", {
        status: spreadsheetsResponse.status,
        statusText: spreadsheetsResponse.statusText,
        error: errorText,
      });
      throw new Error(`Failed to fetch spreadsheets: ${spreadsheetsResponse.statusText}`);
    }

    const spreadsheetsData = await spreadsheetsResponse.json();
    console.log("📊 Raw spreadsheets data:", JSON.stringify(spreadsheetsData, null, 2));
    console.log("📁 Found files count:", spreadsheetsData.files?.length || 0);

    if (spreadsheetsData.files && spreadsheetsData.files.length === 0) {
      console.log("🔍 No spreadsheets found. Let's try a broader query...");

      // Try without MIME type filter to see if we can access any files at all
      const allFilesResponse = await fetch(`${spreadsheetsUrl}?pageSize=10`, {
        headers: {
          Authorization: `Bearer ${currentConnection.auth_data.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (allFilesResponse.ok) {
        const allFilesData = await allFilesResponse.json();
        console.log("📂 All files (first 10):", JSON.stringify(allFilesData, null, 2));
        console.log("📊 Total files accessible:", allFilesData.files?.length || 0);

        if (allFilesData.files?.length > 0) {
          console.log(
            "📋 File types found:",
            allFilesData.files.map(f => f.mimeType),
          );
        }
      } else {
        console.error("❌ Failed to fetch any files:", allFilesResponse.status, allFilesResponse.statusText);
      }
    }
    // Get sheets for each spreadsheet
    const spreadsheets = await Promise.all(
      spreadsheetsData.files.map(async file => {
        const sheets = await getSpreadsheetSheets(file.id, currentConnection.auth_data.access_token);
        return {
          spreadsheet_id: file.id,
          spreadsheet_title: file.name,
          sheets: sheets.map(sheet => ({
            sheet_id: sheet.properties.sheetId.toString(),
            sheet_title: sheet.properties.title,
          })),
        };
      }),
    );
    return createSuccessResponse(
      {
        connection_id: connection_id,
        spreadsheets,
      },
      "Spreadsheets retrieved successfully",
    );
  } catch (error) {
    console.error("Error listing spreadsheets:", error);
    return createErrorResponse(`Failed to list spreadsheets: ${error.message}`, 500);
  }
}
// Save Selected Sheets
export async function saveSelectedSheets(req, supabase) {
  try {
    console.log("💾 Saving selected sheets...");
    const body = await req.json();
    const { connection_id, selected_sheets } = body;

    console.log("📋 Request data:", { connection_id, selected_sheets });
    console.log(
      "📊 Sheet details:",
      selected_sheets?.map(sheet => ({
        spreadsheet_id: sheet.spreadsheet_id,
        sheet_id: sheet.sheet_id,
        sheet_title: sheet.sheet_title,
      })),
    );

    if (!connection_id || !selected_sheets || !Array.isArray(selected_sheets)) {
      return createErrorResponse("connection_id and selected_sheets array are required");
    }

    const { connection, error } = await validateConnection(supabase, connection_id);
    if (error) return error;
    // Save selected sheets to database
    const sheetInserts = selected_sheets.map((sheet, index) => {
      // Handle different data structures - could be TreeSelect values or sheet objects
      let spreadsheetId, sheetId, sheetTitle, spreadsheetTitle;

      if (typeof sheet === "string") {
        // If it's a TreeSelect value like "fileId_sheet1"
        const parts = sheet.split("_");
        spreadsheetId = parts[0];
        sheetId = parts[1] || `sheet_${index}`;
        sheetTitle = `Sheet ${index + 1}`;
        spreadsheetTitle = `Spreadsheet ${index + 1}`;

        console.log("🔍 String sheet processing:", {
          original: sheet,
          parts,
          extractedSpreadsheetId: spreadsheetId,
          extractedSheetId: sheetId,
        });
      } else {
        // If it's an object
        spreadsheetId = sheet.spreadsheet_id || sheet.fileId || sheet.id;
        sheetId = sheet.sheet_id || sheet.id || `sheet_${index}_${Date.now()}`;
        sheetTitle = sheet.sheet_title || sheet.title || sheet.name || `Sheet ${index + 1}`;
        spreadsheetTitle = sheet.spreadsheet_title || sheet.name || `Spreadsheet ${index + 1}`;

        // Clean up spreadsheet_id if it contains unwanted suffixes
        if (spreadsheetId && spreadsheetId.includes("_sheet")) {
          const cleanId = spreadsheetId.split("_sheet")[0];
          console.log("🧹 Cleaning spreadsheet_id:", { original: spreadsheetId, cleaned: cleanId });
          spreadsheetId = cleanId;
        }

        console.log("🔍 Object sheet processing:", {
          original: sheet,
          extractedSpreadsheetId: spreadsheetId,
          extractedSheetId: sheetId,
        });
      }

      console.log("📄 Processing sheet:", {
        input: sheet,
        resolved: { spreadsheetId, sheetId, sheetTitle, spreadsheetTitle },
      });

      return {
        connection_id: connection_id,
        spreadsheet_id: spreadsheetId,
        spreadsheet_title: spreadsheetTitle,
        sheet_id: sheetId,
        sheet_title: sheetTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Validate that all required fields are present
    const validSheetInserts = sheetInserts.filter(sheet => {
      const isValid = sheet.connection_id && sheet.spreadsheet_id && sheet.sheet_id;
      if (!isValid) {
        console.warn("⚠️ Skipping invalid sheet insert:", sheet);
      }
      return isValid;
    });

    if (validSheetInserts.length === 0) {
      return createErrorResponse("No valid sheets to save: All provided sheets are missing required fields");
    }

    console.log("💾 Inserting sheets:", validSheetInserts);
    const { data: savedSheets, error: sheetError } = await supabase.from("google_form_sheets").insert(validSheetInserts).select();
    if (sheetError) {
      return createErrorResponse(`Failed to save selected sheets: ${sheetError.message}`, 500);
    }
    // Connection is already active in new table structure, no status update needed
    console.log("✅ Sheets saved successfully, connection remains active");
    // Sync data from selected sheets
    const syncResult = await syncSheetsData(connection, savedSheets, supabase);
    return createSuccessResponse(
      {
        saved_sheets: savedSheets,
        sync_result: syncResult,
      },
      "Selected sheets saved and initial sync completed",
    );
  } catch (error) {
    console.error("Error saving selected sheets:", error);
    return createErrorResponse(`Failed to save selected sheets: ${error.message}`, 500);
  }
}
// Sync Sheets
export async function syncSheets(req, supabase) {
  try {
    const body = await req.json();
    const { connection_id, clinic_id } = body;
    if (!connection_id && !clinic_id) {
      return createErrorResponse("Either connection_id or clinic_id is required");
    }
    // Get Google Forms integration ID first
    const integrationId = await getGoogleFormsIntegrationId(supabase);

    let query = supabase
      .from("integration_connections")
      .select(
        `
        *,
        google_form_sheets (*)
      `,
      )
      .eq("status", "active")
      .eq("integration_id", integrationId);
    if (connection_id) {
      query = query.eq("id", connection_id);
    } else if (clinic_id) {
      query = query.eq("clinic_id", clinic_id);
    }
    const { data: connections, error: connectionError } = await query;
    if (connectionError || !connections || connections.length === 0) {
      return createErrorResponse("No active connections found", 404);
    }
    const totalResults = {
      total_processed: 0,
      leads_created: 0,
      connections_processed: 0,
      errors: [],
    };
    // Process each connection
    for (const connection of connections) {
      try {
        // Refresh token if needed
        let currentConnection = connection;
        if (connection.auth_data?.token_expiry && new Date(connection.auth_data.token_expiry) <= new Date()) {
          currentConnection = await refreshGoogleToken(connection, supabase);
        }
        const syncResult = await syncSheetsData(currentConnection, connection.google_form_sheets, supabase);
        totalResults.total_processed += syncResult.total_processed;
        totalResults.leads_created += syncResult.leads_created;
        totalResults.connections_processed += 1;
        totalResults.errors.push(...syncResult.errors);
        // Update last sync time in auth_data
        await updateIntegrationConnection(supabase, connection.id, {
          auth_data: {
            ...currentConnection.auth_data,
            last_sync_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error(`Error processing connection ${connection.id}:`, error);
        totalResults.errors.push(`Connection ${connection.id}: ${error.message}`);
        await updateIntegrationConnection(supabase, connection.id, {
          status: "inactive",
        });
      }
    }
    return createSuccessResponse(
      {
        summary: totalResults,
      },
      "Sheet sync completed",
    );
  } catch (error) {
    console.error("Error syncing sheets:", error);
    return createErrorResponse(`Failed to sync sheets: ${error.message}`, 500);
  }
}
// Sync Sheets Data
export async function syncSheetsData(connection, sheets, supabase) {
  console.log("🔄 Starting sheets data sync...");
  console.log("📊 Connection:", { id: connection.id, clinic_id: connection.clinic_id });
  console.log("📋 Sheets to sync:", sheets?.length || 0);

  let totalProcessed = 0;
  let leadsCreated = 0;
  const errors = [];

  // Get Google Forms lead source
  console.log("🔍 Looking for 'Google Forms' lead source...");
  const { data: leadSource, error: leadSourceError } = await supabase.from("lead_source").select("id").eq("name", "Google Forms").single();

  if (leadSourceError || !leadSource) {
    console.error("❌ Lead source error:", leadSourceError);
    console.log("🔍 Checking all available lead sources...");
    const { data: allSources } = await supabase.from("lead_source").select("*");
    console.log("📋 Available lead sources:", allSources);
    throw new Error('Lead source "Google Forms" not found in database');
  }

  console.log("✅ Found lead source:", leadSource);
  for (const sheet of sheets) {
    try {
      const sheetResult = await syncSingleSheet(connection, sheet, leadSource.id);
      totalProcessed += sheetResult.processed;
      leadsCreated += sheetResult.created;
      errors.push(...sheetResult.errors);
    } catch (error) {
      console.error(`Error syncing sheet ${sheet.sheet_title}:`, error);
      errors.push(`Sheet ${sheet.sheet_title}: ${error.message}`);
    }
  }
  return {
    total_processed: totalProcessed,
    leads_created: leadsCreated,
    errors: errors,
  };
}
// Sync Single Sheet
export async function syncSingleSheet(connection, sheet, leadSourceId) {
  console.log("📄 Syncing single sheet:", sheet.sheet_title || sheet.sheet_id);
  console.log("📊 Sheet details:", {
    spreadsheet_id: sheet.spreadsheet_id,
    sheet_title: sheet.sheet_title,
    sheet_id: sheet.sheet_id,
  });

  let processed = 0;
  let created = 0;
  const errors = [];

  try {
    // Clean spreadsheet_id to remove any unwanted suffixes
    let cleanSpreadsheetId = sheet.spreadsheet_id;
    if (cleanSpreadsheetId && cleanSpreadsheetId.includes("_sheet")) {
      cleanSpreadsheetId = cleanSpreadsheetId.split("_sheet")[0];
      console.log("🧹 Cleaning spreadsheet_id for API call:", { original: sheet.spreadsheet_id, cleaned: cleanSpreadsheetId });
    }

    // Use specific sheet name or default to "Form Responses 1"
    const sheetName = sheet.sheet_title || "Form Responses 1";
    // For Google Sheets API, we need to properly escape sheet names with spaces
    // Try using just the first sheet (index 0) if we can't get the name to work
    let sheetsUrl;
    if (sheetName.includes(" ")) {
      // For sheets with spaces, try using the sheet index approach or escape differently
      sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/A:Z`;
    } else {
      sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    }

    console.log("🌐 Fetching sheet data from:", sheetsUrl);
    console.log("🔑 Using access token:", connection.auth_data?.access_token ? "present" : "missing");

    const sheetsResponse = await fetch(sheetsUrl, {
      headers: {
        Authorization: `Bearer ${connection.auth_data.access_token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📥 Sheets API response status:", sheetsResponse.status);

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error("❌ Sheets API error:", errorText);
      throw new Error(`Failed to fetch sheet data: ${sheetsResponse.status} ${sheetsResponse.statusText} - ${errorText}`);
    }
    const sheetData = await sheetsResponse.json();
    const values = sheetData.values || [];

    console.log("📊 Sheet data received:", {
      total_rows: values.length,
      has_data: values.length > 0,
      first_row: values[0], // Headers
    });

    if (values.length === 0) {
      console.log("⚠️ No data found in sheet");
      return {
        processed: 0,
        created: 0,
        errors: ["No data found in sheet"],
      };
    }

    const headers = values[0];
    const dataRows = values.slice(1);

    console.log("📋 Headers found:", headers);
    console.log("📊 Data rows to process:", dataRows.length);

    // Collect all raw data for GPT processing
    const rawContactData = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      try {
        console.log(`🔄 Processing row ${i + 1}/${dataRows.length}:`, row);
        const result = await processSheetRow(row, headers);
        if (result.formData) {
          rawContactData.push(result.formData);
          processed++;
        }
      } catch (error) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        errors.push(`Row ${i + 1} processing error: ${error.message}`);
      }
    }

    // Use GPT to extract and clean contact data
    if (rawContactData.length > 0) {
      try {
        const requestId = `google-forms-${sheet.sheet_id}-${Date.now()}`;
        console.log(`[${requestId}] Extracting contacts using GPT from ${rawContactData.length} raw records`);

        const extractedContacts = await extractAndCleanContacts(rawContactData, requestId);
        console.log(`[${requestId}] GPT extracted ${extractedContacts.length} clean contacts`);

        if (extractedContacts.length > 0) {
          // Add source_id to each contact
          const contactsWithSource = extractedContacts.map(contact => ({
            ...contact,
            source_id: leadSourceId,
          }));

          // Send to queue in chunks
          const chunks = chunkArray(contactsWithSource, 50);
          for (const chunk of chunks) {
            try {
              await enqueueLead(chunk, connection.clinic_id);
              created += chunk.length;
              console.log(`[${requestId}] Enqueued ${chunk.length} contacts for processing`);
            } catch (enqueueError) {
              console.error(`[${requestId}] Failed to enqueue contacts:`, enqueueError);
              errors.push(`Failed to enqueue contacts: ${enqueueError.message}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error in GPT extraction and queue processing:`, error);
        errors.push(`GPT extraction error: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`Sheet ${sheet.sheet_title}: ${error.message}`);
  }
  return {
    processed,
    created,
    errors,
  };
}
// Process Sheet Row
export async function processSheetRow(row, headers) {
  console.log("🔍 Processing row with headers:", headers);
  console.log("📝 Row data:", row);

  const formData = {};

  // Map row data to form data
  headers.forEach((header, index) => {
    const value = row[index] || "";
    formData[header] = value;
  });

  console.log("🎯 Form data extracted:", formData);

  return {
    formData,
  };
}
// Get Spreadsheet Sheets
export async function getSpreadsheetSheets(spreadsheetId, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${response.statusText}`);
  }
  const spreadsheetData = await response.json();
  return spreadsheetData.sheets || [];
}
// Refresh Google Token with Enhanced Error Handling
export async function refreshGoogleToken(connection, supabase) {
  const connectionId = connection.id;
  const requestId = `refresh-${connectionId}-${Date.now()}`;

  console.log(`[${requestId}] 🔄 Starting token refresh for connection: ${connectionId}`);
  console.log(`[${requestId}] 📊 Current token expiry: ${connection.auth_data?.token_expiry}`);

  try {
    // Validate prerequisites
    if (!googleClientId || !googleClientSecret) {
      console.error(`[${requestId}] ❌ Missing OAuth credentials`);
      throw new Error("Google OAuth credentials not configured");
    }

    const refreshToken = connection.auth_data?.refresh_token;
    if (!refreshToken) {
      console.error(`[${requestId}] ❌ No refresh token available in connection`);
      throw new Error("No refresh token available - user needs to re-authenticate");
    }

    console.log(`[${requestId}] 🔑 Refresh token available, attempting refresh...`);

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    console.log(`[${requestId}] 📤 Sending refresh request to Google OAuth`);
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    console.log(`[${requestId}] 📥 Google OAuth response status: ${tokenResponse.status}`);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[${requestId}] ❌ Token refresh failed:`, {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });

      // Handle specific error cases
      if (tokenResponse.status === 400) {
        const errorData = JSON.parse(errorText);
        if (errorData.error === "invalid_grant") {
          console.error(`[${requestId}] ❌ Refresh token is invalid or expired - user needs to re-authenticate`);
          throw new Error("Refresh token invalid - re-authentication required");
        }
      }

      throw new Error(`Token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`[${requestId}] ✅ Token refresh successful:`, {
      access_token: tokenData.access_token ? "present" : "missing",
      refresh_token: tokenData.refresh_token ? "present" : "using existing",
      expires_in: tokenData.expires_in,
    });

    const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const updatedAuthData = {
      ...connection.auth_data,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.auth_data.refresh_token, // Google may not return new refresh token
      token_expiry: newExpiry,
      last_token_refresh: new Date().toISOString(),
    };

    console.log(`[${requestId}] 💾 Updating connection with new token data, expires: ${newExpiry}`);
    const { error: updateError } = await updateIntegrationConnection(supabase, connection.id, {
      auth_data: updatedAuthData,
    });

    if (updateError) {
      console.error(`[${requestId}] ❌ Failed to update connection:`, updateError);
      throw new Error(`Failed to update token in database: ${updateError.message}`);
    }

    console.log(`[${requestId}] ✅ Token refresh completed successfully`);
    return {
      ...connection,
      auth_data: updatedAuthData,
    };
  } catch (error) {
    console.error(`[${requestId}] ❌ Token refresh failed:`, error.message);

    // Only mark as inactive for certain types of errors
    const shouldDeactivate =
      error.message.includes("invalid_grant") ||
      error.message.includes("re-authentication required") ||
      error.message.includes("OAuth credentials not configured");

    if (shouldDeactivate) {
      console.log(`[${requestId}] 🔒 Marking connection as inactive due to unrecoverable error`);
      await updateIntegrationConnection(supabase, connection.id, {
        status: "inactive",
        auth_data: {
          ...connection.auth_data,
          last_refresh_error: error.message,
          last_refresh_attempt: new Date().toISOString(),
        },
      });
    } else {
      console.log(`[${requestId}] ⚠️ Temporary error, keeping connection active for retry`);
      // Log the error but don't deactivate - might be temporary network issue
      await updateIntegrationConnection(supabase, connection.id, {
        auth_data: {
          ...connection.auth_data,
          last_refresh_error: error.message,
          last_refresh_attempt: new Date().toISOString(),
        },
      });
    }

    throw error;
  }
}

// Process Selected Files from Google Picker
export async function processSelectedFiles(req, supabase) {
  try {
    console.log("📁 Processing selected files from Google Picker...");
    const body = await req.json();
    const { connection_id, selected_files } = body;

    if (!connection_id || !selected_files || !Array.isArray(selected_files)) {
      return createErrorResponse("connection_id and selected_files array are required");
    }

    console.log("📋 Processing files:", {
      connection_id,
      file_count: selected_files.length,
      files: selected_files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
    });

    const { connection: currentConnection, error } = await getConnectionWithTokenRefresh(supabase, connection_id);
    if (error) return error;

    // Process each selected file
    const processedFiles = [];
    for (const file of selected_files) {
      try {
        console.log(`📊 Processing file: ${file.name} (${file.mimeType})`);

        if (file.mimeType.includes("spreadsheet")) {
          // Get sheets for spreadsheet
          const sheets = await getSpreadsheetSheets(file.id, currentConnection.auth_data.access_token);

          const fileData = {
            spreadsheet_id: file.id,
            spreadsheet_title: file.name,
            sheets: sheets.map(sheet => ({
              sheet_id: sheet.properties.sheetId.toString(),
              sheet_title: sheet.properties.title,
            })),
            mimeType: file.mimeType,
            source: "picker",
          };

          processedFiles.push(fileData);
          console.log(`✅ Processed spreadsheet: ${file.name} with ${sheets.length} sheets`);
        } else {
          // For forms or other documents, just store basic info
          processedFiles.push({
            file_id: file.id,
            file_title: file.name,
            mimeType: file.mimeType,
            source: "picker",
          });
          console.log(`✅ Processed file: ${file.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing file ${file.name}:`, error);
      }
    }

    return createSuccessResponse(
      {
        connection_id: connection_id,
        processed_files: processedFiles,
        file_count: processedFiles.length,
      },
      "Files processed successfully",
    );
  } catch (error) {
    console.error("❌ Error processing selected files:", error);
    return createErrorResponse(`Failed to process selected files: ${error.message}`, 500);
  }
}

// Get Access Token from Database
export async function getAccessToken(req, supabase) {
  try {
    console.log("🔑 Fetching access token from database...");
    const body = await req.json();
    const { connection_id } = body;

    if (!connection_id) {
      return createErrorResponse("connection_id is required");
    }

    // Get connection from database
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select("auth_data")
      .eq("id", connection_id)
      .single();

    if (connectionError || !connection) {
      console.error("❌ Connection not found:", connectionError);
      return createErrorResponse("Connection not found", 404);
    }

    // Check if token needs refresh
    let accessToken = connection.auth_data.access_token;
    if (connection.auth_data?.token_expiry && new Date(connection.auth_data.token_expiry) <= new Date()) {
      console.log("🔄 Token expired, refreshing...");
      const refreshedConnection = await refreshGoogleToken({ id: connection_id, auth_data: connection.auth_data }, supabase);
      accessToken = refreshedConnection.auth_data.access_token;
    }

    console.log("✅ Access token retrieved successfully");

    return createSuccessResponse({
      access_token: accessToken,
      expires_at: connection.auth_data.token_expiry,
    });
  } catch (error) {
    console.error("❌ Error fetching access token:", error);
    return createErrorResponse(`Failed to fetch access token: ${error.message}`, 500);
  }
}

// Get Latest Connection for Clinic
export async function getLatestConnection(req, supabase) {
  try {
    console.log("🔍 Getting latest Google Form connection... [UPDATED VERSION v4 - with fallback]");
    const body = await req.json();
    const { clinic_id } = body;

    console.log("📋 Request parameters:", { clinic_id });

    if (!clinic_id) {
      console.error("❌ Missing clinic_id");
      return createErrorResponse("clinic_id is required");
    }

    // Get Google Forms integration ID first
    const integrationId = await getGoogleFormsIntegrationId(supabase);

    // Query the database for the latest connection for this clinic (any status)
    console.log("🔍 Checking all Google Forms connections for clinic:", clinic_id);
    const { data: allConnections } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false });

    console.log("📋 All connections found:", allConnections);

    if (allConnections && allConnections.length > 0) {
      console.log(
        "📊 Connection status values:",
        allConnections.map(c => ({ id: c.id, status: c.status })),
      );
    }

    // Try to get an active connection first
    const { data: connection, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("integration_id", integrationId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("❌ Database error for active connections:", error);
      if (error.code === "PGRST116") {
        // No active connections found, try to use the most recent connection regardless of status
        console.log("🔄 No active connections found, trying most recent connection...");
        if (allConnections && allConnections.length > 0) {
          const latestConnection = allConnections[0];
          console.log("✅ Using latest connection with status:", latestConnection.status);

          return createSuccessResponse({
            connection_id: latestConnection.id, // Use 'id' from database
            account_name: latestConnection.auth_data?.account_name || "Google Forms Account",
            email: latestConnection.auth_data?.email || "No email provided",
            created_at: latestConnection.created_at,
            status: latestConnection.status,
          });
        } else {
          return createErrorResponse("No Google Form connections found for this clinic", 404);
        }
      }

      return createErrorResponse(`Database error: ${error.message}`, 500);
    }

    console.log("✅ Latest connection found:", {
      connection_id: connection.id,
      account_name: connection.auth_data?.account_name,
      created_at: connection.created_at,
    });

    return createSuccessResponse({
      connection_id: connection.id, // Use 'id' from database
      account_name: connection.auth_data?.account_name || "Google Forms Account",
      email: connection.auth_data?.email || "No email provided",
      created_at: connection.created_at,
    });
  } catch (error) {
    console.error("❌ Error in getLatestConnection:", error);
    return createErrorResponse(`Internal server error: ${error.message}`, 500);
  }
}

// Submit Form Response (for public form submissions)
export async function submitFormResponse(req, supabase) {
  try {
    const body = await req.json();
    const { form_id, clinic_id, respondent_email, responses } = body;
    // Get form details
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("*, form_fields (*)")
      .eq("id", form_id)
      .eq("is_public", true)
      .eq("is_active", true)
      .single();
    if (formError || !form) {
      return new Response(
        JSON.stringify({
          error: "Form not found or not accessible",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Get Google Forms lead source
    const { data: leadSource, error: leadSourceError } = await supabase
      .from("lead_source")
      .select("id")
      .eq("name", "Google Forms")
      .single();
    if (leadSourceError || !leadSource) {
      return new Response(
        JSON.stringify({
          error: "Lead source not found",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Create form response record
    const { data: formResponse, error: responseError } = await supabase
      .from("form_responses")
      .insert({
        form_id,
        clinic_id,
        respondent_email,
        respondent_ip: req.headers.get("x-forwarded-for") || "unknown",
        is_complete: true,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (responseError) {
      return new Response(
        JSON.stringify({
          error: responseError.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Create field responses
    const fieldResponses = responses.map(response => ({
      form_response_id: formResponse.id,
      form_field_id: response.field_id,
      clinic_id,
      response_value: typeof response.value === "string" ? response.value : JSON.stringify(response.value),
      file_urls: response.file_urls || null,
    }));
    const { error: fieldResponsesError } = await supabase.from("form_field_responses").insert(fieldResponses);
    if (fieldResponsesError) {
      return new Response(
        JSON.stringify({
          error: fieldResponsesError.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Extract form data from responses
    const formData = {};
    for (const response of responses) {
      const field = form.form_fields.find(f => f.id === response.field_id);
      if (field) {
        formData[field.title] = response.value;
      }
    }

    // Add respondent email to form data
    if (respondent_email) {
      formData["email"] = respondent_email;
    }

    // Use GPT to extract and clean contact data
    let lead = null;
    try {
      const requestId = `google-forms-submission-${form_id}-${Date.now()}`;
      console.log(`[${requestId}] Processing form submission with GPT extraction`);

      const extractedContacts = await extractAndCleanContacts([formData], requestId);
      console.log(`[${requestId}] GPT extracted ${extractedContacts.length} contacts from form submission`);

      if (extractedContacts.length > 0) {
        const contactData = extractedContacts[0];

        // Add source_id to contact
        const contactWithSource = {
          ...contactData,
          source_id: leadSource.id,
        };

        // Send to queue for processing
        try {
          await enqueueLead([contactWithSource], clinic_id);
          console.log(`[${requestId}] Enqueued contact for processing`);

          // Create a placeholder lead record for the response
          lead = {
            first_name: contactData.firstName,
            last_name: contactData.lastName,
            email: contactData.email,
            phone: contactData.phone,
            status: "Processing",
            source_id: leadSource.id,
            clinic_id,
            form_data: formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } catch (enqueueError) {
          console.error(`[${requestId}] Failed to enqueue contact:`, enqueueError);
          // Rollback form response if enqueue fails
          await supabase.from("form_responses").delete().eq("id", formResponse.id);
          return new Response(
            JSON.stringify({
              error: "Failed to process lead data",
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
      } else {
        // Fallback: create basic lead if GPT extraction fails
        lead = {
          first_name: null,
          last_name: null,
          email: respondent_email,
          phone: null,
          status: "New",
          source_id: leadSource.id,
          clinic_id,
          form_data: formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error("GPT extraction failed, using fallback:", error);
      // Fallback: create basic lead
      lead = {
        first_name: null,
        last_name: null,
        email: respondent_email,
        phone: null,
        status: "New",
        source_id: leadSource.id,
        clinic_id,
        form_data: formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return new Response(
      JSON.stringify({
        data: {
          form_response: formResponse,
          lead,
        },
        message: "Form submitted successfully",
      }),
      {
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error submitting form:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to submit form",
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
}
