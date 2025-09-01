import { supabase } from "../_shared/supabaseClient.ts";

const CLIENT_ID = Deno.env.get("GHL_Client_ID") || "";
const CLIENT_SECRET = Deno.env.get("GHL_Client_Secret") || "";

const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const GHL_CONTACTS_URL = "https://services.leadconnectorhq.com/contacts/";

const { data: integration } = await supabase.from("integrations").select("id").eq("name", "GoHighLevel").single();
const INTEGRATION_ID = integration?.id;
const SOURCE_ID = "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c";

export async function saveTokens(clinic_id: string, tokenData: any) {
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

export async function refreshTokens(clinic_id: string) {
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

export async function importLeads(clinic_id: string) {
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
