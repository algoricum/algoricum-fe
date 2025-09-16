// supabase/functions/fetch-gravity-forms/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { fetchFormEntries, fetchFormStructure, mapFields, normalizeEntries } from "../_shared/gravityForm-service.ts";
import { supabase } from "../_shared/supabaseClient.ts";

serve(async req => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { clinic_id, form_ids, consumerKey, consmerSecret, baseURL } = await req.json();
    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "Missing clinic_id" }), { status: 400, headers: { ...corsHeaders() } });
    }
    if (!consumerKey || !consmerSecret || !baseURL) {
      console.log("Missing consumerKey, consumerSecret or baseURL");
      return new Response(
        JSON.stringify({ error: "Missing consumerKey, consumerSecret or baseURL" }),
        { status: 400, headers: { ...corsHeaders() } }
      );
    }
    if (!form_ids || !Array.isArray(form_ids)) {
      return new Response(
        JSON.stringify({ error: "form_ids array required" }),
        { status: 400, headers: { ...corsHeaders() } }
      );
    }
    console.log(clinic_id,consmerSecret,consumerKey,baseURL,form_ids)
const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("name", "Gravity Form")
    .single();

    if (!integration) throw new Error("Integration not configured");

  await supabase.from("integration_connections").upsert({
    clinic_id,
    integration_id: integration.id,
    auth_data: { form_ids, consumerKey,consmerSecret, baseURL },
    status: "active",
  }, { onConflict: ["clinic_id", "integration_id"] });

    const results: any[] = [];
    const allRows: any[] = [];

    for (const formId of form_ids) {
      const structure = await fetchFormStructure(baseURL, formId, consumerKey, consmerSecret);
      const fieldMap = mapFields(structure);

      const entriesJson = await fetchFormEntries(baseURL, formId, consumerKey, consmerSecret);
      const normalizedEntries = normalizeEntries(entriesJson, fieldMap);

      results.push({
        form_id: structure.id,
        form_title: structure.title,
        entries: normalizedEntries,
      });
      const { data: source } = await supabase
      .from("lead_source")
      .select("id")
      .eq("name", "Others")
      .single();
       const rows = normalizedEntries.map((p: any) => ({
        clinic_id,
        source_id: source.id, // fixed UUID for Gravity
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        form_data: p, // raw entry stored as JSON
      }));

      allRows.push(...rows);
    }
    if (allRows.length > 0) {
      const { error } = await supabase.from("lead").upsert(allRows, { onConflict: ["clinic_id", "email"] });
      if (error) throw new Error(`Insert failed: ${error.message}`);
    }
    return new Response(JSON.stringify(results), { headers: { ...corsHeaders() } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders() },
    });
  }
});
