// supabase/functions/jotform-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
const JOTFORM_WEBHOOK_BASE_URL = `${supabaseUrl}/functions/v1/jotform-integration`;

serve(async req => {
  function extractLeadInfo(data: any) {
    const result: { email?: string; firstName?: string; lastName?: string; phone?: string } = {};

    // Flexible patterns for detection
    const patterns = {
      email: /(e[-_ ]?mail|mail)/i,
      firstName: /(first[-_ ]?name|fname|given)/i,
      lastName: /(last[-_ ]?name|lname|surname|family)/i,
      phone: /(phone|mobile|cell|contact[-_ ]?number|tel)/i,
    };

    function search(obj: any) {
      if (!obj || typeof obj !== "object") return;

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Special Jotform case: "answer" field
        if (key === "answer") {
          if (typeof value === "string") {
            // Direct string answers (like email)
            if (!result.email && patterns.email.test(JSON.stringify(obj))) result.email = value;
            if (!result.phone && patterns.phone.test(JSON.stringify(obj))) result.phone = value;
          }
          if (typeof value === "object") {
            // Nested answer object (like first/last, phone.full)
            if (value.first && !result.firstName) result.firstName = value.first;
            if (value.last && !result.lastName) result.lastName = value.last;
            if (value.full && !result.phone) result.phone = value.full;
          }
        }

        // General email
        if (!result.email && patterns.email.test(lowerKey) && typeof value === "string") {
          result.email = value;
        }

        // General first name
        if (!result.firstName && patterns.firstName.test(lowerKey) && typeof value === "string") {
          result.firstName = value;
        }

        // General last name
        if (!result.lastName && patterns.lastName.test(lowerKey) && typeof value === "string") {
          result.lastName = value;
        }

        // General phone
        if (!result.phone && patterns.phone.test(lowerKey)) {
          if (typeof value === "string") result.phone = value;
          if (typeof value === "object" && value.full) result.phone = value.full;
        }

        // Recurse deeper
        if (typeof value === "object") {
          search(value);
        }
      }
    }

    search(data);
    return result;
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS Preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Health check and debug endpoint
    if (req.method === "GET" && !path.includes("/webhook")) {
      const debugInfo = {
        status: "ok",
        timestamp: new Date().toISOString(),
        method: req.method,
        path: path,
        headers: Object.fromEntries(req.headers.entries()),
        url: url.toString(),
      };

      return new Response(JSON.stringify(debugInfo, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle webhook POST requests
    if (req.method === "POST" && path.includes("/webhook")) {
      const clinic_id = url.searchParams.get("clinic_id");

      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "Missing clinic_id in webhook URL" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        // Jotform sends data as form-encoded
        const formData = await req.formData();

        // Extract the rawRequest which contains the actual form submission JSON
        const rawRequest = formData.get("rawRequest");
        const formID = formData.get("formID");
        const submissionID = formData.get("submissionID");

        console.log("Webhook received for form:", formID);
        console.log("Submission ID:", submissionID);

        if (!rawRequest) {
          console.error("No rawRequest found in webhook data");
          return new Response(JSON.stringify({ error: "Missing rawRequest in webhook" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Parse the JSON from rawRequest
        const parsedRequest = JSON.parse(rawRequest.toString());
        console.log("Parsed rawRequest:", JSON.stringify(parsedRequest, null, 2));

        // Extract form field data - Jotform uses q1_, q2_, etc. as field IDs
        const answers = {};

        // Map Jotform fields to our expected format
        for (const [key, value] of Object.entries(parsedRequest)) {
          if (key.startsWith("q") && key.includes("_")) {
            // Extract question number (e.g., q3 from q3_fullName)
            const qNum = key.match(/^q(\d+)/)?.[1];
            if (qNum) {
              answers[qNum] = { answer: value };
            }
          }
        }
        const leadData1 = extractLeadInfo(parsedRequest);
        // Handle specific Jotform field types based on your form structure
        const leadData = {
          // q3_fullName is typically the name field
          first_name: leadData1.firstName || null,
          last_name: leadData1.lastName || null,
          // q5_emailAddress is typically the email field
          email: leadData1.email || null,
          // q4_contactNumber is typically the phone field
          phone: leadData1.phone || null,
          form_data: {
            ...parsedRequest,
            jotform_submission_id: submissionID,
            jotform_form_id: formID,
            mapped_answers: answers,
          },
          clinic_id,
          source_id: "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c",
          created_at: new Date().toISOString(),
        };

        console.log("Lead data to insert:", JSON.stringify(leadData, null, 2));

        // Insert lead into database
        const { error: insertError } = await supabase.from("lead").insert(leadData);

        if (insertError) {
          console.error("Error inserting lead:", insertError);
          return new Response(
            JSON.stringify({
              error: "Failed to insert lead",
              details: insertError.message,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        console.log("Successfully inserted lead for submission:", submissionID);

        return new Response(
          JSON.stringify({
            status: "ok",
            submission_id: submissionID,
            form_id: formID,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } catch (parseError) {
        console.error("Error parsing webhook data:", parseError);
        return new Response(
          JSON.stringify({
            error: "Failed to parse webhook data",
            details: parseError.message,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Handle API actions (get_forms, save_forms)
    if (req.method === "POST") {
      let body;
      const contentType = req.headers.get("content-type") || "";

      try {
        if (contentType.includes("application/json")) {
          body = await req.json();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const formData = await req.formData();
          body = {};
          for (const [key, value] of formData.entries()) {
            body[key] = value;
          }
        } else {
          // Try to parse as JSON by default
          const text = await req.text();
          if (text.trim()) {
            body = JSON.parse(text);
          } else {
            body = {};
          }
        }
      } catch (parseError) {
        console.error("Error parsing request body:", parseError);
        return new Response(
          JSON.stringify({
            error: "Invalid request body format",
            details: parseError.message,
            content_type: contentType,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const { action, clinic_id, forms: selectedForms } = body;

      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get Jotform integration ID
      const { data: integration, error: integrationIdError } = await supabase
        .from("integrations")
        .select("id")
        .eq("name", "Jotform")
        .single();

      if (integrationIdError || !integration) {
        return new Response(JSON.stringify({ error: "Jotform integration not found in system" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fetch Jotform integration for this clinic
      const { data: integrationData, error: integrationError } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("integration_id", integration.id)
        .single();

      if (integrationError || !integrationData) {
        return new Response(JSON.stringify({ error: "Jotform integration not found for clinic" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authData = integrationData.auth_data as any;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Missing Jotform access token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const storedForms = authData.forms || [];

      // Helper to call Jotform API
      const jotformFetch = async (endpoint: string, method = "GET", body?: any) => {
        const url = `https://api.jotform.com${endpoint}${endpoint.includes("?") ? "&" : "?"}apiKey=${accessToken}`;

        const options: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
        };

        if (body && method !== "GET") {
          options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);

        if (!res.ok) {
          throw new Error(`Jotform API error: ${res.status} ${res.statusText}`);
        }

        return res.json();
      };

      // Test webhook creation action
      if (action === "test_webhook") {
        const { form_id } = body;
        if (!form_id) {
          return new Response(JSON.stringify({ error: "Missing form_id for webhook test" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const webhookUrl = `${JOTFORM_WEBHOOK_BASE_URL}/webhook?clinic_id=${clinic_id}`;
          console.log(`Testing webhook creation for form ${form_id} with URL: ${webhookUrl}`);

          const response = await fetch(`https://api.jotform.com/form/${form_id}/webhooks?apiKey=${accessToken}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ webhookURL: webhookUrl }).toString(),
          });

          const responseText = await response.text();
          console.log("Raw webhook response:", responseText);

          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            console.error("Failed to parse webhook response:", parseError);
            return new Response(
              JSON.stringify({
                error: "Invalid JSON response from Jotform",
                raw_response: responseText,
                status: response.status,
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          return new Response(
            JSON.stringify({
              status: response.status,
              jotform_response: responseData,
              webhook_url: webhookUrl,
            }),
            {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            },
          );
        } catch (error) {
          console.error("Webhook test error:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (action === "get_forms") {
        try {
          const result = await jotformFetch("/user/forms");
          return new Response(JSON.stringify(result), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        } catch (error) {
          console.error("Error fetching forms:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch forms from Jotform" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (action === "save_forms") {
        if (!Array.isArray(selectedForms)) {
          return new Response(JSON.stringify({ error: "Forms must be an array" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const formsToAdd = selectedForms.filter(f => !storedForms.some((s: any) => s.form_id === f));
          const formsToRemove = storedForms.filter((s: any) => !selectedForms.includes(s.form_id));

          // Remove deselected form webhooks
          for (const form of formsToRemove) {
            if (form.webhook_url) {
              try {
                await jotformFetch(`/form/${form.form_id}/webhooks/${encodeURIComponent(form.webhook_url)}`, "DELETE");
              } catch (error) {
                console.error(`Failed to remove webhook for form ${form.form_id}:`, error);
                // Continue with other forms even if one fails
              }
            }
          }

          // Add new forms: fetch submissions, insert into leads, create webhook
          const newStoredForms = [...storedForms.filter((s: any) => selectedForms.includes(s.form_id))];

          for (const formId of formsToAdd) {
            try {
              // Fetch existing submissions
              const submissionsData = await jotformFetch(`/form/${formId}/submissions`);
              console.log(`Fetched submissions for form ${formId}:`, JSON.stringify(submissionsData, null, 2));
              if (submissionsData.content && Array.isArray(submissionsData.content)) {
                for (const sub of submissionsData.content) {
                  const answers = sub.answers || {};
                  console.error(`Processing submission for form ${formId}:`, answers);
                  const leaddata1 = extractLeadInfo(answers);
                  const leadData = {
                    first_name: leaddata1.firstName || null,
                    last_name: leaddata1.lastName || null,
                    email: leaddata1.email || null,
                    phone: leaddata1.phone || null,
                    form_data: answers,
                    clinic_id,
                    source_id: "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c",
                    created_at: new Date().toISOString(),
                  };

                  // Insert lead (ignore duplicates)
                  const { error: leadError } = await supabase.from("lead").insert(leadData);
                  if (leadError) {
                    console.error(`Error inserting lead for form ${formId}:`, leadError);
                  }
                }
              }

              // Create webhook using form-encoded data
              const webhookUrl = `${JOTFORM_WEBHOOK_BASE_URL}/webhook?clinic_id=${clinic_id}`;

              console.log(`Creating webhook for form ${formId} with URL: ${webhookUrl}`);

              const webhookResponse = await fetch(`https://api.jotform.com/form/${formId}/webhooks?apiKey=${accessToken}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ webhookURL: webhookUrl }).toString(),
              });

              console.log(`Webhook response status: ${webhookResponse.status}`);

              if (!webhookResponse.ok) {
                console.error(`HTTP error creating webhook: ${webhookResponse.status} ${webhookResponse.statusText}`);
                const errorText = await webhookResponse.text();
                console.error("Error response:", errorText);
                continue;
              }

              const webhookData = await webhookResponse.json();
              console.log("Webhook creation response:", JSON.stringify(webhookData, null, 2));

              if (webhookData.responseCode === 200) {
                // Jotform returns the webhook URL in the response
                const createdWebhookUrl = webhookUrl; // Use our URL since that's what we sent
                newStoredForms.push({
                  form_id: formId,
                  webhook_url: createdWebhookUrl,
                });
                console.log(`Successfully created webhook for form ${formId}`);
              } else {
                console.error("Failed to create Jotform webhook:", webhookData);
                console.error(`Error message: ${webhookData.message || "Unknown error"}`);
                // Continue with next form
              }
            } catch (error) {
              console.error(`Error processing form ${formId}:`, error);
              // Continue with next form
            }
          }

          // Update integration_connections auth_data
          const { error: updateError } = await supabase
            .from("integration_connections")
            .update({
              auth_data: {
                ...authData,
                forms: newStoredForms,
              },
            })
            .eq("clinic_id", clinic_id)
            .eq("integration_id", integration.id);

          if (updateError) {
            console.error("Error updating integration data:", updateError);
            return new Response(JSON.stringify({ error: "Failed to update integration data" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(
            JSON.stringify({
              status: "saved",
              forms: newStoredForms,
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } catch (error) {
          console.error("Error in save_forms:", error);
          return new Response(JSON.stringify({ error: "Failed to save forms configuration" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
