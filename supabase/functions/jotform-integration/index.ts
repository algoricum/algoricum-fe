// supabase/functions/jotform-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { extractLeadInfo, insertLead, jotformFetch, saveFormsHandler, testWebhookHandler } from "../_shared/jotform-service.ts";
import { supabase } from "../_shared/supabaseClient.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const JOTFORM_WEBHOOK_BASE_URL = `${supabaseUrl}/functions/v1/jotform-integration`;

serve(async req => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    const optionsResponse = handleOptions(req);
    if (optionsResponse) return optionsResponse;

    // Health check
    if (req.method === "GET" && !path.includes("/webhook")) {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Webhook handler
    if (req.method === "POST" && path.includes("/webhook")) {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return new Response(JSON.stringify({ error: "Missing clinic_id" }), { status: 400 });

      try {
        const formData = await req.formData();
        const rawRequest = formData.get("rawRequest");
        const formID = formData.get("formID");
        const submissionID = formData.get("submissionID");

        if (!rawRequest) return new Response(JSON.stringify({ error: "Missing rawRequest" }), { status: 400 });

        const parsedRequest = JSON.parse(rawRequest.toString());
        const leadInfo = extractLeadInfo(parsedRequest);

        const leadData = {
          first_name: leadInfo.firstName || null,
          last_name: leadInfo.lastName || null,
          email: leadInfo.email || null,
          phone: leadInfo.phone || null,
          form_data: { ...parsedRequest, jotform_submission_id: submissionID, jotform_form_id: formID },
          clinic_id,
          source_id: "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c",
          created_at: new Date().toISOString(),
        };

        const { success, error } = await insertLead(leadData);
        if (!success) return new Response(JSON.stringify({ error: "Failed to insert lead", details: error.message }), { status: 500 });

        return new Response(JSON.stringify({ status: "ok", submission_id: submissionID, form_id: formID }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to parse webhook data", details: e.message }), { status: 400 });
      }
    }

    // API actions
    if (req.method === "POST") {
      let body: any = {};
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) body = await req.json();
      else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        for (const [k, v] of formData.entries()) body[k] = v;
      } else {
        const text = await req.text();
        if (text.trim()) body = JSON.parse(text);
      }

      const { action, clinic_id, forms: selectedForms, form_id } = body;
      if (!clinic_id) return new Response(JSON.stringify({ error: "Missing clinic_id" }), { status: 400 });

      const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Jotform").single();
      const { data: integrationData } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("integration_id", integration.id)
        .single();

      const authData = integrationData.auth_data as any;
      const accessToken = authData?.access_token;
      const storedForms = authData.forms || [];

      if (action === "get_forms") {
        const result = await jotformFetch("/user/forms", accessToken);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...corsHeaders() } });
      }

      if (action === "save_forms") {
        if (!Array.isArray(selectedForms)) return new Response(JSON.stringify({ error: "Forms must be an array" }), { status: 400 });
        try {
          const newStoredForms = await saveFormsHandler(
            selectedForms,
            storedForms,
            clinic_id,
            accessToken,
            authData,
            integration.id,
            JOTFORM_WEBHOOK_BASE_URL,
          );
          return new Response(JSON.stringify({ status: "saved", forms: newStoredForms }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }

      if (action === "test_webhook") {
        if (!form_id) return new Response(JSON.stringify({ error: "Missing form_id" }), { status: 400 });
        try {
          const result = await testWebhookHandler(form_id, clinic_id, accessToken, JOTFORM_WEBHOOK_BASE_URL);
          return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500 });
  }
});
