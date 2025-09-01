import { createClient } from "@/utils/supabase/config/client";
import { ErrorToast } from "@/helpers/toast";
import { ConnectionStatus } from "@/app/types/types";

const supabase = createClient();

export const updateIntegrationConnectionStatus = async (clinicId: string, integrationName: string): Promise<ConnectionStatus> => {
  try {
    // Check if we have this specific integration for this clinic
    const { data: connection, error: fetchError } = await supabase
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

    if (fetchError) {
      console.error(`Error checking ${integrationName} status:`, fetchError);
    //   ErrorToast(`Failed to check ${integrationName} connection status`);
      return "disconnected";
    }

    // No connection found
    if (!connection) {
      return "disconnected";
    }

    // Determine current status based on expiration
    const isExpired = connection.expires_at && new Date() > new Date(connection.expires_at);
    const currentStatus: ConnectionStatus = isExpired ? "disconnected" : "connected";


    return currentStatus;
  } catch (error) {
    console.error(`Failed to check ${integrationName} status:`, error);
    ErrorToast(`Failed to check ${integrationName} connection status`);
    return "disconnected";
  }
};
