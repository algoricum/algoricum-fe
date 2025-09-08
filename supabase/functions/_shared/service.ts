import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function authenticate(api_key: string): Promise<string> {
  const res = await fetch("https://nexhealth.info/authenticates", {
    method: "POST",
    headers: {
      "Accept": "application/vnd.Nexhealth+json;version=2",
      "Authorization": api_key,
    },
  });

  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const { data: { token } } = await res.json();
  return token;
}

export async function fetchInstitution(token: string) {
  const res = await fetch("https://nexhealth.info/institutions", {
    headers: {
      "Accept": "application/vnd.Nexhealth+json;version=2",
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Institutions fetch failed: ${await res.text()}`);

  const json = await res.json();
  const inst = json.data[0];
  if (!inst?.subdomain || !inst.locations?.[0]?.id) {
    throw new Error("No institution or location found");
  }
  return { subdomain: inst.subdomain, location_id: inst.locations[0].id };
}

export async function upsertIntegrationConnection(
  clinic_id: string,
  token: string,
  subdomain: string,
  location_id: string,
  api_key: string
) {
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("name", "NextHealth")
    .single();

  if (!integration) throw new Error("Integration not configured");

  await supabase.from("integration_connections").upsert({
    clinic_id,
    integration_id: integration.id,
    auth_data: { token, subdomain, location_id, api_key },
    status: "active",
  }, { onConflict: ["clinic_id", "integration_id"] });
}

export async function fetchPatients(token: string, subdomain: string, location_id: string) {
  let endCursor: string | undefined = undefined;
  const allPatients: any[] = [];

  do {
    const url = new URL("https://nexhealth.info/patients");
    url.searchParams.set("subdomain", subdomain);
    url.searchParams.set("location_id", String(location_id));
    url.searchParams.set("per_page", "100");
    if (endCursor) url.searchParams.set("end_cursor", endCursor);

    const res = await fetch(url.toString(), {
      headers: {
        "Nex-Api-Version": "v20240412",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Patients fetch failed: ${await res.text()}`);
    const json = await res.json();

    allPatients.push(...json.data);
    endCursor = json.page_info.has_next_page ? json.page_info.end_cursor : undefined;
  } while (endCursor);

  return allPatients;
}

export async function insertPatientsAsLeads(clinic_id: string, patients: any[]) {
  const { data: source } = await supabase
      .from("lead_source")
      .select("id")
      .eq("name", "Others")
      .single();
  const rows = patients.map((p) => ({
    clinic_id,
    source_id: source.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.bio?.phone_number || null,
    form_data: p,
  }));

  const { error } = await supabase.from("lead").insert(rows);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  return rows.length;
}
