import { type JSX } from "react";

// Lead types
export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  date: string;
  source_id: string | null;
  sourceName: string | null;
};

export type LeadMetrics = {
  "Weekly Booked Leads Count": number;
  "Weekly New Leads Count": number;
  "Weekly Engaged Leads Count": number;
  "Weekly Closed Leads Count": number;
  "Newly Created Leads Count (Last 24 Hours)": number;
  "All Leads Count Per Source": { source_name: string; count: number }[];
};

// Task types
export interface Task {
  id: string;
  task: string;
  priority: "low" | "medium" | "high";
  time?: string;
  completed: boolean;
  due_at?: string;
  clinic_id: string;
}

// Integration types
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

// Stats types
export type Stats = {
  totalLeads: { thisMonth: number; lastMonth: number; change: number };
  appointments: { thisMonth: number; lastMonth: number; change: number };
  conversionRate: { thisMonth: number; lastMonth: number; change: number };
};

export interface StatsGridProps {
  clinicId: string;
  leadsData: LeadRow[];
}

export interface StatCardProps {
  icon: JSX.Element;
  title: string;
  value: number | string;
  change: number;
  bg: string;
}

// Activity types
export interface AiActivityLogProps {
  clinicId: string;
}

// Dashboard page types
export const APPOINTMENT_FILTERS = ["today", "week", "month", "year"] as const;
export type AppointmentFilter = (typeof APPOINTMENT_FILTERS)[number];

export interface IntegrationBannersProps {
  showCsvBanner: boolean;
  onCsvUpload: () => void;
  onTrainChatbot: () => void;
  clinicData: any;
  twilioPhoneNumber: string;
}

// Constants
export const LOADING_DELAY = 800;

// StatsGrid constants
export const SKELETON_COUNT = 4;
export const LEAD_STATUS = {
  BOOKED: "Booked",
} as const;

// TodayTasks constants
export const SPECIAL_TASK_IDS = {
  ADD_INTEGRATIONS: "add-integrations",
} as const;

export const TASK_STYLES = {
  INTEGRATION: {
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    cursor: "cursor-default",
  },
  COMPLETED: {
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    cursor: "hover:bg-gray-100 transition-colors cursor-pointer",
  },
  PENDING: {
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    cursor: "hover:bg-gray-100 transition-colors cursor-pointer",
  },
} as const;

// AiActivityLogs constants
export const METRIC_CONFIG = [
  {
    key: "Weekly Booked Leads Count" as keyof LeadMetrics,
    title: "Weekly Booked Leads",
    icon: "📅",
    description: "booked in the last 7 days",
  },
  {
    key: "Weekly New Leads Count" as keyof LeadMetrics,
    title: "Weekly New Leads",
    icon: "🆕",
    description: "created in the last 7 days",
  },
  {
    key: "Weekly Engaged Leads Count" as keyof LeadMetrics,
    title: "Weekly Engaged Leads",
    icon: "🤝",
    description: "engaged in the last 7 days",
  },
  {
    key: "Weekly Closed Leads Count" as keyof LeadMetrics,
    title: "Weekly Closed Leads",
    icon: "✅",
    description: "closed in the last 7 days",
  },
  {
    key: "Newly Created Leads Count (Last 24 Hours)" as keyof LeadMetrics,
    title: "Newly Created Leads (Last 24 Hours)",
    icon: "🕒",
    description: "created in the last 24 hours",
  },
] as const;
