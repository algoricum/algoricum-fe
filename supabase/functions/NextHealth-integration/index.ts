// supabase/functions/sync-nexhealth/index.ts
import { serve } from "https://deno.land/std@0.179.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { authenticate, fetchInstitution, fetchPatients, upsertIntegrationConnection } from "../_shared/nextHealth-service.ts";
import { chunkArray, enqueueLead } from "../_shared/Lead-enqueue.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
serve(async req => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { clinic_id, api_key } = await req.json();
    if (!clinic_id || !api_key) {
      return new Response(JSON.stringify({ error: "Missing clinic_id or api_key" }), {
        status: 400,
        headers: { ...corsHeaders() },
      });
    }

    const token = await authenticate(api_key);
    const { subdomain, location_id } = await fetchInstitution(token);

    const { data: integration } = await supabase.from("integrations").select("id").eq("name", "NextHealth").single();
    const { data: integration_connection } = await supabase
      .from("integration_connections")
      .select("updated_at")
      .eq("integration_id", integration.id)
      .eq("clinic_id", clinic_id)
      .single();
    await upsertIntegrationConnection(clinic_id, token, subdomain, location_id, api_key);

    const patients = await fetchPatients(token, subdomain, location_id);
    const newPatients = patients.filter((p: any) => {
      const updatedAt = integration_connection.updated_at ? new Date(integration_connection.updated_at) : null;

      if (updatedAt) {
        return new Date(p.created_at) > updatedAt;
      } else {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 24);
        return new Date(p.created_at) >= cutoff;
      }
    });
    console.log(`Fetched ${newPatients} patients`);
    // const inserted = await insertPatientsAsLeads(clinic_id, patients);
    const chunks = chunkArray(newPatients, 10);
    for (const chunk of chunks) {
      enqueueLead(chunk, clinic_id);
    }

    return new Response(JSON.stringify({ success: true, leads_created: patients }), {
      status: 200,
      headers: { ...corsHeaders() },
    });
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders() },
    });
  }
});
