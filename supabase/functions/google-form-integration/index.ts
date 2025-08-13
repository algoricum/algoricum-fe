import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
const googleRedirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
    const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    console.log("Debug - Path:", path, "Method:", method);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Health check endpoint
    if ((method === "GET" || method === "POST") && (path === "/" || path === "/google-form-integration" || path.includes("/health"))) {
      return new Response(
        JSON.stringify({
          message: "Google Integration API is running",
          timestamp: new Date().toISOString(),
          method_received: method,
          path_received: path,
          usage_instructions: {
            step1: "Call POST /initiate-oauth to start OAuth flow",
            step2: "User will be redirected to Google for authorization",
            step3: "After OAuth success, call POST /list-spreadsheets to get available sheets",
            step4: "Call POST /save-selected-sheets to save selected sheets and create leads",
            step5: "Use POST /sync-sheets for manual sync later",
          },
          available_routes: [
            "POST /google-form-integration/initiate-oauth - Start OAuth flow",
            "GET /google-form-integration/oauth/callback - OAuth callback",
            "POST /google-form-integration/list-spreadsheets - List available spreadsheets",
            "POST /google-form-integration/save-selected-sheets - Save selected sheets",
            "POST /google-form-integration/sync-sheets - Manually sync sheets",
            "POST /google-form-integration/public/submit - Submit form data",
          ],
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Route handlers
    if (method === "POST" && (path.includes("/initiate-oauth") || path.endsWith("/initiate-oauth"))) {
      return await initiateOAuthFlow(req, supabaseAdmin);
    }

    if (method === "GET" && (path.includes("/oauth/callback") || path.endsWith("/oauth/callback"))) {
      return await handleOAuthCallback(req, supabaseAdmin);
    }

    if (method === "POST" && (path.includes("/list-spreadsheets") || path.endsWith("/list-spreadsheets"))) {
      return await listGoogleSpreadsheets(req, supabaseAdmin);
    }

    if (method === "POST" && (path.includes("/save-selected-sheets") || path.endsWith("/save-selected-sheets"))) {
      return await saveSelectedSheets(req, supabaseAdmin);
    }

    if (method === "POST" && (path.includes("/sync-sheets") || path.endsWith("/sync-sheets"))) {
      return await syncSheets(req, supabaseAdmin);
    }

    if (method === "POST" && (path.includes("/public/submit") || path.endsWith("/public/submit"))) {
      return await submitFormResponse(req, supabaseAdmin);
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
          ...corsHeaders,
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
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

// Initiate OAuth Flow
async function initiateOAuthFlow(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { clinic_id, user_id } = body;

    if (!clinic_id) {
      return new Response(
        JSON.stringify({
          error: "clinic_id is required",
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

    const state = btoa(
      JSON.stringify({
        clinic_id,
        user_id,
        timestamp: Date.now(),
      }),
    );

    const scopes = [
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/forms.body.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ];

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", googleClientId);
    authUrl.searchParams.set("redirect_uri", googleRedirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({
        message: "OAuth flow initiated",
        auth_url: authUrl.toString(),
        instructions: "Redirect user to auth_url to complete OAuth flow",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to initiate OAuth flow",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

// Handle OAuth Callback
async function handleOAuthCallback(req, supabaseAdmin) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const redirectUrl = new URL(`${APP_URL}onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", error);

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    if (!code || !state) {
      const redirectUrl = new URL(`${APP_URL}onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "missing_parameters");

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch (e) {
      const redirectUrl = new URL(`${APP_URL}onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "invalid_state");

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    // Exchange code for tokens
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "token_exchange_failed");

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    const tokenData = await tokenResponse.json();

    // Create connection record
    const connectionData = {
      clinic_id: stateData.clinic_id,
      user_id: stateData.user_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      sync_status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("google_form_connections")
      .insert(connectionData)
      .select()
      .single();

    if (connectionError) {
      console.error("Database error:", connectionError);
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
      redirectUrl.searchParams.set("google_form_status", "error");
      redirectUrl.searchParams.set("error", "database_error");

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    // Redirect to success page with connection ID
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
    redirectUrl.searchParams.set("google_form_status", "success");
    redirectUrl.searchParams.set("connection_id", connection.id);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl.toString(),
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
      const redirectUrl = new URL(`${APP_URL}/onboarding`);
    redirectUrl.searchParams.set("google_form_status", "error");
    redirectUrl.searchParams.set("error", "unexpected_error");

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl.toString(),
      },
    });
  }
}

// List Google Spreadsheets
async function listGoogleSpreadsheets(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { connection_id } = body;

    if (!connection_id) {
      return new Response(
        JSON.stringify({
          error: "connection_id is required",
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

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("google_form_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({
          error: "Connection not found",
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

    // Refresh token if needed
    let currentConnection = connection;
    if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
      currentConnection = await refreshGoogleToken(connection, supabaseAdmin);
    }

    // Get spreadsheets from Google Drive
    const spreadsheetsUrl = "https://www.googleapis.com/drive/v3/files";
    const spreadsheetsResponse = await fetch(spreadsheetsUrl + '?q=mimeType="application/vnd.google-apps.spreadsheet"', {
      headers: {
        Authorization: `Bearer ${currentConnection.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!spreadsheetsResponse.ok) {
      throw new Error(`Failed to fetch spreadsheets: ${spreadsheetsResponse.statusText}`);
    }

    const spreadsheetsData = await spreadsheetsResponse.json();

    // Get sheets for each spreadsheet
    const spreadsheets = await Promise.all(
      spreadsheetsData.files.map(async file => {
        const sheets = await getSpreadsheetSheets(file.id, currentConnection.access_token);
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

    return new Response(
      JSON.stringify({
        message: "Spreadsheets retrieved successfully",
        connection_id: connection_id,
        spreadsheets,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error listing spreadsheets:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to list spreadsheets",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

// Save Selected Sheets
async function saveSelectedSheets(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { connection_id, selected_sheets } = body;

    if (!connection_id || !selected_sheets || !Array.isArray(selected_sheets)) {
      return new Response(
        JSON.stringify({
          error: "connection_id and selected_sheets array are required",
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

    // Get connection
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("google_form_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({
          error: "Connection not found",
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

    // Save selected sheets to database
    const sheetInserts = selected_sheets.map(sheet => ({
      connection_id: connection_id,
      spreadsheet_id: sheet.spreadsheet_id,
      spreadsheet_title: sheet.spreadsheet_title,
      sheet_id: sheet.sheet_id,
      sheet_title: sheet.sheet_title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: savedSheets, error: sheetError } = await supabaseAdmin.from("google_form_sheets").insert(sheetInserts).select();

    if (sheetError) {
      return new Response(
        JSON.stringify({
          error: "Failed to save selected sheets",
          details: sheetError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Update connection status to active
    const { error: updateError } = await supabaseAdmin
      .from("google_form_connections")
      .update({
        sync_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection_id);

    if (updateError) {
      console.error("Failed to update connection status:", updateError);
    }

    // Sync data from selected sheets
    const syncResult = await syncSheetsData(connection, savedSheets, supabaseAdmin);

    return new Response(
      JSON.stringify({
        message: "Selected sheets saved and initial sync completed",
        saved_sheets: savedSheets,
        sync_result: syncResult,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error saving selected sheets:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to save selected sheets",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

// Sync Sheets
async function syncSheets(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { connection_id, clinic_id } = body;

    if (!connection_id && !clinic_id) {
      return new Response(
        JSON.stringify({
          error: "Either connection_id or clinic_id is required",
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

    let query = supabaseAdmin
      .from("google_form_connections")
      .select(
        `
        *,
        google_form_sheets (*)
      `,
      )
      .eq("sync_status", "active");

    if (connection_id) {
      query = query.eq("id", connection_id);
    } else if (clinic_id) {
      query = query.eq("clinic_id", clinic_id);
    }

    const { data: connections, error: connectionError } = await query;

    if (connectionError || !connections || connections.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No active connections found",
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

    let totalResults = {
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
        if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
          currentConnection = await refreshGoogleToken(connection, supabaseAdmin);
        }

        const syncResult = await syncSheetsData(currentConnection, connection.google_form_sheets, supabaseAdmin);

        totalResults.total_processed += syncResult.total_processed;
        totalResults.leads_created += syncResult.leads_created;
        totalResults.connections_processed += 1;
        totalResults.errors.push(...syncResult.errors);

        // Update last sync time
        await supabaseAdmin
          .from("google_form_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      } catch (error) {
        console.error(`Error processing connection ${connection.id}:`, error);
        totalResults.errors.push(`Connection ${connection.id}: ${error.message}`);

        await supabaseAdmin
          .from("google_form_connections")
          .update({
            sync_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Sheet sync completed",
        summary: totalResults,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error syncing sheets:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to sync sheets",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

// Sync Sheets Data
async function syncSheetsData(connection, sheets, supabaseAdmin) {
  let totalProcessed = 0;
  let leadsCreated = 0;
  const errors = [];

  // Get Google Forms lead source
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from("lead_source")
    .select("id")
    .eq("name", "Google Forms")
    .single();

  if (leadSourceError || !leadSource) {
    throw new Error('Lead source "Google Forms" not found in database');
  }

  for (const sheet of sheets) {
    try {
      const sheetResult = await syncSingleSheet(connection, sheet, leadSource.id, supabaseAdmin);
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
async function syncSingleSheet(connection, sheet, leadSourceId, supabaseAdmin) {
  let processed = 0;
  let created = 0;
  const errors = [];

  try {
    // Use specific sheet name or default to "Form Responses 1"
    const sheetName = sheet.sheet_title || "Form Responses 1";
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheet_id}/values/${encodeURIComponent(sheetName)}`;

    const sheetsResponse = await fetch(sheetsUrl, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!sheetsResponse.ok) {
      throw new Error(`Failed to fetch sheet data: ${sheetsResponse.statusText}`);
    }

    const sheetData = await sheetsResponse.json();
    const values = sheetData.values || [];
    console.log("Fetched values:", values);
    if (values.length === 0) {
      return { processed: 0, created: 0, errors: [] };
    }

    const headers = values[0];
    const dataRows = values.slice(1);

    // Process each row
    for (const row of dataRows) {
      try {
        const result = await processSheetRow(row, headers, leadSourceId, connection.clinic_id, supabaseAdmin);
        if (result.created) created++;
        processed++;
      } catch (error) {
        errors.push(`Row processing error: ${error.message}`);
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
async function processSheetRow(row, headers, leadSourceId, clinicId, supabaseAdmin) {
  const formData = {};
  let firstName = null;
  let lastName = null;
  let email = null;
  let phone = null;

  // Map row data to form data
  headers.forEach((header, index) => {
    const value = row[index] || "";
    formData[header] = value;

    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes("first name") || lowerHeader.includes("firstname")) {
      firstName = value;
    } else if (lowerHeader.includes("last name") || lowerHeader.includes("lastname")) {
      lastName = value;
    } else if (lowerHeader.includes("email")) {
      email = value;
    } else if (lowerHeader.includes("phone")) {
      phone = value;
    }
  });

  if (!email) {
    throw new Error("No email found in row");
  }

  // Check if lead already exists
  const { data: existingLead } = await supabaseAdmin.from("lead").select("id").eq("email", email).eq("clinic_id", clinicId).single();

  if (existingLead) {
    return { created: false };
  }

  // Create new lead
  const { error: leadError } = await supabaseAdmin.from("lead").insert({
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    status: "New",
    source_id: leadSourceId,
    clinic_id: clinicId,
    form_data: formData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (leadError) {
    throw new Error(`Failed to create lead: ${leadError.message}`);
  }

  return { created: true };
}

// Get Spreadsheet Sheets
async function getSpreadsheetSheets(spreadsheetId, accessToken) {
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

// Refresh Google Token
async function refreshGoogleToken(connection, supabaseAdmin) {
  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    const updatedToken = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin.from("google_form_connections").update(updatedToken).eq("id", connection.id);

    if (updateError) {
      throw new Error("Failed to update token");
    }

    return {
      ...connection,
      ...updatedToken,
    };
  } catch (error) {
    await supabaseAdmin
      .from("google_form_connections")
      .update({
        sync_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    throw error;
  }
}

// Submit Form Response (for public form submissions)
async function submitFormResponse(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { form_id, clinic_id, respondent_email, responses } = body;

    // Get form details
    const { data: form, error: formError } = await supabaseAdmin
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
    const { data: leadSource, error: leadSourceError } = await supabaseAdmin
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
    const { data: formResponse, error: responseError } = await supabaseAdmin
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
            ...corsHeaders,
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

    const { error: fieldResponsesError } = await supabaseAdmin.from("form_field_responses").insert(fieldResponses);

    if (fieldResponsesError) {
      return new Response(
        JSON.stringify({
          error: fieldResponsesError.message,
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

    // Extract lead data from responses
    const formData = {};
    let firstName = null;
    let lastName = null;
    let email = respondent_email || null;
    let phone = null;

    for (const response of responses) {
      const field = form.form_fields.find(f => f.id === response.field_id);
      if (field) {
        formData[field.title] = response.value;

        const lowerTitle = field.title.toLowerCase();
        if (lowerTitle.includes("first name") || lowerTitle.includes("firstname")) {
          firstName = response.value;
        } else if (lowerTitle.includes("last name") || lowerTitle.includes("lastname")) {
          lastName = response.value;
        } else if (lowerTitle.includes("email")) {
          email = response.value;
        } else if (lowerTitle.includes("phone")) {
          phone = response.value;
        }
      }
    }

    // Create lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("lead")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        status: "New",
        source_id: leadSource.id,
        clinic_id,
        form_data: formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leadError) {
      // Rollback form response if lead creation fails
      await supabaseAdmin.from("form_responses").delete().eq("id", formResponse.id);

      return new Response(
        JSON.stringify({
          error: leadError.message,
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
          ...corsHeaders,
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
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
}
