// supabase/functions/gohighlevel/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

const CLIENT_ID = Deno.env.get("GHL_Client_ID") || "";
const CLIENT_SECRET =Deno.env.get("GHL_Client_Secret") || "";
const REDIRECT_URI = Deno.env.get("SUPABASE_URL")! + "/functions/v1/GHL-integration/auth/callback";
const GHL_AUTH_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";
const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const GHL_CONTACTS_URL = "https://services.leadconnectorhq.com/contacts/";
 const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("name", "Typeform")
      .single();
// 🔹 Replace these with actual IDs from your DB
const INTEGRATION_ID =integration?.id;
const SOURCE_ID = "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c";

async function saveTokens(clinic_id: string, tokenData: any) {
  const { access_token, refresh_token, expires_in, locationId } = tokenData;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabase.from("integration_connections").upsert(
    {
      clinic_id,
      integration_id: INTEGRATION_ID,
      status: "active",
      expires_at: expiresAt,
      auth_data: {
        access_token,
        refresh_token,
        expires_in,
        location_id: locationId,
      },
    },
    { onConflict: "clinic_id,integration_id" },
  );

  return { access_token, refresh_token, expires_in, locationId, expiresAt };
}

async function refreshTokens(clinic_id: string) {
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("auth_data, expires_at")
    .eq("clinic_id", clinic_id)
    .eq("integration_id", INTEGRATION_ID)
    .single();

  if (!conn) throw new Error("No integration connection found");

  const { auth_data, expires_at } = conn;

  // if not expired, return current token
  if (new Date(expires_at) > new Date()) {
    return auth_data;
  }

  // refresh
  const res = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: auth_data.refresh_token,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh token");

  const tokenData = await res.json();
  return await saveTokens(clinic_id, tokenData);
}

async function importLeads(clinic_id: string) {
  const tokens = await refreshTokens(clinic_id);
  const { access_token, location_id } = tokens;

  const contactsRes = await fetch(`${GHL_CONTACTS_URL}?locationId=${location_id}&limit=50`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${access_token}`,
      Version: "2021-07-28",
    },
  });

  if (!contactsRes.ok) {
    const err = await contactsRes.text();
    throw new Error(`Failed to fetch contacts: ${err}`);
  }

  const contacts = await contactsRes.json();

  if (contacts.contacts && Array.isArray(contacts.contacts)) {
    for (const c of contacts.contacts) {
      const first = c.firstName ?? null;
      const last = c.lastName ?? null;
      const email = c.email ?? null;
      const phone = c.phone ?? null;
      const { data: existingLead } = await supabase.from("lead").select("id").eq("email", email).eq("clinic_id", clinic_id).single();
      if (!existingLead) {
        await supabase.from("lead").insert({
          clinic_id,
          source_id: SOURCE_ID,
          first_name: first,
          last_name: last,
          email,
          phone,
          form_data: c,
        });
      }
    }
  }
}

serve(async req => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    // 1. Start Auth
    if (pathname.endsWith("/auth/start") && req.method === "GET") {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return new Response("Missing clinic_id", { status: 400 });

      const authUrl = `${GHL_AUTH_URL}?response_type=code&redirect_uri=${encodeURIComponent(
        REDIRECT_URI,
      )}&client_id=${CLIENT_ID}&scope=forms.write+forms.readonly+users.readonly+locations.readonly+contacts.readonly&state=${clinic_id}`;

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Handle Callback
    if (pathname.endsWith("/auth/callback") && req.method === "GET") {
      const code = url.searchParams.get("code");
      const clinic_id = url.searchParams.get("state");
      if (!code || !clinic_id) return new Response("Missing code or clinic_id", { status: 400 });

      const tokenRes = await fetch(GHL_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return new Response(`Token exchange failed: ${err}`, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      console.log("test", tokenData);
      await saveTokens(clinic_id, tokenData);

      // Immediately import leads once connected
      await importLeads(clinic_id);

      const redirectUrl = new URL(`${APP_URL}/onboarding`);
      redirectUrl.searchParams.set("go_high_level_status", "success");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl.toString(),
        },
      });
    }

    // 3. Manual Sync (can be called later)
    if (pathname === "/sync-leads" && req.method === "GET") {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return new Response("Missing clinic_id", { status: 400 });

      await importLeads(clinic_id);
      return new Response("Leads synced successfully", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
