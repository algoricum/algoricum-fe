// supabase/functions/sync-nexhealth/index.ts
import { serve } from "https://deno.land/std@0.179.0/http/server.ts";
import {  corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  authenticate,
  fetchInstitution,
  upsertIntegrationConnection,
  fetchPatients,
  insertPatientsAsLeads,
} from "../_shared/nextHealth-service.ts";

serve(async (req) => {
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

    await upsertIntegrationConnection(clinic_id, token, subdomain, location_id, api_key);

    const patients = await fetchPatients(token, subdomain, location_id);
    const inserted = await insertPatientsAsLeads(clinic_id, patients);

    return new Response(JSON.stringify({ success: true, leads_created: inserted }), {
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