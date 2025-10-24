import { ConnectionStatus } from "@/app/types/types";
import { ErrorToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

// Helper function for querying integration_connections table
async function queryIntegrationConnection(clinicId: string, integrationName: string, includeStatus = true) {
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
      updateIntegrationStatus(integrationName, "connected");

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      // Show success message
      if (showSuccessToast) {
        const message = `Successfully connected to ${integrationName}!${contactCount ? ` ${contactCount} contacts synced.` : ""}`;
        showSuccessToast(message);
      }
    } else if (status === "error") {
      console.error(`❌ ${integrationName} OAuth error detected from URL:`, errorMessage);
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
        connection = await queryIntegrationConnection(clinicId, "Pipedrive");
        if (!connection) return "disconnected";
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
        // Use the standard integration_connections table for Facebook Lead Forms
        connection = await queryIntegrationConnection(clinicId, "Facebook Lead Forms", false);

        if (connection) {
          // Check if there are active form connections
          const authData = connection.auth_data;

          // Check if we have selected forms in the new structure
          if (authData?.selected_forms && Array.isArray(authData.selected_forms)) {
            const hasActiveForms = authData.selected_forms.some((form: any) => form.status === "active");
            if (hasActiveForms) {
              return "connected";
            }
          }

          // Check for legacy single form structure (backward compatibility)
          if (authData?.sync_status === "active" && authData?.lead_form_id && authData.lead_form_id !== "pending_selection") {
            return "connected";
          }

          // If we have auth_data with pending selection, still consider connected (user can select forms)
          if (authData?.lead_form_id === "pending_selection") {
            return "connected";
          }

          // If there's a connection but no proper auth_data, consider connected for backward compatibility
          return "connected";
        }

        return "disconnected";
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
        error = await deleteIntegrationConnectionByName(clinicId, "Pipedrive");
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
        // Use the standard deletion method for Facebook Lead Forms
        error = await deleteIntegrationConnectionByName(clinicId, "Facebook Lead Forms");
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

// Fetch all integration statuses for a clinic in a single call
export const getAllIntegrationStatuses = async (clinicId: string): Promise<Record<string, ConnectionStatus>> => {
  try {
    const statusMap: Record<string, ConnectionStatus> = {};

    // Get all integration connections for this clinic
    const { data: integrationConnections, error: connectionsError } = await supabase
      .from("integration_connections")
      .select(
        `
        *,
        integrations!inner(name, type, auth_type)
      `,
      )
      .eq("clinic_id", clinicId)
      .eq("status", "active");

    if (connectionsError) {
      console.error("Error fetching integration connections:", connectionsError);
    }

    // Set connected status for active integrations
    integrationConnections?.forEach(connection => {
      statusMap[connection.integrations.name] = "connected";
    });

    // Check special cases for integrations with custom tables

    // Pipedrive is already handled by the main integration_connections query above
    // No special handling needed since it now uses the standard table

    // Facebook Lead Forms is now handled by the main integration_connections query
    // No special handling needed since it now uses the standard table

    // Default to disconnected for any integration not found
    const allIntegrationNames = [
      "Hubspot",
      "Pipedrive",
      "Google Lead Forms",
      "Google Forms",
      "Facebook Lead Forms",
      "Jotform",
      "Typeform",
      "Gravity Form",
      "GoHighLevel",
      "NexHealth",
      "Custom CRM",
      "CSV Upload",
    ];

    allIntegrationNames.forEach(name => {
      if (!statusMap[name]) {
        statusMap[name] = "disconnected";
      }
    });

    return statusMap;
  } catch (error) {
    console.error("Error getting all integration statuses:", error);
    // Return disconnected status for all integrations on error
    return {
      Hubspot: "disconnected",
      Pipedrive: "disconnected",
      "Google Lead Forms": "disconnected",
      "Google Forms": "disconnected",
      "Facebook Lead Forms": "disconnected",
      Jotform: "disconnected",
      Typeform: "disconnected",
      "Gravity Form": "disconnected",
      GoHighLevel: "disconnected",
      NexHealth: "disconnected",
      "Custom CRM": "disconnected",
      "CSV Upload": "disconnected",
    };
  }
};
