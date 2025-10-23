// Centralized query keys for React Query
export const queryKeys = {
  // Dashboard related queries
  dashboard: {
    all: ["dashboard"] as const,
    leads: (clinicId: string) => ["dashboard", "leads", clinicId] as const,
    tasks: (clinicId: string) => ["dashboard", "tasks", clinicId] as const,
    integrations: (clinicId: string) => ["dashboard", "integrations", clinicId] as const,
    stats: (clinicId: string) => ["dashboard", "stats", clinicId] as const,
    leadMetrics: (clinicId: string) => ["dashboard", "leadMetrics", clinicId] as const,
  },

  // Clinic related queries
  clinic: {
    all: ["clinic"] as const,
    data: (clinicId?: string) => ["clinic", "data", clinicId] as const,
    twilio: (clinicId: string) => ["clinic", "twilio", clinicId] as const,
  },

  // Integration related queries
  integrations: {
    all: ["integrations"] as const,
    statuses: (clinicId: string) => ["integrations", "statuses", clinicId] as const,
    withStatus: (clinicId: string) => ["integrations", "withStatus", clinicId] as const,
    list: () => ["integrations", "list"] as const,
  },

  // User related queries
  user: {
    all: ["user"] as const,
    current: () => ["user", "current"] as const,
  },

  // Onboarding related queries
  onboarding: {
    all: ["onboarding"] as const,
    user: () => ["onboarding", "user"] as const,
    clinic: () => ["onboarding", "clinic"] as const,
    calendlyLink: (clinicId: string) => ["onboarding", "calendlyLink", clinicId] as const,
    subscription: (clinicId: string) => ["onboarding", "subscription", clinicId] as const,
  },

  // Settings related queries
  settings: {
    all: ["settings"] as const,
    clinic: () => ["settings", "clinic"] as const,
    chatbot: () => ["settings", "chatbot"] as const,
    twilioPhone: (clinicId: string) => ["settings", "twilioPhone", clinicId] as const,
  },

  // Staff related queries
  staff: {
    all: ["staff"] as const,
    list: (clinicId: string, page: number, pageSize: number) => ["staff", "list", clinicId, page, pageSize] as const,
    stats: (clinicId: string) => ["staff", "stats", clinicId] as const,
  },

  // Appointments related queries
  appointments: {
    all: ["appointments"] as const,
    list: (clinicId: string, page: number, pageSize: number) => ["appointments", "list", clinicId, page, pageSize] as const,
    stats: (clinicId: string) => ["appointments", "stats", clinicId] as const,
    byId: (appointmentId: string) => ["appointments", "byId", appointmentId] as const,
  },
} as const;
