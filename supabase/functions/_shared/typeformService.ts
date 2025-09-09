// supabase/functions/typeform-integration/typeformService.ts
import { corsHeaders } from "./cors.ts";
import { supabase } from "./supabaseClient.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const TYPEFORM_CLIENT_ID = Deno.env.get("TYPEFORM_CLIENT_ID")!;
const TYPEFORM_CLIENT_SECRET = Deno.env.get("TYPEFORM_CLIENT_SECRET")!;

// 🔹 STEP 1: OAuth Start
export async function startAuth(url: URL) {
  const clinic_id = url.searchParams.get("clinic_id");
  const redirectURL = url.searchParams.get("redirectTo");

  if (!clinic_id) {
    return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const state = encodeURIComponent(`${clinic_id}|${redirectURL}`);
  const redirectTo = `${supabaseUrl}/functions/v1/typeform-integration/auth/callback`;

  const authUrl = `https://api.typeform.com/oauth/authorize?client_id=${TYPEFORM_CLIENT_ID}&redirect_uri=${redirectTo}&scope=responses:read forms:read webhooks:write webhooks:read&state=${state}`;

  return new Response(JSON.stringify({ url: authUrl }), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// 🔹 STEP 2: OAuth Callback
export async function handleCallback(url: URL) {
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";

  const decodedState = decodeURIComponent(stateRaw);
  const [clinic_id, redirectToEncoded] = decodedState.split("|");
  const redirectTo = redirectToEncoded ? decodeURIComponent(redirectToEncoded) : null;

  if (!code || !clinic_id) {
    return new Response("Missing code/state", { status: 400 });
  }

  // Exchange code for tokens
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("client_id", TYPEFORM_CLIENT_ID);
  params.append("client_secret", TYPEFORM_CLIENT_SECRET);
  params.append("redirect_uri", `${supabaseUrl}/functions/v1/typeform-integration/auth/callback`);

  const tokenRes = await fetch("https://api.typeform.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("OAuth error:", tokenData);
    return new Response("OAuth failed", { status: 400 });
  }

  const expires_at = new Date();
  expires_at.setSeconds(expires_at.getSeconds() + tokenData.expires_in);

  // Ensure Typeform integration exists
  const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Typeform").single();

  if (!integration) {
    return new Response("Integration not configured", { status: 500 });
  }

  // Upsert connection
  const ast = await supabase.from("integration_connections").upsert(
    {
      clinic_id,
      integration_id: integration.id,
      status: "active",
      auth_data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expires_at.toISOString(),
        forms: [],
      },
    },
    { onConflict: "clinic_id,integration_id" },
  );
  if (ast.error) {
    console.error("Error upserting connection:", ast.error);
    return new Response("Failed to save connection", { status: 500 });
  }

  return Response.redirect(`${redirectTo}?typeform_status=success`, 302);
}

// 🔹 STEP 3: Update Forms
export async function updateForms(req: Request) {
  const { clinic_id, forms } = await req.json();
  if (!clinic_id || !Array.isArray(forms)) {
    return new Response("Missing clinic_id or forms[]", { status: 400 });
  }

  const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Typeform").single();

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, auth_data, clinic_id")
    .eq("clinic_id", clinic_id)
    .eq("integration_id", integration.id)
    .single();

  if (!connection) {
    return new Response("No connection found", { status: 404 });
  }

  const oldForms: string[] = connection.auth_data?.forms || [];
  const accessToken = connection.auth_data?.access_token;

  const added = forms.filter((f: string) => !oldForms.includes(f));
  const removed = oldForms.filter((f: string) => !forms.includes(f));

  try {
    for (const formId of added) {
      // Register webhook
      try {
        const resp = await fetch(`https://api.typeform.com/forms/${formId}/webhooks/${clinic_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: `${supabaseUrl}/functions/v1/typeform-integration/webhook?clinic_id=${clinic_id}`,
            enabled: true,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`❌ Failed to register webhook for form ${formId}: ${resp.status} ${errText}`);
        } else {
          console.log(`✅ Webhook registered for form ${formId}`);
        }
      } catch (innerErr) {
        console.error(`⚠️ Error registering webhook for ${formId}:`, innerErr);
      }

      // Fetch old responses for this form
      try {
        const res = await fetch(`https://api.typeform.com/forms/${formId}/responses`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.ok) {
          const respData = await res.json();
          for (const r of respData.items || []) {
            const answers: Record<string, any> = {};
            for (const ans of r.answers || []) {
              if (ans.field && ans.field.type) {
                const normalized = normalizeFieldName(ans.field.type);
                answers[normalized] = ans[ans.type];
              }
            }
            const { data: source } = await supabase.from("lead_source").select("id").eq("name", "Others").single();
            await supabase.from("lead").insert({
              clinic_id,
              source_id: source.id, // lead_source FK
              first_name: answers.first_name || null,
              last_name: answers.last_name || null,
              email: answers.email || null,
              phone: answers.phone || null,
              form_data: {
                form_id: formId,
                submitted_at: r.submitted_at,
                answers,
                raw: r,
              },
            });
          }
          console.log(`📥 Imported old responses for form ${formId}`);
        } else {
          console.error(`❌ Failed fetching old responses for ${formId}: ${res.status}`);
        }
      } catch (fetchErr) {
        console.error("🔥 Error fetching old responses:", fetchErr);
      }
    }
  } catch (outerErr) {
    console.error("🔥 Unexpected error during webhook registration:", outerErr);
  }

  for (const formId of removed) {
    await fetch(`https://api.typeform.com/forms/${formId}/webhooks/${clinic_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  await supabase
    .from("integration_connections")
    .update({ auth_data: { ...connection.auth_data, forms } })
    .eq("id", connection.id);

  return new Response(JSON.stringify({ added, removed }), {
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

// 🔹 STEP 4: Webhook
export async function handleWebhook(req: Request, url: URL) {
  const clinic_id = url.searchParams.get("clinic_id");
  if (!clinic_id) {
    console.error("Missing clinic_id in webhook request");
    return new Response("Missing clinic_id", { status: 400 });
  }

  const payload = await req.json();
  const answers: Record<string, any> = {};

  for (const ans of payload.form_response.answers) {
    if (ans.field && ans.field.type) {
      const normalized = normalizeFieldName(ans.field.type);
      answers[normalized] = ans[ans.type];
    }
  }
  const { data: source } = await supabase.from("lead_source").select("id").eq("name", "Others").single();
  const webhok = await supabase.from("lead").insert({
    clinic_id,
    source_id: source.id,
    first_name: answers.first_name || null,
    last_name: answers.last_name || null,
    email: answers.email || null,
    phone: answers.phone || null,
    form_data: {
      form_id: payload.form_response.form_id,
      submitted_at: payload.form_response.submitted_at,
      answers,
      raw: payload,
    },
  });
  if (webhok.error) {
    console.error("Error inserting lead:", webhok.error);
    return new Response("Error inserting lead", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

// 🔹 STEP 5: Get Forms
export async function getForms(req: Request) {
  try {
    const { clinic_id } = await req.json();
    const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Typeform").single();
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("auth_data")
      .eq("clinic_id", clinic_id)
      .eq("integration_id", integration.id)
      .single();

    if (!connection?.auth_data?.access_token) {
      return new Response(JSON.stringify({ error: "No Typeform token found" }), {
        status: 400,
        headers: { ...corsHeaders() },
      });
    }

    const typeformRes = await fetch("https://api.typeform.com/forms", {
      headers: {
        Authorization: `Bearer ${connection.auth_data.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const forms = await typeformRes.json();

    return new Response(JSON.stringify({ forms: forms.items }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
}

// Utility
function normalizeFieldName(title: string): string {
  const lower = title.toLowerCase().trim();
  if (["first name", "firstname", "given name"].includes(lower)) {
    return "first_name";
  }
  if (["last name", "lastname", "surname", "family name"].includes(lower)) {
    return "last_name";
  }
  if (["email", "e-mail", "mail"].includes(lower)) {
    return "email";
  }
  if (["phone", "phone number", "mobile", "telephone", "phone_number"].includes(lower)) {
    return "phone";
  }
  return lower.replace(/\s+/g, "_");
}
