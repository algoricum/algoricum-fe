import { ConnectionStatus } from "@/app/types/types";
import { ErrorToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

// Helper function for querying integration_connections table
async function queryIntegrationConnection(clinicId: string, integrationName: string, includeStatus = true) {
  console.log(`[INTEGRATION_STATUS] Checking ${integrationName} for clinic: ${clinicId}`);

  let query = supabase
    .from("integration_connections")
    .select(
      `
      *,
      integrations!inner(
        name,
        type,
        auth_type
      )
    `,
    )
    .eq("clinic_id", clinicId)
    .eq("integrations.name", integrationName);

  if (includeStatus) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query.maybeSingle();

  console.log(`[INTEGRATION_STATUS] ${integrationName} query result:`, { data, error });

  if (error) {
    console.error(`Error checking ${integrationName} status:`, error);
    return null;
  }

  return data;
}

// Helper function for deleting integration connections
async function deleteIntegrationConnectionByName(clinicId: string, integrationName: string) {
  const { data: integration } = await supabase.from("integrations").select("id").eq("name", integrationName).single();

  if (integration) {
    const { error: deleteError } = await supabase
      .from("integration_connections")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("integration_id", integration.id);
    return deleteError;
  }
  return null;
}

// Helper function for OAuth callback handling
export function createOAuthCallbackHandler(
  integrationName: string,
  statusParamName: string,
  updateIntegrationStatus: (name: any, status: ConnectionStatus) => void,
  showSuccessToast?: (message: string) => void,
  showErrorToast?: (message: string) => void,
) {
  return (urlParams: URLSearchParams, contactCount?: string, errorMessage?: string) => {
    const status = urlParams.get(statusParamName);

    if (status === "success") {
      console.log(`✅ ${integrationName} OAuth success detected from URL`);
      updateIntegrationStatus(integrationName, "connected");

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      // Show success message
      if (showSuccessToast) {
        const message = `Successfully connected to ${integrationName}!${contactCount ? ` ${contactCount} contacts synced.` : ""}`;
        showSuccessToast(message);
      }
    } else if (status === "error") {
      console.log(`❌ ${integrationName} OAuth error detected from URL:`, errorMessage);
      updateIntegrationStatus(integrationName, "disconnected");
      window.history.replaceState({}, document.title, window.location.pathname);

      if (showErrorToast) {
        showErrorToast(`Failed to connect to ${integrationName}: ${errorMessage || "Unknown error"}`);
      }
    }

    return status; // Return status for further processing if needed
  };
}

export const updateIntegrationConnectionStatus = async (clinicId: string, integrationName: string): Promise<ConnectionStatus> => {
  try {
    let connection: any = null;

    switch (integrationName) {
      case "Hubspot": {
        connection = await queryIntegrationConnection(clinicId, "Hubspot");
        if (!connection) return "disconnected";
        break;
      }

      case "Pipedrive": {
        const { data, error } = await supabase
          .from("pipedrive_integration")
          .select("*")
          .eq("clinic_id", clinicId)
          .neq("access_token", "")
          .neq("refresh_token", "")
          .eq("is_active", true)
          .maybeSingle();
        if (error) {
          console.error(`Error checking Pipedrive status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      case "Google Lead Forms": {
        connection = await queryIntegrationConnection(clinicId, "Google Lead Forms");
        if (!connection) return "disconnected";
        break;
      }

      case "Google Forms": {
        connection = await queryIntegrationConnection(clinicId, "Google Forms");
        if (!connection) return "disconnected";
        break;
      }

      case "Facebook Lead Forms": {
        // Check for actual active form connections first
        const { data: activeConnection, error: activeError } = await supabase
          .from("facebook_lead_form_connections")
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("sync_status", "active")
          .neq("lead_form_id", "pending_selection")
          .limit(1)
          .maybeSingle();

        if (activeError) {
          console.error(`Error checking Facebook Lead Forms active status:`, activeError);
          return "disconnected";
        }

        // If there are active connections, return connected
        if (activeConnection) {
          connection = activeConnection;
          break;
        }

        // Check for pending setup (OAuth completed but forms not selected)
        const { data: pendingConnection, error: pendingError } = await supabase
          .from("facebook_lead_form_connections")
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("lead_form_id", "pending_selection")
          .limit(1)
          .maybeSingle();

        if (pendingError) {
          console.error(`Error checking Facebook Lead Forms pending status:`, pendingError);
          return "disconnected";
        }

        // If there's a pending connection, consider it "connected" so user can select forms
        connection = pendingConnection;
        break;
      }

      default: {
        // Fallback: check integration_connections
        connection = await queryIntegrationConnection(clinicId, integrationName, false);
        if (connection) {
          return "connected";
        } else {
          return "disconnected";
        }
      }
    }

    // For the special-case integrations: return connected if we have a connection
    if (connection) {
      return "connected";
    } else {
      return "disconnected";
    }
  } catch (error) {
    console.error(`Failed to check ${integrationName} status:`, error);
    return "disconnected";
  }
};

// Helper function for Supabase Edge Function calls
export const callSupabaseFunction = async (
  endpoint: string,
  payload: Record<string, any>,
  supabaseUrl: string,
  supabaseAnonKey: string,
) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
};

export const deleteIntegrationConnections = async (clinicId: string, integrationName: string): Promise<boolean> => {
  try {
    let error = null;

    switch (integrationName) {
      case "Hubspot": {
        error = await deleteIntegrationConnectionByName(clinicId, "HubSpot");
        break;
      }

      case "Pipedrive": {
        const { error: deleteError } = await supabase.from("pipedrive_integration").delete().eq("clinic_id", clinicId);
        error = deleteError;
        break;
      }

      case "Google Lead Forms": {
        error = await deleteIntegrationConnectionByName(clinicId, "Google Lead Forms");
        break;
      }

      case "Google Forms": {
        // First get the Google Forms integration ID
        const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Google Forms").single();
        if (integration) {
          // Get the integration connection
          const { data: integrationConnection } = await supabase
            .from("integration_connections")
            .select("id")
            .eq("clinic_id", clinicId)
            .eq("integration_id", integration.id)
            .single();

          if (integrationConnection) {
            // Delete associated sheets first
            const { error: sheetsDeleteError } = await supabase
              .from("google_form_sheets")
              .delete()
              .eq("connection_id", integrationConnection.id);

            // Delete the integration connection
            const { error: connectionDeleteError } = await supabase
              .from("integration_connections")
              .delete()
              .eq("id", integrationConnection.id);

            error = sheetsDeleteError || connectionDeleteError;
          }
        }
        break;
      }

      case "Facebook Lead Forms": {
        const { error: deleteError } = await supabase.from("facebook_lead_form_connections").delete().eq("clinic_id", clinicId);
        error = deleteError;
        break;
      }

      default: {
        error = await deleteIntegrationConnectionByName(clinicId, integrationName);
        break;
      }
    }

    if (error) {
      console.error(`Error deleting ${integrationName} connections:`, error);
      ErrorToast(`Failed to delete ${integrationName} connections`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Unexpected error deleting ${integrationName} connections:`, err);
    ErrorToast(`Unexpected error deleting ${integrationName} connections`);
    return false;
  }
};
