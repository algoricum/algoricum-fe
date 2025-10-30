// Split into exported functions so index.ts can import them
import { corsHeaders } from "../_shared/cors.ts";
import { chunkArray, enqueueLead } from "./Lead-enqueue.ts";
import { extractAndCleanContacts } from "./gpt-extractor-service.ts";

// Helper function to get Facebook Lead Forms integration ID
async function getFacebookLeadFormsIntegrationId(supabaseAdmin) {
  const { data: integration, error } = await supabaseAdmin.from("integrations").select("id").eq("name", "Facebook Lead Forms").single();

  if (error || !integration) {
    throw new Error(`Facebook Lead Forms integration not found: ${error?.message || "Missing integration"}`);
  }

  return integration.id;
}

// Helper function to get all Facebook Lead Forms connections for a clinic
async function getFacebookConnections(supabaseAdmin, clinicId, filters = {}) {
  const integrationId = await getFacebookLeadFormsIntegrationId(supabaseAdmin);

  let query = supabaseAdmin.from("integration_connections").select("*").eq("clinic_id", clinicId).eq("integration_id", integrationId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data: connections, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch Facebook connections: ${error.message}`);
  }

  return connections || [];
}

// Helper function to filter connections by Facebook page and form
function filterConnectionsByPageAndForm(connections, pageId, formId = null) {
  return connections.filter(conn => {
    const authData = conn.auth_data;
    if (!authData?.facebook_page_id || authData.facebook_page_id !== pageId) {
      return false;
    }
    if (formId) {
      // Check both single form ID and array of form IDs
      const hasFormId =
        authData.lead_form_id === formId || (Array.isArray(authData.lead_form_ids) && authData.lead_form_ids.includes(formId));
      if (!hasFormId) {
        return false;
      }
    }
    return true;
  });
}

// Helper function to transform connections to legacy format for compatibility
function transformConnectionsToLegacyFormat(connections) {
  return connections
    .map(conn => ({
      id: conn.id,
      clinic_id: conn.clinic_id,
      facebook_page_id: conn.auth_data?.facebook_page_id,
      page_access_token: conn.auth_data?.page_access_token,
      lead_form_id: conn.auth_data?.lead_form_id,
      lead_form_ids: conn.auth_data?.lead_form_ids, // Add support for multiple form IDs
      sync_status: conn.auth_data?.sync_status,
      last_sync_at: conn.auth_data?.last_sync_at,
      token_expiry: conn.auth_data?.token_expiry,
      created_at: conn.created_at,
    }))
    .filter(conn => conn.facebook_page_id);
}

// Helper function to update auth_data for a connection
async function updateConnectionAuthData(supabaseAdmin, connectionId, authDataUpdates) {
  // First get the current connection
  const { data: currentConnection, error: fetchError } = await supabaseAdmin
    .from("integration_connections")
    .select("auth_data")
    .eq("id", connectionId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch connection for update: ${fetchError.message}`);
  }

  // Merge the updates with existing auth_data
  const updatedAuthData = { ...currentConnection.auth_data, ...authDataUpdates };

  const { error: updateError } = await supabaseAdmin
    .from("integration_connections")
    .update({
      auth_data: updatedAuthData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  if (updateError) {
    throw new Error(`Failed to update connection auth_data: ${updateError.message}`);
  }

  return updatedAuthData;
}

// Helper function to create Facebook API URL
function createFacebookApiUrl(apiPath, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${apiPath}`);
  url.searchParams.set("access_token", accessToken);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

// Helper function to fetch from Facebook API with error handling
async function fetchFacebookApi(apiPath, accessToken, params = {}) {
  const url = createFacebookApiUrl(apiPath, accessToken, params);
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const FACEBOOK_API_VERSION = Deno.env.get("FACEBOOK_API_VERSION") || "v18.0";
const FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN = Deno.env.get("FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN") || generateRandomToken(20);
// -------------------- AUTH HANDLERS --------------------
export async function handleAuthStart(req, url) {
  const clinic_id = url.searchParams.get("clinic_id");
  const redirectTo = url.searchParams.get("redirect_to") || "";
  if (!clinic_id) {
    return new Response(
      JSON.stringify({
        error: "clinic_id is required",
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
  const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/callback`; // must be registered in FB App Valid OAuth Redirect URIs
  const state = encodeURIComponent(`${clinic_id}|${redirectTo}`);
  const fbAuthUrl = new URL(`https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`);
  fbAuthUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  fbAuthUrl.searchParams.set("redirect_uri", redirectUri);
  fbAuthUrl.searchParams.set(
    "scope",
    "pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata,pages_manage_ads,business_management",
  );
  fbAuthUrl.searchParams.set("response_type", "code");
  fbAuthUrl.searchParams.set("state", state);
  // Redirect the user to Facebook login
  return Response.redirect(fbAuthUrl.toString(), 302);
}
export async function handleAuthCallback(req, url, supabaseAdmin) {
  const params = url.searchParams;
  const code = params.get("code");
  const stateRaw = params.get("state") || "";
  // parse state -> clinic_id|redirect_to
  const decodedState = decodeURIComponent(stateRaw);
  const [clinic_id, redirectToEncoded] = decodedState.split("|");
  const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;
  if (!code) {
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  // const origin = ORIGIN_OVERRIDE || new URL(req.url).origin
  const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/callback`;
  // Exchange code for short-lived token
  const tokenExchangeUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`);
  tokenExchangeUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  tokenExchangeUrl.searchParams.set("redirect_uri", redirectUri);
  tokenExchangeUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
  tokenExchangeUrl.searchParams.set("code", code || "");
  const tokenRes = await fetch(tokenExchangeUrl.toString());
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    console.error("Token exchange failed:", txt);
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  const tokenJson = await tokenRes.json();
  const shortLivedAccessToken = tokenJson.access_token;
  if (!shortLivedAccessToken) {
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  // Exchange to long-lived token
  const longUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  longUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
  longUrl.searchParams.set("fb_exchange_token", shortLivedAccessToken);
  const longRes = await fetch(longUrl.toString());
  if (!longRes.ok) {
    const txt = await longRes.text();
    console.error("Long token exchange failed:", txt);
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  const longJson = await longRes.json();
  const userAccessToken = longJson.access_token;
  const userTokenExpirySec = longJson.expires_in ? Number(longJson.expires_in) : null;
  const userTokenExpiry = userTokenExpirySec ? new Date(Date.now() + userTokenExpirySec * 1000).toISOString() : null;
  // Fetch pages (accounts) that the user manages
  const accountsUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/accounts`);
  accountsUrl.searchParams.set("access_token", userAccessToken);
  accountsUrl.searchParams.set("fields", "id,name,access_token,tasks");
  console.log("accesstoken", userAccessToken);
  const accountsRes = await fetch(accountsUrl.toString());
  if (!accountsRes.ok) {
    const txt = await accountsRes.text();
    console.error("Failed to fetch pages:", txt);
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  const accountsJson = await accountsRes.json();
  const pages = Array.isArray(accountsJson.data) ? accountsJson.data : [];
  console.log("Fetched pages:", accountsJson);
  if (!pages.length) {
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("facebook_lead_form_status", "error");
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders(),
            Location: redirectUrl.toString(),
          },
        });
      } catch {
        // if invalid redirect, fall through to JSON
      }
    }
  }
  const results = [];

  // Store initial connection info for each page (without specific forms)
  // This allows fetching forms later and gives users the choice
  for (const page of pages) {
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    if (!pageAccessToken) {
      console.warn(`Page ${pageId} missing page access token; skipping.`);
      continue;
    }

    // Check if there are any lead forms for this page
    const formsUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/leadgen_forms`);
    formsUrl.searchParams.set("access_token", pageAccessToken);
    formsUrl.searchParams.set("fields", "id,name,created_time");
    const formsRes = await fetch(formsUrl.toString());
    if (!formsRes.ok) {
      const txt = await formsRes.text();
      console.warn(`Failed to fetch lead forms for page ${pageId}:`, txt);
      continue;
    }

    const formsJson = await formsRes.json();
    const forms = Array.isArray(formsJson.data) ? formsJson.data : [];
    if (!forms.length) {
      console.log(`No lead forms for page ${pageId}; skipping page setup.`);
      continue;
    }

    // Store connection info for the page using integration_connections table
    // This preserves tokens and page info for later form selection
    const integrationId = await getFacebookLeadFormsIntegrationId(supabaseAdmin);
    const row = {
      clinic_id,
      integration_id: integrationId,
      status: "active",
      auth_data: {
        facebook_page_id: pageId,
        lead_form_id: "pending_selection", // Dummy form ID for form selection state
        page_access_token: pageAccessToken,
        app_id: FACEBOOK_APP_ID,
        app_secret: FACEBOOK_APP_SECRET,
        token_expiry: userTokenExpiry,
        sync_status: "pending", // Set to pending since forms haven't been selected yet
        last_sync_at: null,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: upsertErr } = await supabaseAdmin.from("integration_connections").upsert(row, {
        onConflict: "clinic_id,integration_id",
        returning: "representation",
      });
      if (upsertErr) {
        console.error("Upsert error for page setup", upsertErr);
        results.push({
          pageId,
          formId: "page_setup",
          ok: false,
          error: upsertErr.message,
        });
        continue;
      } else {
        results.push({
          pageId,
          formId: "page_setup",
          ok: true,
          totalForms: forms.length,
        });
      }
    } catch (dbErr) {
      console.error("DB error upserting page connection", dbErr);
      results.push({
        pageId,
        formId: "page_setup",
        ok: false,
        error: String(dbErr),
      });
      continue;
    }

    console.log(
      `✅ Page ${pageId} setup completed for clinic ${clinic_id} with ${forms.length} available forms - user can now select specific forms`,
    );
  }
  // Note: Past leads will be fetched only after user selects specific forms
  console.log("✅ Facebook authentication completed - user can now select forms to connect");
  const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";
  // redirect back to UI if provided
  if (redirectTo) {
    try {
      const redirectUrl = new URL(redirectTo);
      redirectUrl.searchParams.set("facebook_lead_form_status", "success");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders(),
          Location: redirectUrl.toString(),
        },
      });
    } catch {
      // if invalid redirect, fall through to JSON
    }
  }
  const redirectUrl = new URL(`${APP_URL}/onboarding`);
  redirectUrl.searchParams.set("facebook_lead_form_status", "success");
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders(),
      Location: redirectUrl.toString(),
    },
  });
}
// -------------------- UPDATED WEBHOOK HANDLERS ----------------------
// Updated webhook verification to handle clinic-specific webhooks
export async function verifyFacebookWebhook(req, clinicId, supabaseAdmin) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token) {
      // For root-level webhook, use global token verification
      if (token === FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN) {
        console.log("Webhook verified with global token");
        return new Response(challenge || "OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // If clinic_id is provided, also check clinic-specific tokens for backward compatibility
      if (clinicId && supabaseAdmin) {
        try {
          const connections = await getFacebookConnections(supabaseAdmin, clinicId, { status: "active" });
          const validConnection = connections.find(conn => conn.auth_data?.webhook_verify_token === token);

          if (validConnection) {
            console.log(`Webhook verified for clinic ${clinicId}`);
            return new Response(challenge || "OK", {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            });
          }
        } catch (error) {
          console.error("Error checking clinic-specific webhook token:", error);
        }
      }
    }
    console.warn("Webhook verification failed");
    return new Response("Forbidden", {
      status: 403,
    });
  } catch (err) {
    console.error("verifyFacebookWebhook error", err);
    return new Response("Error", {
      status: 500,
    });
  }
}
// Updated webhook handler to work with clinic-specific routes
export async function handleFacebookWebhook(req, supabaseAdmin, clinicId) {
  try {
    console.log(`🎯 Facebook webhook received for clinic: ${clinicId}`);
    const body = await req.json();
    console.log(`📦 Webhook payload:`, JSON.stringify(body, null, 2));
    if (!body) {
      console.error("❌ No payload received");
      return new Response("No payload", {
        status: 400,
      });
    }
    if (body.object !== "page" || !Array.isArray(body.entry)) {
      console.log(`⚠️ Ignoring webhook - object: ${body.object}, entry is array: ${Array.isArray(body.entry)}`);
      return new Response("Ignored", {
        status: 200,
      });
    }
    for (const entry of body.entry) {
      console.log(`🔍 Processing entry:`, entry);
      if (!Array.isArray(entry.changes)) {
        console.log(`⚠️ Entry has no changes array`);
        continue;
      }
      for (const change of entry.changes) {
        console.log(`📝 Processing change:`, change);
        if (change.field !== "leadgen") {
          console.log(`⚠️ Skipping non-leadgen change: ${change.field}`);
          continue;
        }
        const leadgenId = change.value?.leadgen_id || change.value?.lead_id || null;
        const formId = change.value?.form_id || null;
        const page_id_from_payload = change.value?.page_id || entry.id || null;
        console.log(`🔍 Lead identifiers:`, {
          leadgenId,
          formId,
          page_id_from_payload,
          clinicId,
        });
        if (!leadgenId || !formId || !page_id_from_payload) {
          console.warn("❌ Webhook missing required identifiers", {
            leadgenId,
            formId,
            page_id_from_payload,
            change,
          });
          continue;
        }
        // Build query for finding connections using helper functions
        try {
          let allConnections;
          if (clinicId) {
            // Get connections for specific clinic
            allConnections = await getFacebookConnections(supabaseAdmin, clinicId, { status: "active" });
          } else {
            // Get all active Facebook connections (for global webhook)
            const integrationId = await getFacebookLeadFormsIntegrationId(supabaseAdmin);
            const { data: globalConnections, error: connErr } = await supabaseAdmin
              .from("integration_connections")
              .select("*")
              .eq("integration_id", integrationId)
              .eq("status", "active");

            if (connErr) throw new Error(connErr.message);
            allConnections = globalConnections || [];
          }

          // Filter connections by page_id and form_id from auth_data
          const connections = filterConnectionsByPageAndForm(allConnections, page_id_from_payload, formId).filter(
            conn => conn.auth_data?.sync_status === "active",
          );
          console.log(`🔍 Database query result:`, {
            connections: connections?.length || 0,
            query_params: {
              page_id_from_payload,
              formId,
              clinicId: clinicId || "any",
            },
          });

          if (!connections || connections.length === 0) {
            console.warn("⚠️ No active connection found for webhook lead", {
              page_id_from_payload,
              formId,
              clinicId: clinicId || "any",
            });

            // Check if there are any connections for this page/form at all
            const integrationId = await getFacebookLeadFormsIntegrationId(supabaseAdmin);
            const { data: allPageConnections } = await supabaseAdmin
              .from("integration_connections")
              .select("*")
              .eq("integration_id", integrationId);
            const anyConnections = filterConnectionsByPageAndForm(allPageConnections || [], page_id_from_payload, formId);
            console.log(`🔍 All connections for this page/form:`, anyConnections);
            continue;
          }

          console.log(`✅ Found ${connections.length} active connection(s) for lead`);
          for (const connection of connections) {
            try {
              console.log(`🚀 Processing lead ${leadgenId} for clinic ${connection.clinic_id}`);
              await processFacebookLead(leadgenId, transformConnectionsToLegacyFormat([connection])[0], supabaseAdmin);
            } catch (err) {
              console.error("Error processing webhook lead for connection", connection.id, err);
            }
          }
        } catch (queryError) {
          console.error("❌ Database error querying connections:", queryError);
          continue;
        }
      }
    }
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    console.error("handleFacebookWebhook error", err);
    return new Response("Error", {
      status: 500,
    });
  }
}
// -------------------- FETCH AVAILABLE PAGES ----------------------
export async function fetchAvailablePages(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { clinic_id } = body;

    if (!clinic_id) {
      return new Response(
        JSON.stringify({
          error: "clinic_id is required",
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

    // Get all connections for this clinic to find connected pages
    const integrationConnections = await getFacebookConnections(supabaseAdmin, clinic_id, { status: "active" });
    const connections = transformConnectionsToLegacyFormat(integrationConnections);

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          pages: [],
          message: "No Facebook pages connected. Please authenticate first.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Group connections by page ID
    const pageConnections = {};
    connections.forEach(conn => {
      if (!pageConnections[conn.facebook_page_id]) {
        pageConnections[conn.facebook_page_id] = {
          page_id: conn.facebook_page_id,
          page_access_token: conn.page_access_token,
          connected_at: conn.created_at,
          connections: [],
        };
      }
      pageConnections[conn.facebook_page_id].connections.push({
        form_id: conn.lead_form_id,
        sync_status: conn.sync_status,
      });
    });

    // Fetch page details for each connected page
    const enhancedPages = [];
    for (const pageData of Object.values(pageConnections)) {
      try {
        if (!pageData.page_access_token) continue;

        // Fetch page info
        try {
          const pageInfo = await fetchFacebookApi(pageData.page_id, pageData.page_access_token, {
            fields: "id,name,picture,about,category,fan_count,website",
          });

          // Count actual form connections (excluding pending_selection)
          const actualFormConnections = pageData.connections.filter(conn => conn.form_id !== "pending_selection");

          enhancedPages.push({
            ...pageInfo,
            connected_forms_count: actualFormConnections.length,
            has_pending_setup: pageData.connections.some(conn => conn.form_id === "pending_selection"),
            total_connections: pageData.connections.length,
            connected_at: pageData.connected_at,
            connection_status: actualFormConnections.length > 0 ? "active" : "pending",
          });
        } catch (apiError) {
          console.warn(`Failed to fetch page info for ${pageData.page_id}:`, apiError);
          continue;
        }
      } catch (pageErr) {
        console.error("Error fetching page info:", pageErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pages: enhancedPages,
        total_pages: enhancedPages.length,
        summary: {
          active_pages: enhancedPages.filter(p => p.connection_status === "active").length,
          pending_pages: enhancedPages.filter(p => p.connection_status === "pending").length,
          total_connected_forms: enhancedPages.reduce((sum, p) => sum + p.connected_forms_count, 0),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("fetchAvailablePages error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err.message,
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

// -------------------- FETCH AVAILABLE FORMS ----------------------
export async function fetchAvailableForms(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { clinic_id, facebook_page_id } = body;

    if (!clinic_id || !facebook_page_id) {
      return new Response(
        JSON.stringify({
          error: "clinic_id and facebook_page_id are required",
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

    // Get any existing connection to get the page access token
    const integrationConnections = await getFacebookConnections(supabaseAdmin, clinic_id, { status: "active" });
    const pageConnections = filterConnectionsByPageAndForm(integrationConnections, facebook_page_id);
    const pageTokenConnections = transformConnectionsToLegacyFormat(pageConnections);
    const validConnection = pageTokenConnections?.find(conn => conn.page_access_token);

    if (!validConnection || !validConnection.page_access_token) {
      return new Response(
        JSON.stringify({
          error: "No valid Facebook connection found for this page. Please re-authenticate.",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    }

    const pageAccessToken = validConnection.page_access_token;

    // Fetch all lead forms for this page with campaign info
    const formsUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${facebook_page_id}/leadgen_forms`);
    formsUrl.searchParams.set("access_token", pageAccessToken);
    formsUrl.searchParams.set("fields", "id,name,created_time,status,leads_count,page_id,is_continued_flow_form");
    formsUrl.searchParams.set("limit", "100"); // Increase limit to get more forms

    const formsRes = await fetch(formsUrl.toString());

    if (!formsRes.ok) {
      const txt = await formsRes.text();
      console.error(`Failed to fetch lead forms for page ${facebook_page_id}:`, txt);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch forms from Facebook",
          details: txt,
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

    let allForms = [];
    let nextUrl = formsUrl.toString();

    // Handle pagination to get all forms
    while (nextUrl) {
      const currentRes = await fetch(nextUrl);
      if (!currentRes.ok) {
        console.error("Failed to fetch forms page:", await currentRes.text());
        break;
      }

      const currentJson = await currentRes.json();
      const currentForms = Array.isArray(currentJson.data) ? currentJson.data : [];
      allForms = allForms.concat(currentForms);

      // Check for next page
      nextUrl = currentJson.paging?.next || null;

      // Safety limit to prevent infinite loops
      if (allForms.length > 500) {
        console.warn("Reached safety limit of 500 forms");
        break;
      }
    }

    // Sort forms by creation time (newest first) to prioritize recent campaigns
    const forms = allForms.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

    // Get existing connections for this clinic/page to mark which forms are already connected
    const pageFormConnections = filterConnectionsByPageAndForm(integrationConnections, facebook_page_id).filter(
      conn => conn.auth_data?.lead_form_id !== "pending_selection",
    );
    const existingConnections = transformConnectionsToLegacyFormat(pageFormConnections);

    const connectedFormIds = new Set(existingConnections?.map(conn => conn.lead_form_id) || []);

    // Enhance forms with connection status and metadata
    const enhancedForms = forms.map(form => {
      const createdDate = new Date(form.created_time);
      const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...form,
        is_connected: connectedFormIds.has(form.id),
        connection_status: existingConnections?.find(conn => conn.lead_form_id === form.id)?.sync_status || null,
        days_since_created: daysSinceCreated,
        created_date_formatted: createdDate.toLocaleDateString(),
        is_recent: daysSinceCreated <= 30, // Consider forms from last 30 days as recent
        is_active: form.status === "ACTIVE",
        estimated_leads: form.leads_count || 0,
      };
    });

    // Group forms by status and recency for better UX
    const activeForms = enhancedForms.filter(form => form.is_active);
    const recentForms = enhancedForms.filter(form => form.is_recent);
    const connectedForms = enhancedForms.filter(form => form.is_connected);
    const availableForms = enhancedForms.filter(form => !form.is_connected && form.is_active);

    return new Response(
      JSON.stringify({
        success: true,
        forms: enhancedForms,
        total_count: enhancedForms.length,
        summary: {
          total_forms: enhancedForms.length,
          active_forms: activeForms.length,
          recent_forms: recentForms.length,
          connected_forms: connectedForms.length,
          available_forms: availableForms.length,
        },
        grouped: {
          recent_active: enhancedForms.filter(form => form.is_recent && form.is_active),
          older_active: enhancedForms.filter(form => !form.is_recent && form.is_active),
          inactive: enhancedForms.filter(form => !form.is_active),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("fetchAvailableForms error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err.message,
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

// -------------------- SAVE SELECTED FORMS ----------------------
export async function saveSelectedForms(req, supabaseAdmin) {
  try {
    const body = await req.json();
    const { clinic_id, facebook_page_id, selected_form_ids } = body;

    if (!clinic_id || !facebook_page_id || !Array.isArray(selected_form_ids)) {
      return new Response(
        JSON.stringify({
          error: "clinic_id, facebook_page_id, and selected_form_ids (array) are required",
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

    // Get existing connection to get tokens and verify access
    const integrationConnections = await getFacebookConnections(supabaseAdmin, clinic_id, { status: "active" });
    const pageConnections = filterConnectionsByPageAndForm(integrationConnections, facebook_page_id);
    const pageTokenConnections = transformConnectionsToLegacyFormat(pageConnections);
    const existingConnection = pageTokenConnections?.find(conn => conn.page_access_token);

    if (!existingConnection || !existingConnection.page_access_token) {
      return new Response(
        JSON.stringify({
          error: "No valid Facebook connection found for this page. Please re-authenticate.",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    }

    const pageAccessToken = existingConnection.page_access_token;
    const results = [];

    try {
      // Get the existing "pending_selection" connection to update
      const integrationId = await getFacebookLeadFormsIntegrationId(supabaseAdmin);
      const { data: existingConnections, error: fetchError } = await supabaseAdmin
        .from("integration_connections")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("integration_id", integrationId);

      if (fetchError) {
        throw new Error(`Failed to fetch existing connections: ${fetchError.message}`);
      }

      // Find the pending connection for this page
      let pendingConnection = existingConnections?.find(
        conn => conn.auth_data?.facebook_page_id === facebook_page_id && conn.auth_data?.lead_form_id === "pending_selection",
      );

      // If no pending connection exists, look for any active connection for this page that we can update
      if (!pendingConnection) {
        pendingConnection = existingConnections?.find(
          conn => conn.auth_data?.facebook_page_id === facebook_page_id && conn.status === "active",
        );
      }

      if (!pendingConnection) {
        throw new Error("No connection found for this page. Please re-authenticate.");
      }

      // Update the pending connection with the selected forms
      const updatedAuthData = {
        ...pendingConnection.auth_data,
        lead_form_ids: selected_form_ids, // Store multiple form IDs
        lead_form_id: selected_form_ids[0], // Keep first form for backward compatibility
        sync_status: "active",
        last_sync_at: null,
      };

      const { error: updateError } = await supabaseAdmin
        .from("integration_connections")
        .update({
          auth_data: updatedAuthData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingConnection.id);

      if (updateError) {
        throw new Error(`Failed to update connection: ${updateError.message}`);
      }

      // Subscribe the app to page leadgen
      try {
        const subUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${facebook_page_id}/subscribed_apps`);
        subUrl.searchParams.set("access_token", pageAccessToken);
        subUrl.searchParams.set("subscribed_fields", "leadgen");

        const subRes = await fetch(subUrl.toString(), {
          method: "POST",
        });

        if (!subRes.ok) {
          const txt = await subRes.text();
          console.warn(`Failed to subscribe app to page ${facebook_page_id}:`, txt);
        } else {
          console.log(`Subscribed app to page ${facebook_page_id} for leadgen`);
        }
      } catch (subErr) {
        console.error("Failed subscribing app to page", subErr);
      }

      // Mark all forms as successful since we updated the single connection
      for (const formId of selected_form_ids) {
        results.push({
          formId,
          success: true,
        });
      }

      console.log(`✅ Connection updated with forms [${selected_form_ids.join(", ")}] for page ${facebook_page_id}, clinic ${clinic_id}`);
    } catch (error) {
      console.error("Error updating connection with selected forms:", error);
      // Mark all forms as failed
      for (const formId of selected_form_ids) {
        results.push({
          formId,
          success: false,
          error: error.message,
        });
      }
    }

    // Fetch past leads for the new connections
    try {
      await fetchFacebookLeadFormResponses(clinic_id, supabaseAdmin);
      console.log("✅ Past leads fetched successfully after form selection");
    } catch (error) {
      console.error("❌ Failed to fetch past leads after form selection:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Forms processed successfully",
        results,
        total_processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("saveSelectedForms error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err.message,
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

// -------------------- FETCH LEADS ----------------------
export async function fetchFacebookLeadFormResponses(reqOrClinicId, supabaseAdmin) {
  // Accept either direct clinic_id (string) or Request body
  let clinic_id;
  if (typeof reqOrClinicId === "string") {
    clinic_id = reqOrClinicId;
  } else {
    const body = await reqOrClinicId.json();
    clinic_id = body?.clinic_id;
  }
  try {
    if (!clinic_id)
      return new Response(
        JSON.stringify({
          error: "clinic_id is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    const integrationConnections = await getFacebookConnections(supabaseAdmin, clinic_id, { status: "active" });

    // Filter connections that have active sync_status and are not pending selection
    const activeConnections = integrationConnections.filter(
      conn => conn.auth_data?.sync_status === "active" && conn.auth_data?.lead_form_id !== "pending_selection",
    );
    const connections = transformConnectionsToLegacyFormat(activeConnections);
    if (!connections || connections.length === 0)
      return new Response(
        JSON.stringify({
          message: "No active connections found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        },
      );
    // find lead source id
    const { data: leadSource, error: leadSourceError } = await supabaseAdmin
      .from("lead_source")
      .select("id")
      .eq("name", "Facebook Lead Forms")
      .single();
    if (leadSourceError || !leadSource) {
      console.error("Lead source missing", leadSourceError);
      return new Response(
        JSON.stringify({
          error: 'Lead source "Facebook Lead Forms" not found',
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
    let totalProcessed = 0,
      totalCreated = 0;
    const errors = [];
    for (const connection of connections) {
      try {
        const pageToken = connection.page_access_token;

        // Get form IDs to process - handle both single form and multiple forms
        let formIdsToProcess = [];
        if (connection.lead_form_ids && Array.isArray(connection.lead_form_ids)) {
          formIdsToProcess = connection.lead_form_ids;
        } else if (connection.lead_form_id && connection.lead_form_id !== "pending_selection") {
          formIdsToProcess = [connection.lead_form_id];
        } else {
          console.log("Skipping connection - no valid form IDs found:", connection.id);
          continue;
        }

        console.log(`Processing ${formIdsToProcess.length} forms for connection ${connection.id}:`, formIdsToProcess);

        // Process each form in this connection
        for (const leadFormId of formIdsToProcess) {
          try {
            const leadParams = {
              fields: "id,created_time,field_data",
              limit: "100",
            };

            // If this is the first sync, limit to last 90 days to avoid overwhelming the system
            if (!connection.last_sync_at) {
              const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
              leadParams.since = ninetyDaysAgo;
              console.log("First sync - fetching leads from last 90 days");
            } else {
              const since = Math.floor(new Date(connection.last_sync_at).getTime() / 1000);
              console.log("Incremental sync since:", since);
              leadParams.since = since;
            }

            let nextUrl = createFacebookApiUrl(`${leadFormId}/leads`, pageToken, leadParams);
            let pageCount = 0;
            while (nextUrl) {
              pageCount++;
              const resp = await fetch(nextUrl);
              if (!resp.ok) {
                const txt = await resp.text();
                console.error("Facebook API error:", txt);
                errors.push(`Connection ${connection.id}, Form ${leadFormId}: Facebook API error ${txt}`);
                break; // Skip to next form
              }
              const pageJson = await resp.json();
              console.log("response", pageJson);
              const leads = Array.isArray(pageJson.data)
                ? pageJson.data.map(lead => ({
                    id: lead.id,
                    created_time: lead.created_time,
                    ...Object.fromEntries((lead.field_data || []).map(f => [f.name, f.values?.[0] ?? null])),
                  }))
                : [];
              // Process leads in chunks using GPT extraction
              if (leads.length > 0) {
                console.log(`Processing ${leads.length} leads through GPT extraction...`);
                try {
                  // Extract and clean contacts using GPT
                  const extractedContacts = await extractAndCleanContacts(leads);
                  console.log(`GPT extracted ${extractedContacts.length} contacts from ${leads.length} leads`);

                  // Process extracted contacts in chunks
                  const chunks = chunkArray(extractedContacts, 10);
                  for (const chunk of chunks) {
                    for (const contact of chunk) {
                      try {
                        if (!contact.email) {
                          console.log("Skipping contact without email", contact);
                          continue;
                        }

                        // Enqueue the lead for processing
                        const enqueuedLead = {
                          first_name: contact.first_name || null,
                          last_name: contact.last_name || null,
                          email: contact.email,
                          phone: contact.phone || null,
                          status: "New",
                          source_id: leadSource.id,
                          clinic_id: connection.clinic_id,
                          form_data: contact.form_data || contact, // Use cleaned form data
                          created_at: contact.created_time || new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        };

                        await enqueueLead([enqueuedLead], connection.clinic_id);
                        totalCreated++;
                      } catch (leadErr) {
                        console.error("Lead processing error", leadErr);
                        errors.push(`lead processing: ${String(leadErr)}`);
                      }
                    }
                  }
                  totalProcessed += leads.length;
                } catch (extractionError) {
                  console.error("GPT extraction failed, falling back to direct processing:", extractionError);
                  errors.push(`GPT extraction failed: ${String(extractionError)}`);

                  // Fallback to direct processing if GPT extraction fails
                  for (const leadData of leads) {
                    try {
                      const formData = {};
                      let firstName = null,
                        lastName = null,
                        email = null,
                        phone = null;

                      for (const [key, value] of Object.entries(leadData)) {
                        const fname = key.toLowerCase();
                        const fval = Array.isArray(value) ? value[0] : value;
                        formData[fname] = fval;
                        if (fname === "first_name") firstName = fval;
                        if (fname === "last_name") lastName = fval;
                        if (fname === "email") email = fval;
                        if (fname === "phone" || fname === "phone_number") phone = fval;
                        if (fname === "full_name" && !firstName && !lastName && fval) {
                          const parts = fval.split(" ");
                          firstName = parts[0] || null;
                          lastName = parts.slice(1).join(" ") || null;
                        }
                      }

                      if (!email) continue;

                      const fallbackLead = {
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone,
                        status: "New",
                        source_id: leadSource.id,
                        clinic_id: connection.clinic_id,
                        form_data: formData,
                        created_at: leadData.created_time || new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };

                      await enqueueLead([fallbackLead], connection.clinic_id);
                      totalCreated++;
                    } catch (leadErr) {
                      console.error("Fallback lead processing error", leadErr);
                      errors.push(`fallback lead ${leadData.id}: ${String(leadErr)}`);
                    }
                  }
                  totalProcessed += leads.length;
                }
              }
              nextUrl = pageJson.paging && pageJson.paging.next ? pageJson.paging.next : null;
              if (pageCount > 1000) break;
            }
          } catch (formErr) {
            console.error(`Error processing form ${leadFormId}:`, formErr);
            errors.push(`Form ${leadFormId}: ${String(formErr)}`);
          }
        }

        // Update successful sync - update auth_data
        await updateConnectionAuthData(supabaseAdmin, connection.id, {
          last_sync_at: new Date().toISOString(),
          sync_status: "active",
        });
      } catch (connErr) {
        console.error("Connection processing error", connErr);
        errors.push(`connection ${connection.id}: ${String(connErr)}`);
        // Update failed sync - update auth_data
        await updateConnectionAuthData(supabaseAdmin, connection.id, { sync_status: "failed" });
      }
    }
    return new Response(
      JSON.stringify({
        message: "Processing complete",
        summary: {
          total_processed: totalProcessed,
          leads_created: totalCreated,
          connections_processed: connections.length,
          errors,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("fetchFacebookLeadFormResponses error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
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
async function processFacebookLead(leadgenId, connection, supabaseAdmin) {
  try {
    const pageToken = connection.page_access_token;
    try {
      const leadData = await fetchFacebookApi(leadgenId, pageToken, {
        fields: "id,created_time,field_data",
      });
      if (!leadData) return;
      // Convert field_data to the expected format for GPT extraction
      const transformedLead = {
        id: leadData.id,
        created_time: leadData.created_time,
        ...Object.fromEntries((leadData.field_data || []).map(f => [f.name, f.values?.[0] ?? null])),
      };

      try {
        // Use GPT extraction for single lead processing
        console.log(`Processing lead ${leadgenId} through GPT extraction...`);
        const extractedContacts = await extractAndCleanContacts([transformedLead]);

        if (extractedContacts.length > 0) {
          const contact = extractedContacts[0];
          if (!contact.email) {
            console.log(`Skipping lead ${leadgenId} — no email found after GPT extraction`);
            return;
          }

          // find lead source id
          const { data: leadSource } = await supabaseAdmin.from("lead_source").select("id").eq("name", "Facebook Lead Forms").single();
          const sourceId = leadSource?.id || null;

          // Enqueue the lead for processing
          const enqueuedLead = {
            first_name: contact.first_name || null,
            last_name: contact.last_name || null,
            email: contact.email,
            phone: contact.phone || null,
            status: "New",
            source_id: sourceId,
            clinic_id: connection.clinic_id,
            form_data: contact.form_data || contact,
            created_at: contact.created_time || leadData.created_time || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await enqueueLead([enqueuedLead], connection.clinic_id);
          console.log(`Processed lead ${leadgenId} successfully via GPT extraction and queue`);
        } else {
          console.log(`No contacts extracted from lead ${leadgenId}`);
        }
      } catch (extractionError) {
        console.error(`GPT extraction failed for lead ${leadgenId}, falling back to direct processing:`, extractionError);

        // Fallback to direct processing
        const formData = {};
        let firstName = null,
          lastName = null,
          email = null,
          phone = null;

        if (Array.isArray(leadData.field_data)) {
          for (const field of leadData.field_data) {
            const fname = (field.name || "unknown").toLowerCase();
            const fval = Array.isArray(field.values) ? field.values[0] : field.values;
            formData[fname] = fval;
            if (fname === "first_name") firstName = fval;
            if (fname === "last_name") lastName = fval;
            if (fname === "email") email = fval;
            if (fname === "phone_number" || fname === "phone") phone = fval;
            if (fname === "full_name" && !firstName && !lastName && fval) {
              const parts = fval.split(" ");
              firstName = parts[0] || null;
              lastName = parts.slice(1).join(" ") || null;
            }
          }
        }

        if (!email) {
          console.log(`Skipping lead ${leadgenId} — no email found`);
          return;
        }

        // find lead source id
        const { data: leadSource } = await supabaseAdmin.from("lead_source").select("id").eq("name", "Facebook Lead Forms").single();
        const sourceId = leadSource?.id || null;

        const fallbackLead = {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          status: "New",
          source_id: sourceId,
          clinic_id: connection.clinic_id,
          form_data: formData,
          created_at: leadData.created_time || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await enqueueLead([fallbackLead], connection.clinic_id);
        console.log(`Processed lead ${leadgenId} via fallback processing`);
      }
    } catch (apiError) {
      console.error(`Failed to fetch lead ${leadgenId} from Facebook API:`, apiError);
    }
  } catch (err) {
    console.error("processFacebookLead error", err);
  }
}
// -------------------- HELPERS --------------------------
function generateRandomToken(len = 32) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += charset[arr[i] % charset.length];
  return out;
}
