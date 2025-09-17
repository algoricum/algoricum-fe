// _shared/calendly-service.ts

const CALENDLY_CLIENT_ID = Deno.env.get("CALENDLY_CLIENT_ID");
const CALENDLY_CLIENT_SECRET = Deno.env.get("CALENDLY_CLIENT_SECRET");

interface CalendlyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  created_at: number;
}

interface ClinicTiming {
  clinic_id: string;
  timezone: string;
  working_hours: {
    monday?: { start: string; end: string; enabled: boolean };
    tuesday?: { start: string; end: string; enabled: boolean };
    wednesday?: { start: string; end: string; enabled: boolean };
    thursday?: { start: string; end: string; enabled: boolean };
    friday?: { start: string; end: string; enabled: boolean };
    saturday?: { start: string; end: string; enabled: boolean };
    sunday?: { start: string; end: string; enabled: boolean };
  };
  buffer_time?: number;
  advance_booking_days?: number;
}

interface CalendlyEventType {
  uri: string;
  name: string;
  scheduling_url: string;
  duration: number;
  kind: string;
  active: boolean;
}

// Enhanced logging
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CALENDLY-SERVICE: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] CALENDLY-SERVICE ERROR: ${message}`, error);
}

// Validate clinic timing data
function validateClinicTiming(timing: ClinicTiming): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!timing.clinic_id) errors.push("clinic_id is required");
  if (!timing.timezone) errors.push("timezone is required");
  if (!timing.working_hours || Object.keys(timing.working_hours).length === 0) {
    errors.push("working_hours is required");
  }

  const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  for (const [day, hours] of Object.entries(timing.working_hours)) {
    if (!validDays.includes(day)) {
      errors.push(`Invalid day: ${day}`);
      continue;
    }

    if (hours.enabled && (!hours.start || !hours.end)) {
      errors.push(`Start and end times required for enabled day: ${day}`);
    }

    if (hours.start && !timeRegex.test(hours.start)) {
      errors.push(`Invalid start time format for ${day}: ${hours.start}`);
    }

    if (hours.end && !timeRegex.test(hours.end)) {
      errors.push(`Invalid end time format for ${day}: ${hours.end}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Exchange OAuth code for tokens
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<CalendlyTokens> {
  if (!CALENDLY_CLIENT_ID || !CALENDLY_CLIENT_SECRET) {
    throw new Error("Calendly OAuth credentials not configured");
  }

  const response = await fetch("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CALENDLY_CLIENT_ID,
      client_secret: CALENDLY_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    logError("Calendly token exchange failed", { status: response.status, error: errorData });
    throw new Error(`Token exchange failed: ${response.status} - ${errorData}`);
  }

  const tokens = (await response.json()) as CalendlyTokens;
  tokens.created_at = Date.now();

  logInfo("Successfully exchanged code for tokens");
  return tokens;
}

// Get Calendly user info
async function getCalendlyUser(accessToken: string) {
  const response = await fetch("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.text();
    logError("Failed to get Calendly user", { status: response.status, error: errorData });
    throw new Error(`Failed to get user info: ${response.status} - ${errorData}`);
  }

  return response.json();
}

// Get user's event types
async function getEventTypes(accessToken: string, userUri: string): Promise<CalendlyEventType[]> {
  const response = await fetch(`https://api.calendly.com/event_types?user=${userUri}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.text();
    logError("Failed to get event types", { status: response.status, error: errorData });
    throw new Error(`Failed to get event types: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.collection || [];
}

// Store or update integration in database
async function storeIntegration(supabase: any, clinicId: string, tokens: CalendlyTokens, userInfo: any) {
  try {
    const { data: existingIntegration } = await supabase
      .from("calendly_integrations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .single();

    const integrationData = {
      clinic_id: clinicId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.created_at + tokens.expires_in * 1000).toISOString(),
      status: "active",
      configuration: {
        scheduling_url: userInfo.resource.scheduling_url,
        timezone: userInfo.resource.timezone,
        user_uri: userInfo.resource.uri,
        user_email: userInfo.resource.email,
        user_name: userInfo.resource.name,
      },
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingIntegration) {
      result = await supabase.from("calendly_integrations").update(integrationData).eq("id", existingIntegration.id).select().single();
    } else {
      integrationData.created_at = new Date().toISOString();
      result = await supabase.from("calendly_integrations").insert(integrationData).select().single();
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    logInfo("Successfully stored Calendly integration", { clinicId });
    return result.data;
  } catch (error) {
    logError("Failed to store integration", error);
    throw error;
  }
}

// Get clinic integration with validation
async function getClinicIntegration(supabase: any, clinicId: string) {
  const { data: integration, error } = await supabase
    .from("calendly_integrations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .single();

  if (error || !integration) {
    throw new Error("Calendly integration not found for clinic");
  }

  // Check token expiry
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);

  if (now >= expiresAt) {
    throw new Error("Calendly token expired - re-authentication required");
  }

  return integration;
}

// Save selected event type to clinic
async function saveSelectedEventType(supabase: any, clinicId: string, selectedEventTypeUri: string, clinicTiming?: ClinicTiming) {
  const integration = await getClinicIntegration(supabase, clinicId);
  const userUri = integration.configuration?.user_uri;
  const eventTypes = await getEventTypes(integration.access_token, userUri);
  const selectedEventType = eventTypes.find(et => et.uri === selectedEventTypeUri);

  if (!selectedEventType) {
    throw new Error("Selected event type not found");
  }

  // Update clinic with selected Calendly link
  const { error: updateError } = await supabase
    .from("clinic")
    .update({
      calendly_link: selectedEventType.scheduling_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicId);

  if (updateError) {
    throw new Error(`Failed to update clinic: ${updateError.message}`);
  }

  await supabase
    .from("calendly_integrations")
    .update({
      selected_event_type_uri: selectedEventType.uri,
      selected_event_type_name: selectedEventType.name,
      selected_event_type_duration: selectedEventType.duration,
      clinic_booking_link: selectedEventType.scheduling_url,
      configuration: {
        ...integration.configuration,
        clinic_timing: clinicTiming || null,
        selected_event_kind: selectedEventType.kind,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  logInfo("Successfully saved selected Calendly event type", {
    clinicId,
    eventType: selectedEventType.name,
  });

  return selectedEventType;
}

// Store available event types in integration
async function storeAvailableEventTypes(supabase: any, clinicId: string) {
  const integration = await getClinicIntegration(supabase, clinicId);
  const userUri = integration.configuration?.user_uri;
  const eventTypes = await getEventTypes(integration.access_token, userUri);

  // Update integration with available event types
  await supabase
    .from("calendly_integrations")
    .update({
      available_event_types: eventTypes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  logInfo("Successfully stored available event types", {
    clinicId,
    eventTypesCount: eventTypes.length,
  });

  return eventTypes;
}

// Get clinic integration status
async function getIntegrationStatus(supabase: any, clinicId: string) {
  const { data: integration } = await supabase
    .from("calendly_integrations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .single();

  if (!integration) {
    return {
      connected: false,
      message: "Calendly not connected for this clinic",
    };
  }

  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  const isExpired = now >= expiresAt;

  return {
    connected: true,
    status: integration.status,
    calendly_user: integration.configuration?.user_name,
    calendly_email: integration.configuration?.user_email,
    scheduling_url: integration.configuration?.scheduling_url,
    selected_event_type: {
      uri: integration.selected_event_type_uri,
      name: integration.selected_event_type_name,
      duration: integration.selected_event_type_duration,
      booking_link: integration.clinic_booking_link,
    },
    token_expired: isExpired,
    expires_at: integration.token_expires_at,
  };
}

// Disconnect integration
async function disconnectIntegration(supabase: any, clinicId: string) {
  const { error } = await supabase
    .from("calendly_integrations")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  logInfo("Calendly integration disconnected", { clinicId });
}

export {
  exchangeCodeForTokens,
  getCalendlyUser,
  getEventTypes,
  storeIntegration,
  getClinicIntegration,
  saveSelectedEventType,
  storeAvailableEventTypes,
  getIntegrationStatus,
  disconnectIntegration,
  validateClinicTiming,
  logInfo,
  logError,
};

export type { CalendlyTokens, ClinicTiming, CalendlyEventType };
