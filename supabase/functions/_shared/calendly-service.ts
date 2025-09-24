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

interface WebhookSubscription {
  uri: string;
  callback_url: string;
  created_at: string;
  updated_at: string;
  retry_started_at?: string;
  state: string;
  events: string[];
  scope: string;
  organization: string;
  user?: string;
  creator: string;
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

    // Get user's organization for webhook creation
    let currentOrganization = null;
    try {
      const orgResponse = await fetch("https://api.calendly.com/organization_memberships?user=" + userInfo.resource.uri, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        if (orgData.collection && orgData.collection.length > 0) {
          currentOrganization = orgData.collection[0].organization;
          logInfo("Retrieved organization for webhook setup", { organization: currentOrganization });
        }
      }
    } catch (orgError) {
      logError("Failed to fetch organization - webhooks may not work", orgError);
    }

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
        current_organization: currentOrganization,
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

// Handle Calendly webhook events
async function handleCalendlyWebhook(webhookData: any, supabase: any) {
  logInfo("Processing Calendly webhook", { event: webhookData.event });

  try {
    // Extract event information
    const eventType = webhookData.event;
    const payload = webhookData.payload;

    // Handle different webhook events
    switch (eventType) {
      case "invitee.created":
        return await handleInviteeCreated(payload, supabase);
      case "invitee.canceled":
        return await handleInviteeCanceled(payload, supabase);
      default:
        logInfo("Unhandled webhook event type", { eventType });
        return { handled: false, reason: "Unhandled event type" };
    }
  } catch (error) {
    logError("Webhook processing error", error);
    throw error;
  }
}

// Handle when someone books an appointment
async function handleInviteeCreated(payload: any, supabase: any) {
  logInfo("Processing invitee created", { payload });

  try {
    const invitee = payload;

    // Find the clinic based on event type URI
    const clinic = await findClinicByEventType(invitee.scheduled_event.event_type, supabase);
    if (!clinic) {
      logError("No clinic found for event type", { event_type_uri: invitee.scheduled_event.event_type });
      return { handled: false, reason: "No clinic found for this event type" };
    }

    // Find existing lead by email and clinic
    const lead = await findLeadByEmail(invitee.email, clinic.clinic_id, supabase);
    if (!lead) {
      logError("No lead found with email", { email: invitee.email, clinic_id: clinic.clinic_id });
      return { handled: false, reason: "No lead found with this email" };
    }

    logInfo("Found lead for booking", { leadId: lead.id, email: invitee.email });

    // Extract phone from answers if available
    let phoneNumber = lead.phone; // Use existing phone from lead
    if (invitee.questions_and_answers && Array.isArray(invitee.questions_and_answers)) {
      const phoneAnswer = invitee.questions_and_answers.find(
        (answer: any) =>
          answer.question.toLowerCase().includes("phone") ||
          answer.question.toLowerCase().includes("mobile") ||
          answer.question.toLowerCase().includes("contact"),
      );
      if (phoneAnswer && phoneAnswer.answer) {
        phoneNumber = phoneAnswer.answer;
      }
    }

    // Prepare meeting schedule data
    const meetingData = {
      username: invitee.name,
      email: invitee.email,
      preferred_meeting_time: new Date(invitee.scheduled_event.start_time),
      meeting_link: invitee.scheduled_event.uri,
      calendly_link: invitee.scheduled_event.event_type,
      meeting_notes: JSON.stringify({
        event_type: invitee.scheduled_event.name,
        end_time: invitee.scheduled_event.end_time,
        timezone: invitee.timezone,
        answers: invitee.questions_and_answers || [],
        calendly_event_id: invitee.uri,
        scheduled_event_uri: invitee.scheduled_event.uri,
      }),
      clinic_id: clinic.clinic_id,
      status: "confirmed",
      phone_number: phoneNumber,
    };

    // Upsert meeting schedule record (unique by email)
    const { data: meetingRecord, error: meetingError } = await supabase
      .from("meeting_schedule")
      .upsert(meetingData, { onConflict: "email" })
      .select();

    if (meetingError) {
      logError("Failed to save meeting schedule", meetingError);
      throw new Error(`Failed to save meeting schedule: ${meetingError.message}`);
    }

    logInfo("Meeting schedule saved successfully", {
      meetingId: meetingRecord[0]?.id,
      email: invitee.email,
      leadId: lead.id,
    });

    // Update lead status to "Booked" if not already
    if (lead.status !== "Booked") {
      await updateLeadStatus(lead.id, "Booked", supabase);
    }

    return {
      handled: true,
      meetingId: meetingRecord[0]?.id,
      leadId: lead.id,
      clinic: clinic.clinic_id,
    };
  } catch (error) {
    logError("Error handling invitee created", error);
    throw error;
  }
}

// Handle when someone cancels an appointment
async function handleInviteeCanceled(payload: any, supabase: any) {
  logInfo("Processing invitee canceled", { payload });

  try {
    const invitee = payload;

    // Get existing meeting to preserve notes
    const { data: existingMeeting } = await supabase.from("meeting_schedule").select("meeting_notes").eq("email", invitee.email).single();

    // Parse existing notes and add cancellation info
    let existingNotes = {};
    try {
      existingNotes = JSON.parse(existingMeeting?.meeting_notes || "{}");
    } catch (e) {
      console.log("error creating meeting schedule", e.message);
      existingNotes = {};
    }

    // Update meeting schedule status to pending (or you could delete it)
    const { data, error } = await supabase
      .from("meeting_schedule")
      .update({
        status: "pending",
        meeting_notes: JSON.stringify({
          ...existingNotes,
          canceled_at: new Date().toISOString(),
          cancellation_reason: "Canceled via Calendly",
        }),
      })
      .eq("email", invitee.email)
      .select();

    if (error) {
      logError("Failed to update canceled meeting", error);
      throw new Error(`Failed to update meeting: ${error.message}`);
    }

    if (data && data.length > 0) {
      logInfo("Meeting canceled successfully", { meetingId: data[0].id, email: invitee.email });

      // Optionally update lead status back to previous status
      // You can customize this based on your business logic

      return { handled: true, meetingId: data[0].id, status: "canceled" };
    } else {
      logInfo("No meeting found to cancel", { email: invitee.email });
      return { handled: false, reason: "No meeting found" };
    }
  } catch (error) {
    logError("Error handling invitee canceled", error);
    throw error;
  }
}

// Find clinic by event type URI
async function findClinicByEventType(eventTypeUri: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from("calendly_integrations")
      .select("clinic_id, selected_event_type_uri")
      .eq("selected_event_type_uri", eventTypeUri)
      .eq("status", "active")
      .single();

    if (error || !data) {
      // Try to find by checking available_event_types array
      const { data: integrations, error: intError } = await supabase
        .from("calendly_integrations")
        .select("clinic_id, available_event_types")
        .eq("status", "active");

      if (!intError && integrations) {
        for (const integration of integrations) {
          if (integration.available_event_types) {
            const eventType = integration.available_event_types.find((et: any) => et.uri === eventTypeUri);
            if (eventType) {
              return { clinic_id: integration.clinic_id };
            }
          }
        }
      }

      return null;
    }

    return { clinic_id: data.clinic_id };
  } catch (error) {
    logError("Error finding clinic by event type", error);
    return null;
  }
}

// Find lead by email and clinic
async function findLeadByEmail(email: string, clinicId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from("lead")
      .select("id, phone, status, first_name, last_name")
      .eq("email", email)
      .eq("clinic_id", clinicId)
      .single();

    if (error || !data) {
      logInfo("No lead found", { email, clinicId, error: error?.message });
      return null;
    }

    return data;
  } catch (error) {
    logError("Error finding lead by email", error);
    return null;
  }
}

// Update lead status
async function updateLeadStatus(leadId: string, status: string, supabase: any) {
  try {
    const { error } = await supabase.from("lead").update({ status, updated_at: new Date().toISOString() }).eq("id", leadId);

    if (error) {
      logError("Failed to update lead status", error);
    } else {
      logInfo("Lead status updated", { leadId, status });
    }
  } catch (error) {
    logError("Error updating lead status", error);
  }
}

// Create webhook subscription for Calendly integration
async function createWebhookSubscription(supabase: any, clinicId: string, webhookUrl: string): Promise<WebhookSubscription> {
  const integration = await getClinicIntegration(supabase, clinicId);

  if (!integration.configuration?.current_organization) {
    throw new Error("Organization URI not found in integration configuration");
  }

  // Check if webhook already exists for this organization
  logInfo("Checking for existing webhook subscriptions", { clinicId, webhookUrl });

  const organizationUri = integration.configuration.current_organization;
  if (!organizationUri) {
    throw new Error("Organization URI is missing from integration configuration");
  }

  const listResponse = await fetch(
    `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`,
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
      },
    },
  );

  if (listResponse.ok) {
    const existingWebhooks = await listResponse.json();
    const existingWebhook = existingWebhooks.collection?.find((webhook: any) => webhook.callback_url === webhookUrl);

    if (existingWebhook) {
      logInfo("Found existing webhook subscription", { clinicId, webhookUri: existingWebhook.uri });

      // Store the existing webhook URI in database
      const { error: updateError } = await supabase
        .from("calendly_integrations")
        .update({
          webhook_subscription_uri: existingWebhook.uri,
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId);

      if (updateError) {
        logError("Failed to store existing webhook subscription URI", updateError);
      }

      return existingWebhook;
    }
  } else {
    const errorText = await listResponse.text();
    logError("Failed to list existing webhooks", {
      status: listResponse.status,
      statusText: listResponse.statusText,
      error: errorText,
      organizationUri: organizationUri,
      clinicId,
    });
  }

  const requestBody = {
    url: webhookUrl,
    events: ["invitee.created", "invitee.canceled"],
    organization: integration.configuration.current_organization,
    scope: "organization",
  };

  logInfo("Creating new Calendly webhook subscription", { clinicId, webhookUrl, events: requestBody.events });

  const response = await fetch("https://api.calendly.com/webhook_subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Handle 409 conflict (webhook already exists) gracefully
    if (response.status === 409) {
      logInfo("Webhook already exists for this URL - handling gracefully", { clinicId, webhookUrl });

      // Try to find and return the existing webhook
      try {
        const listRetryResponse = await fetch(
          `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(integration.configuration.current_organization)}&scope=organization`,
          {
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
            },
          },
        );

        if (listRetryResponse.ok) {
          const webhooks = await listRetryResponse.json();
          logInfo("Retrieved existing webhooks for conflict resolution", {
            clinicId,
            webhookCount: webhooks.collection?.length || 0,
          });

          const existingWebhook = webhooks.collection?.find((webhook: any) => webhook.callback_url === webhookUrl);

          if (existingWebhook) {
            logInfo("Found matching existing webhook", { clinicId, webhookUri: existingWebhook.uri });

            // Store the webhook URI
            await supabase
              .from("calendly_integrations")
              .update({
                webhook_subscription_uri: existingWebhook.uri,
                updated_at: new Date().toISOString(),
              })
              .eq("clinic_id", clinicId);

            return existingWebhook;
          } else {
            logInfo("No matching webhook found - creating placeholder response", { clinicId });
            // If we can't find the specific webhook, create a minimal response to avoid error
            const placeholderWebhook = {
              uri: "placeholder",
              callback_url: webhookUrl,
              events: ["invitee.created", "invitee.canceled"],
              state: "active",
              scope: "organization",
              organization: integration.configuration.current_organization,
            };

            // Don't store placeholder URI
            return placeholderWebhook;
          }
        } else {
          const errorText = await listRetryResponse.text();
          logError("Failed to list existing webhooks during conflict resolution", {
            status: listRetryResponse.status,
            statusText: listRetryResponse.statusText,
            error: errorText,
            organizationUri: integration.configuration.current_organization,
            clinicId,
          });
        }
      } catch (listError) {
        logError("Error while handling webhook conflict", { clinicId, error: listError });
      }

      // If all else fails, return a minimal webhook object to avoid throwing error
      logInfo("Returning minimal webhook response for 409 conflict", { clinicId });
      return {
        uri: "conflict-handled",
        callback_url: webhookUrl,
        events: ["invitee.created", "invitee.canceled"],
        state: "active",
        scope: "organization",
        organization: integration.configuration.current_organization,
      };
    }

    logError("Failed to create Calendly webhook", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      clinicId,
    });
    throw new Error(`Failed to create webhook subscription: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const webhookData = result.resource;

  // Store webhook subscription URI in the integration record
  const { error: updateError } = await supabase
    .from("calendly_integrations")
    .update({
      webhook_subscription_uri: webhookData.uri,
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);

  if (updateError) {
    logError("Failed to store webhook subscription URI", updateError);
    throw new Error(`Failed to store webhook subscription URI: ${updateError.message}`);
  }

  logInfo("Successfully created webhook subscription", {
    clinicId,
    webhookUri: webhookData.uri,
    events: webhookData.events,
  });

  return webhookData;
}

// Delete webhook subscription
async function deleteWebhookSubscription(supabase: any, clinicId: string): Promise<void> {
  const integration = await getClinicIntegration(supabase, clinicId);

  if (!integration.webhook_subscription_uri) {
    logInfo("No webhook subscription to delete", { clinicId });
    return;
  }

  logInfo("Deleting webhook subscription", { clinicId, webhookUri: integration.webhook_subscription_uri });

  const response = await fetch(integration.webhook_subscription_uri, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${integration.access_token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    logError("Failed to delete webhook subscription", {
      status: response.status,
      error: errorText,
      clinicId,
    });
    throw new Error(`Failed to delete webhook subscription: ${response.status} - ${errorText}`);
  }

  // Clear webhook subscription URI from database
  const { error: updateError } = await supabase
    .from("calendly_integrations")
    .update({
      webhook_subscription_uri: null,
      updated_at: new Date().toISOString(),
    })
    .eq("clinic_id", clinicId);

  if (updateError) {
    logError("Failed to clear webhook subscription URI", updateError);
  }

  logInfo("Successfully deleted webhook subscription", { clinicId });
}

export {
  createWebhookSubscription,
  deleteWebhookSubscription,
  disconnectIntegration,
  exchangeCodeForTokens,
  getCalendlyUser,
  getClinicIntegration,
  getEventTypes,
  getIntegrationStatus,
  handleCalendlyWebhook,
  logError,
  logInfo,
  saveSelectedEventType,
  storeAvailableEventTypes,
  storeIntegration,
  validateClinicTiming,
};

export type { CalendlyEventType, CalendlyTokens, ClinicTiming, WebhookSubscription };
