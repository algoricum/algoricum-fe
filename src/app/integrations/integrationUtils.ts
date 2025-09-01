import { createClient } from "@/utils/supabase/config/client";
import { ErrorToast } from "@/helpers/toast";
import { ConnectionStatus } from "@/app/types/types";

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
