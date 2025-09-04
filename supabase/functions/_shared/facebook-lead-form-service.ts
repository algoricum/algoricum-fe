// Split into exported functions so index.ts can import them
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;
const FACEBOOK_API_VERSION = Deno.env.get("FACEBOOK_API_VERSION") || "v18.0";
const FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN = Deno.env.get("FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN") || generateRandomToken(20);

// -------------------- AUTH HANDLERS --------------------
export async function handleAuthStart(req: Request, url: URL) {
  const clinic_id = url.searchParams.get("clinic_id");
  const redirectTo = url.searchParams.get("redirect_to") || "";

  if (!clinic_id) {
    return new Response(JSON.stringify({ error: "clinic_id is required" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/callback`; // must be registered in FB App Valid OAuth Redirect URIs

  const state = encodeURIComponent(`${clinic_id}|${redirectTo}`);

  const fbAuthUrl = new URL(`https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`);
  fbAuthUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  fbAuthUrl.searchParams.set("redirect_uri", redirectUri);
  fbAuthUrl.searchParams.set("scope", "pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata,pages_manage_ads");
  fbAuthUrl.searchParams.set("response_type", "code");
  fbAuthUrl.searchParams.set("state", state);

  // Redirect the user to Facebook login
  return Response.redirect(fbAuthUrl.toString(), 302);
}
export async function handleAuthCallback(req: Request, url: URL, supabaseAdmin: any) {
  const params = url.searchParams;
  const code = params.get("code");
  const stateRaw = params.get("state") || "";

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code in callback" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  // parse state -> clinic_id|redirect_to
  const decodedState = decodeURIComponent(stateRaw);
  const [clinic_id, redirectToEncoded] = decodedState.split("|");
  const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;

  // const origin = ORIGIN_OVERRIDE || new URL(req.url).origin
  const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/callback`;

  // Exchange code for short-lived token
  const tokenExchangeUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`);
  tokenExchangeUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  tokenExchangeUrl.searchParams.set("redirect_uri", redirectUri);
  tokenExchangeUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
  tokenExchangeUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenExchangeUrl.toString());
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    console.error("Token exchange failed:", txt);
    return new Response(JSON.stringify({ error: "Failed to exchange code for token", details: txt }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
  const tokenJson = await tokenRes.json();
  const shortLivedAccessToken = tokenJson.access_token;
  if (!shortLivedAccessToken) {
    return new Response(JSON.stringify({ error: "No access_token returned by Facebook" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
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
    return new Response(JSON.stringify({ error: "Failed to exchange for long-lived token", details: txt }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
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
    return new Response(JSON.stringify({ error: "Failed to fetch pages", details: txt }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const accountsJson = await accountsRes.json();
  const pages = Array.isArray(accountsJson.data) ? accountsJson.data : [];
  console.log("Fetched pages:", accountsRes);
  if (!pages.length) {
    return new Response(JSON.stringify({ message: "No pages found for the user" }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const page of pages) {
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    if (!pageAccessToken) {
      console.warn(`Page ${pageId} missing page access token; skipping.`);
      continue;
    }

    // Fetch lead forms for this page
    const formsUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/leadgen_forms`);
    formsUrl.searchParams.set("access_token", pageAccessToken);
    formsUrl.searchParams.set("fields", "id,name,created_time");

    const formsRes = await fetch(formsUrl.toString());
    if (!formsRes.ok) {
      const txt = await formsRes.text();
      console.warn(`Failed to fetch lead forms for page ${pageId}:`, txt);
      // still continue to next page
      continue;
    }
    console.log("formsRes", formsRes);
    const formsJson = await formsRes.json();
    const forms = Array.isArray(formsJson.data) ? formsJson.data : [];

    if (!forms.length) {
      console.log(`No lead forms for page ${pageId}; skipping creating connections.`);
      continue;
    }

    for (const form of forms) {
      const leadFormId = form.id;
      // generate verify token per connection (optional)
      const webhookVerifyToken = generateRandomToken(30);

      const row = {
        clinic_id,
        facebook_page_id: pageId,
        lead_form_id: leadFormId,
        page_access_token: pageAccessToken,
        app_id: FACEBOOK_APP_ID,
        app_secret: FACEBOOK_APP_SECRET,
        webhook_verify_token: webhookVerifyToken,
        webhook_url: "", // we'll use the app-level webhook endpoint /facebook-webhook
        last_sync_at: null,
        sync_status: "active",
        token_expiry: userTokenExpiry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // upsert connection (unique constraint ensures single row)
      try {
        const { error: upsertErr } = await supabaseAdmin
          .from("facebook_lead_form_connections")
          .upsert(row, { onConflict: "clinic_id,facebook_page_id,lead_form_id", returning: "representation" });
        if (upsertErr) {
          console.error("Upsert error", upsertErr);
          results.push({ pageId, formId: leadFormId, ok: false, error: upsertErr.message });
        } else {
          results.push({ pageId, formId: leadFormId, ok: true });
        }
      } catch (dbErr) {
        console.error("DB error upserting connection", dbErr);
        results.push({ pageId, formId: leadFormId, ok: false, error: String(dbErr) });
      }

      // Subscribe the app to page leadgen (POST /{page-id}/subscribed_apps?subscribed_fields=leadgen)
      try {
        const subUrl = new URL(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/subscribed_apps`);
        subUrl.searchParams.set("access_token", pageAccessToken);
        subUrl.searchParams.set("subscribed_fields", "leadgen");
        const subRes = await fetch(subUrl.toString(), { method: "POST" });
        if (!subRes.ok) {
          const txt = await subRes.text();
          console.warn(`Failed to subscribe app to page ${pageId}:`, txt);
        } else {
          console.log(`Subscribed app to page ${pageId} for leadgen`);
        }
      } catch (subErr) {
        console.error("Failed subscribing app to page", subErr);
      }
    }
  }

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
  try {
    await fetchFacebookLeadFormResponses(clinic_id, supabaseAdmin);
    console.log("✅ Past leads fetched successfully after auth");
  } catch (error) {
    console.error("❌ Failed to fetch past leads after auth:", error);
  }
  const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

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

// -------------------- FETCH LEADS ----------------------
export async function fetchFacebookLeadFormResponses(reqOrClinicId: Request | string, supabaseAdmin: any) {
  // Accept either direct clinic_id (string) or Request body
  let clinic_id: string;
  if (typeof reqOrClinicId === "string") {
    clinic_id = reqOrClinicId;
  } else {
    const body = await reqOrClinicId.json();
    clinic_id = body?.clinic_id;
  }
  try {
    if (!clinic_id)
      return new Response(JSON.stringify({ error: "clinic_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });

    const { data: connections, error: connErr } = await supabaseAdmin
      .from("facebook_lead_form_connections")
      .select("*")
      .eq("clinic_id", clinic_id)
      .in("sync_status", ["active", "pending"]);

    if (connErr) {
      console.error("Failed to fetch connections", connErr);
      return new Response(JSON.stringify({ error: "Failed to fetch connections", details: connErr.message }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    if (!connections || connections.length === 0)
      return new Response(JSON.stringify({ message: "No active connections found" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });

    // find lead source id
    const { data: leadSource, error: leadSourceError } = await supabaseAdmin
      .from("lead_source")
      .select("id")
      .eq("name", "Facebook Lead Forms")
      .single();

    if (leadSourceError || !leadSource) {
      console.error("Lead source missing", leadSourceError);
      return new Response(JSON.stringify({ error: 'Lead source "Facebook Lead Forms" not found' }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0,
      totalCreated = 0;
    const errors: string[] = [];

    for (const connection of connections) {
      try {
        const pageToken = connection.page_access_token;
        const leadFormId = connection.lead_form_id;
        const leadsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${leadFormId}/leads?access_token=${encodeURIComponent(pageToken)}&fields=id,created_time,field_data`;
        if (connection.last_sync_at) {
          // const since = Math.floor(new Date(connection.last_sync_at).getTime() / 1000)
          // leadsUrl += `&since=${since}`
        }

        let nextUrl: string | null = leadsUrl;
        let pageCount = 0;
        while (nextUrl) {
          pageCount++;
          const resp = await fetch(nextUrl);
          if (!resp.ok) {
            const txt = await resp.text();
            console.error("Facebook API error:", txt);
            errors.push(`Connection ${connection.id}: Facebook API error ${txt}`);
            // mark failed
            await supabaseAdmin
              .from("facebook_lead_form_connections")
              .update({ sync_status: "failed", updated_at: new Date().toISOString() })
              .eq("id", connection.id);
            break;
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
          for (const leadData of leads) {
            try {
              let firstName: string | null = null;
              let lastName: string | null = null;
              let email: string | null = null;
              let phone: string | null = null;
              const formData: Record<string, any> = {};

              for (const [key, value] of Object.entries(leadData)) {
                const fname = key.toLowerCase();
                const fval = Array.isArray(value) ? value[0] : value;
                formData[fname] = fval;

                if (fname === "first_name") firstName = fval;
                if (fname === "last_name") lastName = fval;
                if (fname === "email") email = fval;
                if (fname === "phone" || fname === "phone_number") phone = fval;
                if (fname === "full_name" && !firstName && !lastName && fval) {
                  const parts = (fval as string).split(" ");
                  firstName = parts[0] || null;
                  lastName = parts.slice(1).join(" ") || null;
                }
                console.log("formData", formData);
              }

              if (!email) {
                console.log("Skipping lead without email", leadData.id);
                continue;
              }

              const { data: existingLead } = await supabaseAdmin
                .from("lead")
                .select("id")
                .eq("email", email)
                .eq("clinic_id", connection.clinic_id)
                .single();
              if (!existingLead) {
                const { error: insertErr } = await supabaseAdmin.from("lead").insert({
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
                });
                console.log("insertErr", leadData.id);
                if (insertErr) {
                  console.error("Insert error", insertErr);
                  errors.push(`Failed to insert lead ${email}: ${insertErr.message}`);
                } else totalCreated++;
              } else {
                // already exists
              }
              totalProcessed++;
            } catch (leadErr) {
              console.error("Lead item error", leadErr);
              errors.push(`lead ${leadData.id}: ${String(leadErr)}`);
            }
          }

          nextUrl = pageJson.paging && pageJson.paging.next ? pageJson.paging.next : null;
          if (pageCount > 1000) break;
        }

        await supabaseAdmin
          .from("facebook_lead_form_connections")
          .update({ last_sync_at: new Date().toISOString(), sync_status: "active", updated_at: new Date().toISOString() })
          .eq("id", connection.id);
      } catch (connErr) {
        console.error("Connection processing error", connErr);
        errors.push(`connection ${connection.id}: ${String(connErr)}`);
        await supabaseAdmin
          .from("facebook_lead_form_connections")
          .update({ sync_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", connection.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Processing complete",
        summary: { total_processed: totalProcessed, leads_created: totalCreated, connections_processed: connections.length, errors },
      }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fetchFacebookLeadFormResponses error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
}

// -------------------- WEBHOOKS -------------------------
export async function verifyFacebookWebhook(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === FACEBOOK_GLOBAL_WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified with global token");
      return new Response(challenge || "OK", { status: 200 });
    }

    console.warn("Webhook verification failed");
    return new Response("Forbidden", { status: 403 });
  } catch (err) {
    console.error("verifyFacebookWebhook error", err);
    return new Response("Error", { status: 500 });
  }
}
export async function handleFacebookWebhook(req: Request, supabaseAdmin: any) {
  try {
    const body = await req.json();
    if (!body) return new Response("No payload", { status: 400 });

    if (body.object !== "page" || !Array.isArray(body.entry)) return new Response("Ignored", { status: 200 });

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id || change.value?.lead_id || null;
        const formId = change.value?.form_id || null;
        const page_id_from_payload = change.value?.page_id || entry.id || null;

        if (!leadgenId || !formId || !page_id_from_payload) {
          console.warn("Webhook missing identifiers", change);
          continue;
        }

        // Find active connections in DB for page+form
        const { data: connections, error: connErr } = await supabaseAdmin
          .from("facebook_lead_form_connections")
          .select("*")
          .eq("facebook_page_id", page_id_from_payload)
          .eq("lead_form_id", formId)
          .in("sync_status", ["active", "pending"]);

        if (connErr || !connections || connections.length === 0) {
          console.warn("No active connection for webhook lead", { page_id_from_payload, formId });
          continue;
        }

        for (const connection of connections) {
          try {
            await processFacebookLead(leadgenId, connection, supabaseAdmin);
          } catch (err) {
            console.error("Error processing webhook lead for connection", connection.id, err);
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("handleFacebookWebhook error", err);
    return new Response("Error", { status: 500 });
  }
}
async function processFacebookLead(leadgenId: string, connection: any, supabaseAdmin: any) {
  try {
    const pageToken = connection.page_access_token;
    const leadUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${leadgenId}?access_token=${encodeURIComponent(pageToken)}&fields=id,created_time,field_data`;
    const res = await fetch(leadUrl);
    if (!res.ok) {
      const txt = await res.text();
      console.error("Failed to fetch lead", txt);
      return;
    }
    const leadData = await res.json();
    if (!leadData) return;

    const formData: any = {};
    let firstName: string | null = null;
    let lastName: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;

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
          const parts = (fval as string).split(" ");
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

    const { data: existingLead } = await supabaseAdmin
      .from("lead")
      .select("id")
      .eq("email", email)
      .eq("clinic_id", connection.clinic_id)
      .single();
    if (!existingLead) {
      const { error: insertErr } = await supabaseAdmin.from("lead").insert({
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
      });
      if (insertErr) console.error("Insert lead error", insertErr);
      else console.log("Inserted lead", email);
    } else {
      console.log("Lead exists", email);
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
