import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
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
} from "../_shared/calendly-service.ts";
import { defaultCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL");

// Robust error handler with context
function createErrorResponse(message: string, statusCode: number = 500, context?: any) {
  logError(message, context);
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      context: context ? JSON.stringify(context) : undefined,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Main handler function
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  logInfo(`Processing ${method} request to ${url.pathname}`);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return createErrorResponse("Supabase configuration missing", 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Handle OAuth start - generate OAuth URL
    if (method === "POST" && url.pathname.includes("/oauth/start")) {
      const { clinic_id, redirect_uri } = await request.json();

      if (!clinic_id) {
        return createErrorResponse("clinic_id is required", 400);
      }

      const calendlyClientId = Deno.env.get("CALENDLY_CLIENT_ID");
      if (!calendlyClientId) {
        return createErrorResponse("Calendly OAuth not configured", 500);
      }

      const baseRedirectUri = redirect_uri || `${url.origin}/oauth/callback`;
      const state = clinic_id;
      const scope = "default";

      const oauthUrl = `https://auth.calendly.com/oauth/authorize?client_id=${calendlyClientId}&response_type=code&redirect_uri=${encodeURIComponent(baseRedirectUri)}&state=${state}&scope=${scope}`;

      return new Response(
        JSON.stringify({
          success: true,
          oauth_url: oauthUrl,
          clinic_id: clinic_id,
        }),
        { status: 200, headers: { ...defaultCorsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Handle OAuth callback
    if (method === "GET" && url.pathname.includes("/oauth/callback")) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // Contains clinic_id
      const redirectUri = `${SUPABASE_URL}/functions/v1/calendly-integrations/oauth/callback`;

      if (!code || !state) {
        return createErrorResponse("Missing OAuth parameters", 400, { code: !!code, state: !!state });
      }

      try {
        logInfo("Starting OAuth callback processing", { code: !!code, state, redirectUri });
        const tokens = await exchangeCodeForTokens(code, redirectUri);
        logInfo("Tokens exchanged successfully");
        const userInfo = await getCalendlyUser(tokens.access_token);
        logInfo("User info retrieved successfully");

        // Use service role for database operations
        const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const integration = await storeIntegration(serviceSupabase, state, tokens, userInfo);
        logInfo("Integration stored successfully");

        // Store available event types
        await storeAvailableEventTypes(serviceSupabase, state);
        logInfo("Available event types stored successfully");

        // Auto-create webhook subscription
        try {
          const webhookUrl = `${SUPABASE_URL}/functions/v1/calendly-integrations/webhook`;
          await createWebhookSubscription(serviceSupabase, state, webhookUrl);
          logInfo("Webhook subscription created automatically");
        } catch (webhookError) {
          logError("Failed to create webhook subscription automatically", webhookError);
          // Don't fail the OAuth flow if webhook creation fails
        }

        // Redirect to frontend with success
        const frontendUrl = `http://localhost:3000/onboarding?calendly_status=success&integration_id=${integration.id}`; //`${FRONTEND_URL}/onboarding?calendly_status=success&integration_id=${integration.id}`;

        return new Response(null, {
          status: 302,
          headers: {
            ...defaultCorsHeaders,
            Location: frontendUrl,
          },
        });
      } catch (error) {
        logError("OAuth callback error", error);
        // Redirect to frontend with error
        const frontendUrl = `${FRONTEND_URL}/onboarding?calendly_status=error&error=${encodeURIComponent(error.message)}`;

        return new Response(null, {
          status: 302,
          headers: {
            ...defaultCorsHeaders,
            Location: frontendUrl,
          },
        });
      }
    }

    // Handle getting available event types for selection
    if (method === "GET" && url.pathname.includes("/event-types")) {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return createErrorResponse("clinic_id parameter is required", 400);

      try {
        const integration = await getClinicIntegration(supabase, clinic_id);

        // Return stored event types if available, otherwise fetch fresh ones
        let eventTypes = integration.available_event_types || [];
        if (eventTypes.length === 0) {
          const userUri = integration.configuration?.user_uri;
          eventTypes = await getEventTypes(integration.access_token, userUri);
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              event_types: eventTypes.map(et => ({
                uri: et.uri,
                name: et.name,
                scheduling_url: et.scheduling_url,
                duration: et.duration,
                active: et.active,
                kind: et.kind,
              })),
            },
          }),
          { status: 200, headers: { ...defaultCorsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        return createErrorResponse("Failed to get event types", 500, error.message);
      }
    }

    // Handle saving selected event type for clinic
    if (method === "POST" && url.pathname.includes("/save-event-type")) {
      const { clinic_id, selected_event_type_uri, clinic_timing } = await request.json();

      if (!clinic_id || !selected_event_type_uri) {
        return createErrorResponse("clinic_id and selected_event_type_uri are required", 400);
      }

      if (clinic_timing) {
        const validation = validateClinicTiming({ ...clinic_timing, clinic_id });
        if (!validation.valid) {
          return createErrorResponse("Invalid clinic timing", 400, { errors: validation.errors });
        }
      }

      try {
        const selectedEventType = await saveSelectedEventType(supabase, clinic_id, selected_event_type_uri, clinic_timing);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Calendly event type saved successfully",
            data: {
              clinic_calendly_link: selectedEventType.scheduling_url,
              selected_event_type: {
                name: selectedEventType.name,
                duration: selectedEventType.duration,
                scheduling_url: selectedEventType.scheduling_url,
                uri: selectedEventType.uri,
              },
            },
          }),
          { status: 200, headers: { ...defaultCorsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        return createErrorResponse("Failed to save event type", 500, error.message);
      }
    }

    // Handle getting clinic's Calendly status
    if (method === "GET" && url.pathname.includes("/status")) {
      const clinic_id = url.searchParams.get("clinic_id");
      if (!clinic_id) return createErrorResponse("clinic_id parameter is required", 400);

      try {
        const status = await getIntegrationStatus(supabase, clinic_id);
        return new Response(JSON.stringify({ success: true, data: status }), {
          status: 200,
          headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        return createErrorResponse("Failed to get integration status", 500, error.message);
      }
    }

    // Handle webhook
    if (method === "POST" && url.pathname.includes("/webhook")) {
      try {
        const webhookData = await request.json();
        logInfo("Calendly webhook received", { event: webhookData.event });

        const result = await handleCalendlyWebhook(webhookData, supabase);
        return new Response(JSON.stringify({ success: true, message: "Webhook processed", result }), {
          status: 200,
          headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        logError("Webhook processing error", error);
        return createErrorResponse("Failed to process webhook", 500, error.message);
      }
    }

    // Handle manual webhook creation
    if (method === "POST" && url.pathname.includes("/create-webhook")) {
      const { clinic_id } = await request.json();
      if (!clinic_id) return createErrorResponse("clinic_id is required", 400);

      try {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/calendly-integrations/webhook`;
        const webhook = await createWebhookSubscription(supabase, clinic_id, webhookUrl);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook subscription created successfully",
            data: {
              webhook_uri: webhook.uri,
              events: webhook.events,
              callback_url: webhook.callback_url,
            },
          }),
          {
            status: 200,
            headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        return createErrorResponse("Failed to create webhook subscription", 500, error.message);
      }
    }

    // Handle webhook deletion
    if (method === "DELETE" && url.pathname.includes("/delete-webhook")) {
      const { clinic_id } = await request.json();
      if (!clinic_id) return createErrorResponse("clinic_id is required", 400);

      try {
        await deleteWebhookSubscription(supabase, clinic_id);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook subscription deleted successfully",
          }),
          {
            status: 200,
            headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        return createErrorResponse("Failed to delete webhook subscription", 500, error.message);
      }
    }

    // Handle disconnect
    if (method === "DELETE" && url.pathname.includes("/disconnect")) {
      const { clinic_id } = await request.json();
      if (!clinic_id) return createErrorResponse("clinic_id is required", 400);

      try {
        // Delete webhook subscription first
        try {
          await deleteWebhookSubscription(supabase, clinic_id);
          logInfo("Webhook subscription deleted as part of disconnect");
        } catch (webhookError) {
          logError("Failed to delete webhook during disconnect", webhookError);
          // Continue with disconnect even if webhook deletion fails
        }

        await disconnectIntegration(supabase, clinic_id);
        return new Response(JSON.stringify({ success: true, message: "Calendly integration disconnected successfully" }), {
          status: 200,
          headers: { ...defaultCorsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        return createErrorResponse("Failed to disconnect integration", 500, error.message);
      }
    }

    return createErrorResponse("Invalid endpoint", 404);
  } catch (error) {
    return createErrorResponse("Internal server error", 500, error.message);
  }
}

// Deno serve handler
Deno.serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: defaultCorsHeaders });
  }

  return handleRequest(request);
});
