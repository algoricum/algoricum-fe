// _shared/pipedrive-service.ts
// Pipedrive integration service functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PIPEDRIVE_CLIENT_ID = Deno.env.get("PIPEDRIVE_CLIENT_ID");
const PIPEDRIVE_CLIENT_SECRET = Deno.env.get("PIPEDRIVE_CLIENT_SECRET");

// Types
interface PipedriveIntegration {
  id: string;
  clinic_id: string;
  access_token: string;
  refresh_token?: string;
  api_domain: string;
  company_id: string;
  user_id: string;
  expires_at?: string;
  is_active: boolean;
}

interface PipedriveLead {
  id: string;
  title: string;
  value: number;
  currency: string;
  person_id: string;
  organization_id?: string;
  owner_id?: string;
  source_name?: string;
  add_time: string;
  update_time?: string;
  notes?: string;
  [key: string]: any;
}

interface PipedrivePerson {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: any[] | string;
  phone?: any[] | string;
  org_id?: string;
  owner_id?: string;
  [key: string]: any;
}

interface MappedLead {
  clinic_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: "New";
  source_id: string;
  notes: string | null;
  interest_level: "medium";
  urgency: "curious";
  form_data: any;
}

interface SyncResult {
  synced_count: number;
  skipped_count: number;
  total_fetched: number;
  total_persons?: number;
  token_refreshed?: boolean;
}

// Helper function to construct proper Pipedrive API URLs
export function buildPipedriveUrl(apiDomain: string, endpoint: string): string {
  const baseUrl = apiDomain.startsWith("http") ? apiDomain : `https://${apiDomain}`;
  return `${baseUrl}/api/v1/${endpoint.startsWith("/") ? endpoint.slice(1) : endpoint}`;
}

// Property mapping configuration for Pipedrive
export async function discoverPipedriveProperties(accessToken: string, apiDomain: string, requestId: string) {
  try {
    console.log(`[${requestId}] Discovering Pipedrive properties...`);

    // Get person fields
    const personFieldsResponse = await fetch(buildPipedriveUrl(apiDomain, "personFields"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Get lead labels (custom fields for leads)
    const leadLabelsResponse = await fetch(buildPipedriveUrl(apiDomain, "leadLabels"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let personFields = [];
    let leadLabels = [];

    if (personFieldsResponse.ok) {
      const personData = await personFieldsResponse.json();
      personFields = personData.data || [];
      console.log(`[${requestId}] Found ${personFields.length} person fields`);
    }

    if (leadLabelsResponse.ok) {
      const labelData = await leadLabelsResponse.json();
      leadLabels = labelData.data || [];
      console.log(`[${requestId}] Found ${leadLabels.length} lead labels`);
    }

    const properties = {
      personFields: personFields.map((field: any) => ({
        key: field.key,
        name: field.name,
        field_type: field.field_type,
        options: field.options,
      })),
      leadLabels: leadLabels.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
    };

    console.log(`[${requestId}] Available Pipedrive properties:`, properties);
    return properties;
  } catch (error) {
    console.warn(`[${requestId}] Could not fetch Pipedrive properties:`, error.message);
    return { personFields: [], leadLabels: [] };
  }
}

// Extract custom fields from Pipedrive objects
export function extractCustomFields(data: any) {
  if (!data) return {};

  const customFields: any = {};

  // Pipedrive custom fields often have specific patterns
  Object.keys(data).forEach(key => {
    // Custom fields in Pipedrive are often prefixed or have specific patterns
    if (
      key.startsWith("custom_") ||
      key.includes("custom") ||
      /^[a-f0-9]{40}$/.test(key) || // Pipedrive custom field hashes
      key.match(/^[0-9a-f]{8,}$/)
    ) {
      // Other hash patterns
      customFields[key] = data[key];
    }
  });

  return customFields;
}

// Map Pipedrive data to lead format
export function mapPipedriveDataToLead(
  pipedriveData: PipedriveLead,
  person: PipedrivePerson | undefined,
  clinic_id: string,
  source_id: string,
  requestId: string,
): MappedLead | null {
  console.log(`[${requestId}] Mapping Pipedrive data for lead ID: ${pipedriveData.id}`);

  // Helper function to get first valid value from multiple sources
  const getFirstValidValue = (values: any[]) => {
    for (const value of values) {
      if (value && typeof value === "string" && value.trim() !== "") {
        return value.trim();
      }
      if (typeof value === "object" && value !== null) {
        // Handle array of objects (like Pipedrive email/phone arrays)
        if (Array.isArray(value) && value.length > 0 && value[0].value) {
          return value[0].value.trim();
        }
        // Handle single object with value property
        if (value.value && typeof value.value === "string") {
          return value.value.trim();
        }
      }
    }
    return null;
  };

  // Extract name components with multiple fallbacks
  const getNameComponents = () => {
    const nameSources = [
      person?.name,
      pipedriveData.title,
      pipedriveData.name,
      person?.first_name && person?.last_name ? `${person.first_name} ${person.last_name}` : null,
      // Custom field fallbacks
      person?.["custom_name"],
      person?.["full_name"],
      pipedriveData.label,
    ].filter(Boolean);

    for (const nameSource of nameSources) {
      if (nameSource && typeof nameSource === "string") {
        const nameParts = nameSource.trim().split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        if (firstName) {
          return { firstName, lastName };
        }
      }
    }

    return { firstName: null, lastName: null };
  };

  const { firstName, lastName } = getNameComponents();

  // Email mapping with comprehensive fallbacks
  const emailSources = [
    person?.email,
    pipedriveData.email,
    person?.["primary_email"],
    person?.["work_email"],
    person?.["business_email"],
    person?.["contact_email"],
    // Custom email fields
    person?.["custom_email"],
    person?.["email_address"],
    // Check if person has email array
    Array.isArray(person?.email) ? person.email : null,
  ];

  // Phone mapping with comprehensive fallbacks
  const phoneSources = [
    person?.phone,
    pipedriveData.phone,
    person?.["mobile"],
    person?.["mobile_phone"],
    person?.["work_phone"],
    person?.["business_phone"],
    person?.["contact_phone"],
    // Custom phone fields
    person?.["custom_phone"],
    person?.["phone_number"],
    // Check if person has phone array
    Array.isArray(person?.phone) ? person.phone : null,
  ];

  const mappedLead: MappedLead = {
    clinic_id: clinic_id,
    first_name: firstName,
    last_name: lastName,
    email: getFirstValidValue(emailSources),
    phone: getFirstValidValue(phoneSources),
    status: "New" as const,
    source_id,
    notes: pipedriveData.notes || null,
    interest_level: "medium" as const,
    urgency: "curious" as const,
    form_data: {
      pipedrive_lead_id: pipedriveData.id,
      pipedrive_person_id: pipedriveData.person_id || person?.id,
      pipedrive_title: pipedriveData.title,
      pipedrive_value: pipedriveData.value,
      pipedrive_currency: pipedriveData.currency,
      pipedrive_organization_id: pipedriveData.organization_id || person?.org_id,
      pipedrive_owner_id: pipedriveData.owner_id || person?.owner_id,
      pipedrive_source: pipedriveData.source_name,
      created_time: pipedriveData.add_time || pipedriveData.created_time,
      updated_time: pipedriveData.update_time || pipedriveData.updated_time,
      // Include any custom fields
      pipedrive_custom_fields: {
        ...extractCustomFields(pipedriveData),
        ...extractCustomFields(person),
      },
    },
  };

  // Validate that we have at least email or phone
  if (!mappedLead.email && !mappedLead.phone) {
    console.warn(`[${requestId}] Lead ${pipedriveData.id} has no valid email or phone`, {
      availableLeadProps: Object.keys(pipedriveData),
      availablePersonProps: person ? Object.keys(person) : [],
      leadId: pipedriveData.id,
      personId: person?.id,
    });
    return null;
  }

  console.log(`[${requestId}] Successfully mapped lead:`, {
    id: pipedriveData.id,
    first_name: mappedLead.first_name,
    last_name: mappedLead.last_name,
    email: mappedLead.email ? "Present" : "Missing",
    phone: mappedLead.phone ? "Present" : "Missing",
  });

  return mappedLead;
}

// Get account information
export async function getAccountInfo(accessToken: string, apiDomain: string) {
  try {
    console.log("Fetching account information...");

    // Get persons (contacts) count
    const personsResponse = await fetch(buildPipedriveUrl(apiDomain, "persons?limit=1"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let contactCount = 0;
    if (personsResponse.ok) {
      const personsData = await personsResponse.json();
      contactCount = personsData.additional_data?.pagination?.total || 0;
    }

    // Get deals count
    const dealsResponse = await fetch(buildPipedriveUrl(apiDomain, "deals?limit=1"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let dealCount = 0;
    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json();
      dealCount = dealsData.additional_data?.pagination?.total || 0;
    }

    return {
      accountName: "Pipedrive Account",
      contactCount,
      dealCount,
    };
  } catch (error) {
    console.error("Error fetching account info:", error);
    return {
      accountName: "Pipedrive Account",
      contactCount: 0,
      dealCount: 0,
    };
  }
}

// Initialize OAuth flow
export async function initializeOAuth(
  authHeader: string,
  clinic_id: string,
  redirectUrl?: string,
): Promise<{ success: boolean; authUrl?: string; error?: string }> {
  console.log("Starting OAuth initialization");

  try {
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log(`Token extracted (length: ${token.length})`);

    // Check environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PIPEDRIVE_CLIENT_ID) {
      throw new Error("Missing required environment variables");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error(`Invalid user token: ${userError?.message || "No user found"}`);
    }

    console.log(`User verified: ${user.id}`);

    // Verify user owns the clinic
    const { data: clinic, error: clinicError } = await supabase
      .from("clinic")
      .select("id, owner_id")
      .eq("id", clinic_id)
      .eq("owner_id", user.id)
      .single();

    if (clinicError || !clinic) {
      throw new Error("Clinic not found or unauthorized");
    }

    // Build OAuth URL
    const stateData = `${clinic_id}|${user.id}|${redirectUrl || ""}`;
    const redirectUri = Deno.env.get("PIPEDRIVE_REDIRECT_URI");

    const oauthUrl = new URL("https://oauth.pipedrive.com/oauth/authorize");
    oauthUrl.searchParams.set("client_id", PIPEDRIVE_CLIENT_ID);
    oauthUrl.searchParams.set("redirect_uri", redirectUri!);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("state", stateData);
    oauthUrl.searchParams.set("scope", "deals:read leads:read persons:read");

    // Store pending integration
    await supabase.from("pipedrive_integration").upsert(
      {
        clinic_id: clinic_id,
        access_token: "PENDING",
        api_domain: "pending.pipedrive.com",
        company_id: "pending",
        user_id: "pending",
        is_active: false,
      },
      {
        onConflict: "clinic_id",
        ignoreDuplicates: false,
      },
    );

    return {
      success: true,
      authUrl: oauthUrl.toString(),
    };
  } catch (error) {
    console.error("OAuth init error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Handle OAuth callback
export async function handleOAuthCallback(
  code: string,
  state?: string,
): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Starting OAuth callback handling`);

  try {
    if (!code) {
      throw new Error("Missing authorization code");
    }

    // Parse state if available
    let clinicId = null;
    let userId = null;
    let redirectUrl = null;

    if (state && state.includes("|")) {
      const [parsedClinicId, parsedUserId, parsedRedirectUrl] = state.split("|");
      clinicId = parsedClinicId;
      userId = parsedUserId;
      redirectUrl = parsedRedirectUrl;
    }

    console.log("parse user id is", parsedUserId, userId);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: PIPEDRIVE_CLIENT_ID!,
        client_secret: PIPEDRIVE_CLIENT_SECRET!,
        redirect_uri: Deno.env.get("PIPEDRIVE_REDIRECT_URI")!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[${requestId}] Token exchange failed:`, errorText);
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();
    console.log(`[${requestId}] Token exchange successful`);

    // Discover properties
    await discoverPipedriveProperties(tokenData.access_token, tokenData.api_domain, requestId);

    // Handle missing company_id and user_id
    if (!tokenData.company_id || !tokenData.user_id) {
      try {
        const userResponse = await fetch(buildPipedriveUrl(tokenData.api_domain, "users/me"), {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (!tokenData.company_id && userData.data?.company_id) {
            tokenData.company_id = userData.data.company_id;
          }
          if (!tokenData.user_id && userData.data?.id) {
            tokenData.user_id = userData.data.id;
          }
        }
      } catch (apiError) {
        console.log(`[${requestId}] Could not fetch user data from API:`, apiError.message);
      }
    }

    // If no clinicId from state, find pending integration
    if (!clinicId) {
      const { data: pendingIntegrations } = await supabase
        .from("pipedrive_integration")
        .select("clinic_id, user_id")
        .eq("access_token", "PENDING")
        .eq("is_active", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingIntegrations && pendingIntegrations.length > 0) {
        const pendingIntegration = pendingIntegrations[0];
        clinicId = pendingIntegration.clinic_id;
        // userId = pendingIntegration.user_id;
      }
    }

    if (!clinicId) {
      throw new Error("Could not determine clinic for this integration");
    }

    // Calculate expiry time
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    // Validate required data
    if (!tokenData.access_token || !tokenData.api_domain) {
      throw new Error("Missing required token data from Pipedrive");
    }

    // Save integration to database
    const integrationData = {
      clinic_id: clinicId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      api_domain: tokenData.api_domain,
      company_id: tokenData.company_id ? tokenData.company_id.toString() : "unknown",
      user_id: tokenData.user_id ? tokenData.user_id.toString() : "unknown",
      expires_at: expiresAt?.toISOString() || null,
      is_active: true,
    };

    // Try update first, then insert
    const { data: updateData, error: updateError } = await supabase
      .from("pipedrive_integration")
      .update(integrationData)
      .eq("clinic_id", clinicId)
      .select();

    // let data, error;
    // if (updateError) {
    //   const { data: insertData, error: insertError } = await supabase.from("pipedrive_integration").insert(integrationData).select();

    //   data = insertData;
    //   error = insertError;
    // } else {
    //   data = updateData;
    //   error = updateError;
    // }

    console.log("pipedrive integration data is ", updateData);

    if (updateError) {
      console.error(`[${requestId}] Database save error:`, updateError);
      throw new Error("Failed to save integration");
    }

    // Get account info
    const accountInfo = await getAccountInfo(tokenData.access_token, tokenData.api_domain);

    const successUrl = `${redirectUrl || "http://localhost:3000"}?pipedrive_status=success&account_name=${encodeURIComponent(accountInfo.accountName)}&contact_count=${accountInfo.contactCount}&deal_count=${accountInfo.dealCount}`;

    return {
      success: true,
      redirectUrl: successUrl,
    };
  } catch (error) {
    console.error(`[${requestId}] OAuth callback error:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Sync leads for a specific clinic
export async function syncLeadsForClinic(clinic_id: string): Promise<SyncResult & { success: boolean; error?: string }> {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Starting lead sync for clinic: ${clinic_id}`);

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get Pipedrive integration
    const { data: integration, error: integrationError } = await supabase
      .from("pipedrive_integration")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      throw new Error("Pipedrive integration not found");
    }

    // Sync leads using core function
    const result = await syncPipedriveIntegration(integration, requestId);

    // Update last sync timestamp
    await supabase
      .from("pipedrive_integration")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error(`[${requestId}] Sync leads error:`, error);
    return {
      success: false,
      error: error.message,
      synced_count: 0,
      skipped_count: 0,
      total_fetched: 0,
    };
  }
}

// Sync all leads (cron job)
export async function syncAllLeads(
  modifiedSince?: string,
): Promise<{ success: boolean; results: any[]; total_synced: number; error?: string }> {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Starting cron sync for all clinics`);

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get all active Pipedrive integrations
    const { data: integrations, error: integrationsError } = await supabase.from("pipedrive_integration").select("*").eq("is_active", true);

    if (integrationsError || !integrations) {
      throw new Error("Failed to fetch integrations");
    }

    console.log(`[${requestId}] Found ${integrations.length} active Pipedrive integrations`);

    let totalSynced = 0;
    const results = [];

    // Calculate 5 minutes ago timestamp for filtering recent leads
    const fiveMinutesAgo = modifiedSince || new Date(Date.now() - 5 * 60 * 1000).toISOString();

    for (const integration of integrations) {
      try {
        const result = await syncPipedriveIntegration(integration, requestId, fiveMinutesAgo);
        totalSynced += result.synced_count;
        results.push({
          clinic_id: integration.clinic_id,
          provider: "pipedrive",
          synced_count: result.synced_count,
          skipped_count: result.skipped_count,
          total_fetched: result.total_fetched,
        });

        // Update last sync timestamp
        await supabase
          .from("pipedrive_integration")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);
      } catch (error) {
        console.error(`[${requestId}] Error syncing clinic ${integration.clinic_id}:`, error);
        results.push({
          clinic_id: integration.clinic_id,
          provider: "pipedrive",
          error: error.message,
        });
      }
    }

    return {
      success: true,
      total_synced: totalSynced,
      results,
    };
  } catch (error) {
    console.error(`[${requestId}] Cron sync error:`, error);
    return {
      success: false,
      error: error.message,
      total_synced: 0,
      results: [],
    };
  }
}

// Core sync function that works with Pipedrive integrations
export async function syncPipedriveIntegration(
  integration: PipedriveIntegration,
  requestId: string,
  modifiedSince?: string,
): Promise<SyncResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Check if token is expired and refresh if needed
  let accessToken = integration.access_token;
  let tokenRefreshed = false;
  const tokenExpired = integration.expires_at && new Date(integration.expires_at) <= new Date();

  if (tokenExpired && integration.refresh_token) {
    console.log(`[${requestId}] Token expired for clinic ${integration.clinic_id}, refreshing...`);

    const refreshResponse = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: integration.refresh_token,
        client_id: PIPEDRIVE_CLIENT_ID!,
        client_secret: PIPEDRIVE_CLIENT_SECRET!,
      }),
    });

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      tokenRefreshed = true;

      console.log(`[${requestId}] Token refreshed successfully for clinic ${integration.clinic_id}`);

      // Update token in database
      await supabase
        .from("pipedrive_integration")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || integration.refresh_token,
          expires_at: refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    } else {
      const refreshError = await refreshResponse.text();
      console.error(`[${requestId}] Token refresh failed for clinic ${integration.clinic_id}:`, refreshError);
      throw new Error("Failed to refresh access token. Please re-authenticate with Pipedrive.");
    }
  } else if (tokenExpired && !integration.refresh_token) {
    console.error(`[${requestId}] Token expired and no refresh token for clinic ${integration.clinic_id}`);
    throw new Error("Access token expired and no refresh token available. Please re-authenticate with Pipedrive.");
  }

  // Test the token
  console.log(`[${requestId}] Testing API connection for clinic ${integration.clinic_id}...`);
  const testResponse = await fetch(buildPipedriveUrl(integration.api_domain, "users/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!testResponse.ok) {
    const testError = await testResponse.text();
    console.error(`[${requestId}] API test failed for clinic ${integration.clinic_id}:`, testError);

    if (testResponse.status === 401) {
      // Mark integration as inactive if token is completely invalid
      await supabase
        .from("pipedrive_integration")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", integration.id);

      throw new Error("Access token is invalid. Please re-authenticate with Pipedrive.");
    }

    throw new Error(`Pipedrive API connection failed: ${testResponse.status}`);
  }

  console.log(`[${requestId}] API connection successful for clinic ${integration.clinic_id}`);

  // Get or create lead source for Pipedrive
  const { data: leadSource } = await supabase.from("lead_source").select("id").eq("name", "Pipedrive").single();

  let sourceId = leadSource?.id;

  if (!sourceId) {
    const { data: newSource } = await supabase
      .from("lead_source")
      .insert({
        name: "Pipedrive",
      })
      .select("id")
      .single();

    sourceId = newSource?.id;
    console.log(`[${requestId}] Created new lead source with ID: ${sourceId}`);
  }

  // Calculate 4 months ago for filtering old records
  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
  const fourMonthsAgoStr = fourMonthsAgo.toISOString().slice(0, 19).replace("T", " ");

  // Fetch leads from Pipedrive with date filtering
  let leadsUrl = buildPipedriveUrl(integration.api_domain, "leads?limit=500");

  // Always filter records older than 4 months
  leadsUrl += `&start_date=${encodeURIComponent(fourMonthsAgoStr)}`;
  console.log(`[${requestId}] Filtering leads created after: ${fourMonthsAgoStr}`);

  // Add additional date filter for cron jobs (recent records)
  if (modifiedSince) {
    // Convert to Pipedrive date format (YYYY-MM-DD HH:MM:SS)
    const recentDate = new Date(modifiedSince).toISOString().slice(0, 19).replace("T", " ");
    // Use the more recent of the two dates
    const finalStartDate = new Date(modifiedSince) > fourMonthsAgo ? recentDate : fourMonthsAgoStr;
    leadsUrl = buildPipedriveUrl(integration.api_domain, "leads?limit=500");
    leadsUrl += `&start_date=${encodeURIComponent(finalStartDate)}`;
    console.log(`[${requestId}] Using final start date: ${finalStartDate}`);
  }

  console.log(`[${requestId}] Fetching leads from: ${leadsUrl}`);

  const leadsResponse = await fetch(leadsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!leadsResponse.ok) {
    const errorText = await leadsResponse.text();
    console.error(`[${requestId}] Pipedrive leads API error:`, errorText);
    throw new Error(`Pipedrive API error: ${leadsResponse.status} - ${errorText}`);
  }

  const leadsData = await leadsResponse.json();
  const pipedriveLeads = leadsData.data || [];

  console.log(`[${requestId}] Found ${pipedriveLeads.length} leads in Pipedrive for clinic ${integration.clinic_id}`);

  // Fetch persons for additional contact info
  const personsUrl = buildPipedriveUrl(integration.api_domain, "persons?limit=500");
  console.log(`[${requestId}] Fetching persons from: ${personsUrl}`);

  const personsResponse = await fetch(personsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let personsData = { data: [] };
  if (personsResponse.ok) {
    personsData = await personsResponse.json();
    console.log(`[${requestId}] Successfully fetched ${personsData.data?.length || 0} persons`);
  } else {
    console.warn(`[${requestId}] Failed to fetch persons: ${personsResponse.status}`);
  }

  // Create persons map
  const personsMap = new Map();
  if (personsData.data) {
    personsData.data.forEach((person: any) => {
      personsMap.set(person.id, person);
    });
  }

  console.log(`[${requestId}] Found ${personsMap.size} persons in Pipedrive`);

  // Transform and save leads
  const leadsToInsert = [];
  let skippedCount = 0;

  for (const pipedriveData of pipedriveLeads) {
    const person = personsMap.get(pipedriveData.person_id);

    const mappedLead = mapPipedriveDataToLead(pipedriveData, person, integration.clinic_id, sourceId, requestId);

    if (mappedLead) {
      leadsToInsert.push(mappedLead);
    } else {
      skippedCount++;
    }
  }

  console.log(`[${requestId}] Preparing to insert ${leadsToInsert.length} leads, skipped ${skippedCount} leads`);

  let insertedCount = 0;
  if (leadsToInsert.length > 0) {
    const { data: insertedLeads, error: insertError } = await supabase
      .from("lead")
      .upsert(leadsToInsert, {
        onConflict: "clinic_id,email", // Prevent duplicates based on clinic + email
        ignoreDuplicates: true, // Skip duplicates instead of erroring
      })
      .select("id");

    if (insertError) {
      console.error(`[${requestId}] Insert error:`, insertError);
      throw new Error(`Failed to save leads: ${insertError.message}`);
    }

    insertedCount = insertedLeads?.length || 0;
    console.log(`[${requestId}] Successfully synced ${insertedCount} leads for clinic ${integration.clinic_id}`);
  }

  return {
    synced_count: insertedCount,
    skipped_count: skippedCount,
    total_fetched: pipedriveLeads.length,
    total_persons: personsMap.size,
    token_refreshed: tokenRefreshed,
  };
}

// Export types for use in other files
export type { MappedLead, PipedriveIntegration, PipedriveLead, PipedrivePerson, SyncResult };
