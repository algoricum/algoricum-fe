import { ConnectionStatus } from "@/app/types/types";

// Interface for integration data from RPC
export interface IntegrationWithStatus {
  id: string;
  name: string;
  integration_type: string;
  auth_type: string;
  connected: boolean;
  connection_id?: string;
  connection_status?: string;
  auth_data?: any;
  expires_at?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
  integration_logo: string;
  description: string;
}

// Integration types for better type safety
export type IntegrationName =
  | "Facebook Lead Forms"
  | "Jotform"
  | "Google Lead Forms"
  | "Google Forms"
  | "Hubspot"
  | "GoHighLevel"
  | "Typeform"
  | "Pipedrive"
  | "Gravity Form"
  | "NextHealth"
  | "CSV Upload"
  | "Custom CRM";

// Refactored state management
export interface IntegrationStates {
  statuses: Record<IntegrationName, ConnectionStatus>;
  modals: Record<IntegrationName, boolean>;
}
