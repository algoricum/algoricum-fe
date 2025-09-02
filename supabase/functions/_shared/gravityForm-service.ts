import { encode as base64encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";

// Keyword map for custom labels
const FIELD_KEYWORDS: Record<string, string[]> = {
  first_name: ["first name", "firstname", "given name", "first"],
  last_name: ["last name", "lastname", "surname", "last"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "mobile", "cell", "telephone"],
};

function matchLabel(label: string, keywords: string[]) {
  const l = label.toLowerCase();
  return keywords.some((k) => l.includes(k));
}

// Generate OAuth 1.0 HMAC-SHA1 signature
export async function getOAuthParams(
  method: string,
  endpoint: string,
  consumerKey: string,
  consumerSecret: string
) {
  const oauth_consumer_key = consumerKey;
  const oauth_nonce = crypto.randomUUID().replace(/-/g, "");
  const oauth_signature_method = "HMAC-SHA1";
  const oauth_timestamp = Math.floor(Date.now() / 1000).toString();
  const oauth_version = "1.0";

  const params = {
    oauth_consumer_key,
    oauth_nonce,
    oauth_signature_method,
    oauth_timestamp,
    oauth_version,
  };

  // Build base string
  const paramString = new URLSearchParams(
    Object.entries(params).sort((a, b) => a[0].localeCompare(b[0]))
  ).toString();

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(endpoint),
    encodeURIComponent(paramString),
  ].join("&");

  // Signing key
  const signingKey = `${consumerSecret}&`;

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(baseString)
  );
  const oauth_signature = base64encode(signatureBytes);

  return { ...params, oauth_signature };
}

export async function fetchFormStructure(
  baseURL: string,
  formId: string,
  consumerKey: string,
  consumerSecret: string
) {
  const endpoint = `${baseURL}/wp-json/gf/v2/forms/${formId}`;
  const oauthParams = await getOAuthParams("GET", endpoint, consumerKey, consumerSecret);
  const url = `${endpoint}?${new URLSearchParams(oauthParams).toString()}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchFormEntries(
  baseURL: string,
  formId: string,
  consumerKey: string,
  consumerSecret: string
) {
  const endpoint = `${baseURL}/wp-json/gf/v2/forms/${formId}/entries`;
  const oauthParams = await getOAuthParams("GET", endpoint, consumerKey, consumerSecret);
  const url = `${endpoint}?${new URLSearchParams(oauthParams).toString()}`;
  const res = await fetch(url);
  return res.json();
}

export function mapFields(structure: any) {
  const fieldMap: Record<string, string | null> = {
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
  };

  if (structure.fields && Array.isArray(structure.fields)) {
    for (const field of structure.fields) {
      const label = (field.label || "").toLowerCase();
      if (field.type === "name" && field.inputs) {
        for (const input of field.inputs) {
          if (matchLabel(input.label || "", FIELD_KEYWORDS.first_name))
            fieldMap.first_name = input.id;
          if (matchLabel(input.label || "", FIELD_KEYWORDS.last_name))
            fieldMap.last_name = input.id;
        }
      } else if (field.type === "email") {
        fieldMap.email = String(field.id);
      } else if (field.type === "phone") {
        fieldMap.phone = String(field.id);
      } else if (field.type === "text") {
        if (matchLabel(label, FIELD_KEYWORDS.first_name))
          fieldMap.first_name = String(field.id);
        if (matchLabel(label, FIELD_KEYWORDS.last_name))
          fieldMap.last_name = String(field.id);
        if (matchLabel(label, FIELD_KEYWORDS.email))
          fieldMap.email = String(field.id);
        if (matchLabel(label, FIELD_KEYWORDS.phone))
          fieldMap.phone = String(field.id);
      }
    }
  }
  return fieldMap;
}

export function normalizeEntries(entriesJson: any, fieldMap: Record<string, string | null>) {
  return (entriesJson.entries || []).map((entry: any) => ({
    first_name: fieldMap.first_name ? entry[fieldMap.first_name] || null : null,
    last_name: fieldMap.last_name ? entry[fieldMap.last_name] || null : null,
    email: fieldMap.email ? entry[fieldMap.email] || null : null,
    phone: fieldMap.phone ? entry[fieldMap.phone] || null : null,
  }));
}
