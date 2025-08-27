// supabase/functions/sync-nexhealth/index.ts
import { serve } from "https://deno.land/std@0.179.0/http/server.ts";
<<<<<<< Updated upstream
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
=======
import {  corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  authenticate,
  fetchInstitution,
  upsertIntegrationConnection,
  fetchPatients,
  insertPatientsAsLeads,
} from "../_shared/nextHealth-service.ts";

>>>>>>> Stashed changes
serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { clinic_id, api_key } = await req.json();
    if (!clinic_id || !api_key) {
      return new Response(JSON.stringify({ error: "Missing clinic_id or api_key" }), { status: 400 });
    }

    // Authenticate with NexHealth
    const authRes = await fetch("https://nexhealth.info/authenticates", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.Nexhealth+json;version=2",
        "Authorization": api_key,
      },
    });
    if (!authRes.ok) {
      const text = await authRes.text();
      return new Response(JSON.stringify({ error: "Auth failed", details: text }), { status: 502,headers:{...corsHeaders} });
    }
    const { data: { token } } = await authRes.json();

    // Fetch institutions
    const instRes = await fetch("https://nexhealth.info/institutions", {
      headers: {
        "Accept": "application/vnd.Nexhealth+json;version=2",
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!instRes.ok) {
      const text = await instRes.text();
      return new Response(JSON.stringify({ error: "Institutions fetch failed", details: text }), { status: 502 });
    }
    const instJson = await instRes.json();
    const institution = instJson.data[0];
    if (!institution?.subdomain || !institution.locations?.[0]?.id) {
      return new Response(JSON.stringify({ error: "No institution found" }), { status: 404,headers:{...corsHeaders} });
    }
    const subdomain = institution.subdomain;
    const location_id = institution.locations[0].id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ensure Typeform integration exists
    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("name", "NextHealth")
      .single();

    if (!integration) {
      return new Response("Integration not configured", { status: 500 });
    }
    // Insert integration connection record
    await supabase.from("integration_connections").upsert({
      clinic_id,
      integration_id: integration.id,
      auth_data: { token, subdomain, location_id ,api_key},
      status: "active",
    }, { onConflict: ["clinic_id", "integration_id"] });

    // Function to recursively fetch & insert patients with pagination
    let endCursor: string | undefined = undefined;
    let totalLeads = 0;

    do {
      const url = new URL("https://nexhealth.info/patients");
      url.searchParams.set("subdomain", subdomain);
      url.searchParams.set("location_id", String(location_id));
      url.searchParams.set("per_page", "100");
      if (endCursor) url.searchParams.set("end_cursor", endCursor);

      const patRes = await fetch(url.toString(), {
        headers: {
          "Nex-Api-Version": "v20240412",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!patRes.ok) {
        const text = await patRes.text();
        return new Response(JSON.stringify({ error: "Patients fetch failed", details: text }), { status: 502,headers:{...corsHeaders} });
      }
      const patJson = await patRes.json();
      const patients: any[] = patJson.data; // array of patient objects

      for (const p of patients) {
        await supabase.from("lead").insert({
          clinic_id,
          source_id: "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c",
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.bio?.phone_number || null,
          form_data: p,
        });
        totalLeads++;
      }

      const pageInfo = patJson.page_info;
      endCursor = pageInfo.has_next_page ? pageInfo.end_cursor : undefined;
    } while (endCursor);

    return new Response(JSON.stringify({ success: true, leads_created: totalLeads }), { status: 200 ,headers:{...corsHeaders}});

  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500,headers:{...corsHeaders} });
  }
});
