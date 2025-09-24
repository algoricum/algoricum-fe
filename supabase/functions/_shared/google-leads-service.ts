import { supabase } from "./supabaseClient.ts";

const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";

/**
 * Step 0 - Start OAuth Flow
 */
export async function startAuth(clinic_id: string, redirectTo: string) {
  if (!clinic_id) throw new Error("Missing clinic_id");
  const state = encodeURIComponent(`${clinic_id}|${redirectTo}`);
  const scopes = ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/userinfo.email"].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: new URL(redirectTo).origin + "/redirect-lead",
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    state: state,
    prompt: "consent",
  }).toString()}`;

  return { auth_url: authUrl };
}

/**
 * Step 1 - Handle OAuth Callback
 */
export async function handleOAuthCallback(code: string, clinic_id: string, redirectTo: any) {
  if (!code || !clinic_id) throw new Error("Missing code or clinic_id");

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: new URL(redirectTo).origin + "/redirect-lead",
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(tokens.error_description);
  const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase.from("google_lead_form_connections").upsert(
    {
      clinic_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiryDate,
    },
    { onConflict: ["clinic_id"] },
  );

  if (error) throw new Error(error.message);
  return redirectTo;
}

/**
 * Step 2 - Insert or Update Lead into Supabase
 */
export async function insertLead(clinic_id: string, body: any) {
  const leadData = body.leadFormSubmissionData?.fieldValues || [];

  let first_name = "";
  let last_name = "";
  let email = "";
  let phone = "";

  for (const field of leadData) {
    const name = field.fieldName?.toLowerCase();
    const value = field.stringValue || "";

    if (name?.includes("first")) first_name = value;
    else if (name?.includes("last")) last_name = value;
    else if (name?.includes("email")) email = value;
    else if (name?.includes("phone")) phone = value;
  }

  const { error } = await supabase.from("lead").insert({
    first_name,
    last_name,
    email,
    phone,
    clinic_id,
    source_id: "670f33cf-043d-407f-aca9-19613e329de4",
    status: "New",
    form_data: body,
  });

  if (error) throw new Error(error.message);

  const redirectUrl = new URL(`${APP_URL}/onboarding`);
  redirectUrl.searchParams.set("google_lead_form_status", "success");

  return redirectUrl.toString();
}
