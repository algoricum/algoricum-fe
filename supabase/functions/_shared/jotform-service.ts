// supabase/functions/_shared/jotform-service.ts
import { supabase } from "./supabaseClient.ts";

export function extractLeadInfo(data: any) {
  const result: { email?: string; firstName?: string; lastName?: string; phone?: string } = {};

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

      if (key === "answer") {
        if (typeof value === "string") {
          if (!result.email && patterns.email.test(JSON.stringify(obj))) result.email = value;
          if (!result.phone && patterns.phone.test(JSON.stringify(obj))) result.phone = value;
        }
        if (typeof value === "object") {
          if (value.first && !result.firstName) result.firstName = value.first;
          if (value.last && !result.lastName) result.lastName = value.last;
          if (value.full && !result.phone) result.phone = value.full;
        }
      }

      if (!result.email && patterns.email.test(lowerKey) && typeof value === "string") {
        result.email = value;
      }
      if (!result.firstName && patterns.firstName.test(lowerKey) && typeof value === "string") {
        result.firstName = value;
      }
      if (!result.lastName && patterns.lastName.test(lowerKey) && typeof value === "string") {
        result.lastName = value;
      }
      if (!result.phone && patterns.phone.test(lowerKey)) {
        if (typeof value === "string") result.phone = value;
        if (typeof value === "object" && value.full) result.phone = value.full;
      }

      if (typeof value === "object") search(value);
    }
  }

  search(data);
  return result;
}

export const jotformFetch = async (endpoint: string, accessToken: string, method = "GET", body?: any) => {
  const url = `https://api.jotform.com${endpoint}${endpoint.includes("?") ? "&" : "?"}apiKey=${accessToken}`;

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body && method !== "GET") options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Jotform API error: ${res.status} ${res.statusText}`);

  return res.json();
};

export async function insertLead(leadData: any) {
  const { error } = await supabase.from("lead").insert(leadData);
  if (error) {
    console.error("Error inserting lead:", error);
    return { success: false, error };
  }
  return { success: true };
}

export async function processSubmissions(submissions: any[], clinic_id: string) {
  for (const sub of submissions) {
    const answers = sub.answers || {};
    const leadInfo = extractLeadInfo(answers);

    const leadData = {
      first_name: leadInfo.firstName || null,
      last_name: leadInfo.lastName || null,
      email: leadInfo.email || null,
      phone: leadInfo.phone || null,
      form_data: answers,
      clinic_id,
      source_id: "bf1bb50b-d6dd-4c11-ba96-2f7aac74895c",
      created_at: new Date().toISOString(),
    };

    const { success } = await insertLead(leadData);
    if (!success) console.error("Failed to insert lead for submission:", sub.id);
  }
}

export async function saveFormsHandler(
  selectedForms: string[],
  storedForms: any[],
  clinic_id: string,
  accessToken: string,
  authData: any,
  integration_id: string,
  JOTFORM_WEBHOOK_BASE_URL: string,
) {
  const formsToAdd = selectedForms.filter(f => !storedForms.some((s: any) => s.form_id === f));
  const formsToRemove = storedForms.filter((s: any) => !selectedForms.includes(s.form_id));

  // Remove deselected form webhooks
  for (const form of formsToRemove) {
    if (form.webhook_url) {
      try {
        await jotformFetch(`/form/${form.form_id}/webhooks/${encodeURIComponent(form.webhook_url)}`, accessToken, "DELETE");
      } catch (err) {
        console.error(`Failed to remove webhook for form ${form.form_id}:`, err);
      }
    }
  }

  const newStoredForms = [...storedForms.filter((s: any) => selectedForms.includes(s.form_id))];

  for (const formId of formsToAdd) {
    try {
      // Fetch existing submissions
      const submissionsData = await jotformFetch(`/form/${formId}/submissions`, accessToken);
      if (submissionsData.content && Array.isArray(submissionsData.content)) {
        await processSubmissions(submissionsData.content, clinic_id);
      }

      // Create webhook
      const webhookUrl = `${JOTFORM_WEBHOOK_BASE_URL}/webhook?clinic_id=${clinic_id}`;
      const webhookResponse = await fetch(`https://api.jotform.com/form/${formId}/webhooks?apiKey=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ webhookURL: webhookUrl }).toString(),
      });

      if (!webhookResponse.ok) {
        console.error(`HTTP error creating webhook: ${webhookResponse.status}`);
        continue;
      }

      const webhookData = await webhookResponse.json();
      if (webhookData.responseCode === 200) {
        newStoredForms.push({ form_id: formId, webhook_url: webhookUrl });
      }
    } catch (err) {
      console.error(`Error processing form ${formId}:`, err);
    }
  }

  // Update integration data
  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({ auth_data: { ...authData, forms: newStoredForms } })
    .eq("clinic_id", clinic_id)
    .eq("integration_id", integration_id);

  if (updateError) throw new Error("Failed to update integration data");

  return newStoredForms;
}

export async function testWebhookHandler(form_id: string, clinic_id: string, accessToken: string, JOTFORM_WEBHOOK_BASE_URL: string) {
  const webhookUrl = `${JOTFORM_WEBHOOK_BASE_URL}/webhook?clinic_id=${clinic_id}`;
  const response = await fetch(`https://api.jotform.com/form/${form_id}/webhooks?apiKey=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ webhookURL: webhookUrl }).toString(),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid JSON response from Jotform: ${responseText}`);
  }

  return { status: response.status, jotform_response: responseData, webhook_url: webhookUrl };
}
