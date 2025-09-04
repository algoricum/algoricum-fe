import { ConnectionStatus } from "@/app/types/types";
import { ErrorToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

export const updateIntegrationConnectionStatus = async (clinicId: string, integrationName: string): Promise<ConnectionStatus> => {
  try {
    let connection: any = null;

    switch (integrationName) {
      case "Hubspot": {
        const { data, error } = await supabase
          .from("hubspot_connections")
          .select("*")
          .eq("user_id", clinicId) // ⚠️ if this should be clinic_id, adjust here
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error(`Error checking Hubspot status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      case "Pipedrive": {
        const { data, error } = await supabase.from("pipedrive_integration").select("*").eq("clinic_id", clinicId).maybeSingle();
        if (error) {
          console.error(`Error checking Pipedrive status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      case "Google Lead Forms": {
        const { data, error } = await supabase.from("google_lead_form_connections").select("*").eq("clinic_id", clinicId).maybeSingle();
        if (error) {
          console.error(`Error checking Google Lead Forms status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      case "Google Forms": {
        const { data, error } = await supabase.from("google_form_connections").select("*").eq("clinic_id", clinicId).limit(1).maybeSingle();
        if (error) {
          console.error(`Error checking Google Forms status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      case "Facebook Lead Forms": {
        const { data, error } = await supabase
          .from("facebook_lead_form_connections")
          .select("*")
          .eq("clinic_id", clinicId)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(`Error checking Facebook Lead Forms status:`, error);
          return "disconnected";
        }
        connection = data;
        break;
      }

      default: {
        // Fallback: check integration_connections
        const { data, error } = await supabase
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
          .eq("integrations.name", integrationName)
          .maybeSingle();

        if (error) {
          console.error(`Error checking ${integrationName} status:`, error);
          return "disconnected";
        }

        // determine connected/disconnected with expires_at
        if (data) {
          const isExpired = data.expires_at && new Date() > new Date(data.expires_at);
          return isExpired ? "disconnected" : "connected";
        } else {
          return "disconnected";
        }
      }
    }

    // For the special-case integrations: row existence = connected
    return connection ? "connected" : "disconnected";
  } catch (error) {
    console.error(`Failed to check ${integrationName} status:`, error);
    return "disconnected";
  }
};

export const deleteIntegrationConnections = async (clinicId: string, integrationName: string): Promise<boolean> => {
  try {
    let error = null;

    switch (integrationName) {
      case "Hubspot": {
        const { error: deleteError } = await supabase.from("hubspot_connections").delete().eq("user_id", clinicId); // ⚠️ change to clinic_id if schema uses that
        error = deleteError;
        break;
      }

      case "Pipedrive": {
        const { error: deleteError } = await supabase.from("pipedrive_integration").delete().eq("clinic_id", clinicId);
        error = deleteError;
        break;
      }

      case "Google Lead Forms": {
        const { error: deleteError } = await supabase.from("google_lead_form_connections").delete().eq("clinic_id", clinicId);
        error = deleteError;
        break;
      }

      case "Google Forms": {
        const { data: connection } = await supabase
          .from("google_form_connections")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (!connection) return true;
        const { error: deleteError } = await supabase.from("google_form_sheets").delete().eq("connection_id", connection?.id);

        const { error: deletedError } = await supabase.from("google_form_connections").delete().eq("id", connection?.id);

        error = deleteError || deletedError;
        break;
      }

      case "Facebook Lead Forms": {
        const { error: deleteError } = await supabase.from("facebook_lead_form_connections").delete().eq("clinic_id", clinicId);
        error = deleteError;
        break;
      }

      default: {
        const { data: integration } = await supabase.from("integrations").select("*").eq("name", integrationName).single();
        const { error: deleteError } = await supabase
          .from("integration_connections")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("integration_id", integration.id);
        error = deleteError;
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
