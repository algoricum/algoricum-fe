import { LeadMetrics, LeadRow } from "@/app/dashboard/types";
import { getAllIntegrationStatuses } from "@/app/integrations/integrationUtils";
import { getRoleId } from "@/redux/slices/clinic.slice";
import apiKeyService from "@/services/apiKey";
import { appointmentHelper, type UpdateMeetingRequest } from "@/utils/appointment-helper";
import { checkClinicSubscription, shouldAllowTwilioSetup } from "@/utils/subscription-utils";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { getClincApiKey, getClinicData, updateClinic, updateMailgunDomainSettings } from "@/utils/supabase/clinic-helper";
import {
  deleteStaffMember,
  getClinicStaff,
  getStatusStats,
  updateStaffMember,
  type UpdateStaffData,
} from "@/utils/supabase/clinic-staff-helper";
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads";
import { createClient } from "@/utils/supabase/config/client";
import { createStaffUser } from "@/utils/supabase/config/staff";
import {
  fetchLeadsForClinic,
  fetchMessagesForLead,
  getCurrentUserClinic,
  getStatusStats as getLeadStatusStats,
  sendMessageToLead,
  updateLeadStatus,
} from "@/utils/supabase/leads-helper";
import { getUserData } from "@/utils/supabase/user-helper";
import dayjs from "dayjs";

const supabase = createClient();

// Dashboard query functions
export const dashboardQueries = {
  // Fetch leads data
  fetchLeads: async (clinicId: string): Promise<LeadRow[]> => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data, error } = await supabase
      .from("lead")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        created_at,
        source_id:source_id(id),
        source:source_id(name)
      `,
      )
      .eq("clinic_id", clinicId);

    if (error) throw error;

    return (
      data?.map((lead: any) => ({
        id: lead.id,
        name: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim(),
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        date: lead.created_at,
        source_id: lead.source_id ?? "Unknown",
        sourceName: lead.source ?? "Unknown",
      })) ?? []
    );
  },

  // Fetch today's tasks
  fetchTasks: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const start = dayjs().startOf("day").toISOString();
    const end = dayjs().endOf("day").toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("due_at", start)
      .lte("due_at", end)
      .order("due_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  // Fetch integration statuses
  fetchIntegrationStatuses: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");
    return await getAllIntegrationStatuses(clinicId);
  },

  // Fetch lead metrics for AI activity log
  fetchLeadMetrics: async (clinicId: string): Promise<LeadMetrics> => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data, error } = await supabase.rpc("get_lead_metrics", {
      p_clinic_id: clinicId,
    });

    if (error) throw error;
    return data as LeadMetrics;
  },
};

// Clinic query functions
export const clinicQueries = {
  // Fetch clinic data
  fetchClinicData: async () => {
    const data = await getClinicData();
    if (!data?.id) throw new Error("Clinic data not found");
    return data;
  },

  // Fetch Twilio configuration
  fetchTwilioConfig: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data, error } = await supabase.from("twilio_config").select("twilio_phone_number").eq("clinic_id", clinicId).single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
    return data?.twilio_phone_number || "";
  },
};

// Integration query functions
export const integrationQueries = {
  // Fetch all integrations with status
  fetchIntegrationsWithStatus: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    // Fetch all integrations from master table
    const { data: allIntegrations, error } = await supabase.from("integrations").select("*");

    if (error) throw error;

    // Get connection statuses for all integrations
    const allStatuses = await getAllIntegrationStatuses(clinicId);

    // Merge statuses with integrations
    const integrationsWithStatus = allIntegrations.map(int => ({
      ...int,
      connected: allStatuses[int.name] === "connected",
    }));

    return {
      integrations: integrationsWithStatus,
      statuses: allStatuses,
    };
  },

  // Fetch all integrations
  fetchAllIntegrations: async () => {
    const { data, error } = await supabase.from("integrations").select("*");

    if (error) throw error;
    return data ?? [];
  },
};

// Onboarding query functions
export const onboardingQueries = {
  // Fetch user data for onboarding
  fetchUserData: async () => {
    const user = await getUserData();
    if (!user) throw new Error("User not found");
    return user;
  },

  // Fetch clinic data for onboarding
  fetchClinicData: async () => {
    const clinic = await getClinicData();
    if (!clinic?.id) throw new Error("No clinic found for user");
    return clinic;
  },

  // Fetch Calendly booking link
  fetchCalendlyLink: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data, error } = await supabase
      .from("calendly_integrations")
      .select("clinic_booking_link")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data?.clinic_booking_link || null;
  },

  // Check subscription status for Twilio setup
  fetchSubscriptionStatus: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const subscriptionInfo = await checkClinicSubscription(clinicId);
    return {
      canSetupTwilio: shouldAllowTwilioSetup(subscriptionInfo),
      subscriptionInfo,
    };
  },
};

// Onboarding mutation functions
export const onboardingMutations = {
  // Update clinic data
  updateClinic: async (clinicData: any) => {
    return await updateClinic(clinicData);
  },

  // Setup Mailgun domain
  setupMailgunDomain: async (params: { clinicData: any; formData: any; slug: string }) => {
    const { clinicData, formData, slug } = params;

    if (!clinicData?.id || !slug) {
      throw new Error("Missing required parameters for Mailgun setup");
    }

    const requestPayload = {
      ...formData,
      clinicId: clinicData.id,
      slug: slug,
    };

    const response = await fetch("/api/mailgun-setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  },

  // Update Mailgun domain settings
  updateMailgunSettings: async (params: { clinicId: string; domain: string; email: string }) => {
    return await updateMailgunDomainSettings(params.clinicId, {
      domain: params.domain,
      email: params.email,
    });
  },

  // Create API key
  createApiKey: async (params: { name: string; clinicId: string }) => {
    return await apiKeyService.create(params);
  },

  // Setup Twilio
  setupTwilio: async (params: { clinicId: string; phoneNumber: string; clinicName: string }) => {
    const session = await getSupabaseSession();
    if (!session.access_token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twillio-setup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clinic_id: params.clinicId,
        phone_number: params.phoneNumber,
        name: params.clinicName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Twilio setup failed");
    }

    return result;
  },

  // Create assistant with documents
  createAssistantWithDocuments: async (formData: FormData) => {
    const session = await getSupabaseSession();
    if (!session.access_token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Assistant creation failed");
    }

    return result;
  },

  // Send confirmation email
  sendConfirmationEmail: async (params: { name: string; email: string }) => {
    const response = await fetch("/api/sendConfiramtionMail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error("Failed to send confirmation email");
    }

    return await response.json();
  },
};

// Settings query functions
export const settingsQueries = {
  // Fetch clinic settings data
  fetchClinicSettings: async () => {
    const data = await getClinicData();
    if (!data?.id) throw new Error("Clinic data not found");

    // If clinic has a logo, get the public URL
    if (data.logo) {
      const { data: publicUrlData } = supabase.storage.from("clinic-logos").getPublicUrl(data.logo);

      return {
        ...data,
        logoUrl: publicUrlData.publicUrl,
      };
    }

    return data;
  },

  // Fetch Twilio phone number for clinic
  fetchTwilioPhoneNumber: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data, error } = await supabase.from("twilio_config").select("twilio_phone_number").eq("clinic_id", clinicId).single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows returned
    return data?.twilio_phone_number || "";
  },

  // Fetch chatbot settings (API key, clinic data, user data)
  fetchChatbotSettings: async () => {
    const [clinicData, userData] = await Promise.all([getClinicData(), getUserData()]);

    if (!clinicData?.id) throw new Error("Clinic data not found");
    if (!userData) throw new Error("User data not found");

    // Fetch API key
    const apiKey = await getClincApiKey(clinicData.id);

    return {
      clinic: clinicData,
      user: userData,
      apiKey,
    };
  },
};

// Settings mutation functions
export const settingsMutations = {
  // Update clinic settings
  updateClinicSettings: async (clinicData: any) => {
    return await updateClinic(clinicData);
  },

  // Upload clinic logo
  uploadClinicLogo: async (params: { file: File; userId: string }) => {
    const { file, userId } = params;
    return await uploadClinicLogo(userId, file);
  },

  // Update clinic with logo
  updateClinicWithLogo: async (params: { clinicData: any; logoPath?: string }) => {
    const { clinicData, logoPath } = params;

    const updateData = logoPath ? { ...clinicData, logo: logoPath } : clinicData;

    return await updateClinic(updateData);
  },
};

// Staff query functions
export const staffQueries = {
  // Fetch staff list with pagination
  fetchStaffList: async (params: { clinicId: string; page: number; pageSize: number }) => {
    const { clinicId, page, pageSize } = params;
    if (!clinicId) throw new Error("Clinic ID is required");

    return await getClinicStaff(page, pageSize, clinicId);
  },

  // Fetch staff status statistics
  fetchStaffStats: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    return await getStatusStats(clinicId);
  },

  // Get current user's clinic ID
  fetchCurrentUserClinic: async () => {
    const clinicId = await getCurrentUserClinic();
    if (!clinicId) throw new Error("No clinic found for current user");
    return clinicId;
  },
};

// Staff mutation functions
export const staffMutations = {
  // Create new staff member
  createStaff: async (params: { email: string; name: string; clinicId: string }) => {
    const { email, name, clinicId } = params;

    // Get role ID for receptionist
    const roleId = await getRoleId("receptionist");
    if (!roleId) {
      throw new Error("No role found. Please make sure roles are set up correctly.");
    }

    return await createStaffUser({
      email,
      name,
      clinicId,
      roleId,
    });
  },

  // Update staff member
  updateStaff: async (params: { userId: string; clinicId: string; updateData: UpdateStaffData }) => {
    const { userId, clinicId, updateData } = params;
    return await updateStaffMember(userId, clinicId, updateData);
  },

  // Delete staff member
  deleteStaff: async (params: { userId: string; clinicId: string }) => {
    const { userId, clinicId } = params;
    return await deleteStaffMember(userId, clinicId);
  },
};

// Appointments query functions
export const appointmentsQueries = {
  // Fetch appointments list with pagination
  fetchAppointmentsList: async (params: { clinicId: string; page: number; pageSize: number }) => {
    const { clinicId, page, pageSize } = params;
    if (!clinicId) throw new Error("Clinic ID is required");

    // Use Supabase directly for pagination as appointmentHelper doesn't have this method
    const {
      data: meetings,
      error,
      count,
    } = await supabase
      .from("meeting_schedule")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return {
      data: meetings || [],
      total: count || 0,
    };
  },

  // Fetch appointment statistics
  fetchAppointmentStats: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    return await appointmentHelper.getStatusStats(clinicId);
  },

  // Get current user's clinic ID
  fetchCurrentUserClinic: async () => {
    const clinicId = await getCurrentUserClinic();
    if (!clinicId) throw new Error("No clinic found for current user");
    return clinicId;
  },
};

// Appointments mutation functions
export const appointmentsMutations = {
  // Create new appointment
  createAppointment: async (params: { appointmentData: any; clinicId: string }) => {
    const { appointmentData, clinicId } = params;

    // Build full datetime
    let fullDateTime = null;
    if (appointmentData.preferred_meeting_date && appointmentData.preferred_meeting_time) {
      const date = dayjs(appointmentData.preferred_meeting_date).format("YYYY-MM-DD");
      const time = dayjs(appointmentData.preferred_meeting_time).format("HH:mm:ss");
      fullDateTime = `${date} ${time}`;
    }

    // Create appointment
    const { error } = await supabase.from("meeting_schedule").upsert(
      [
        {
          username: `${appointmentData.first_name} ${appointmentData.last_name}`.trim(),
          email: appointmentData.email,
          phone_number: appointmentData.phone_number,
          preferred_meeting_time: fullDateTime,
          meeting_notes: appointmentData.meeting_notes || null,
          clinic_id: clinicId,
        },
      ],
      { onConflict: "email" },
    );

    if (error) {
      if (error.code === "23505") {
        throw new Error("This email is already registered for a meeting");
      }
      throw error;
    }

    // Create corresponding lead
    const { data: leadSourceData, error: leadSourceError } = await supabase.from("lead_source").select("id").eq("name", "Others").single();

    const { error: leadError } = await supabase.from("lead").upsert(
      [
        {
          first_name: appointmentData.first_name.trim(),
          last_name: appointmentData.last_name.trim(),
          email: appointmentData.email,
          phone: appointmentData.phone_number,
          status: "Booked",
          interest_level: "medium",
          clinic_id: clinicId,
          source_id: leadSourceData?.id,
        },
      ],
      { onConflict: "email,clinic_id" },
    );

    if (leadError || leadSourceError) {
      throw leadError || leadSourceError;
    }

    return { success: true };
  },

  // Update appointment
  updateAppointment: async (params: { appointmentId: string; updateData: UpdateMeetingRequest }) => {
    const { appointmentId, updateData } = params;
    return await appointmentHelper.updateMeeting(appointmentId, updateData);
  },

  // Delete appointment
  deleteAppointment: async (appointmentId: string) => {
    return await appointmentHelper.deleteMeeting(appointmentId);
  },
};

// Leads query functions
export const leadsQueries = {
  // Fetch leads list with pagination
  fetchLeadsList: async (params: { clinicId: string; page: number; pageSize: number }) => {
    const { clinicId, page, pageSize } = params;
    if (!clinicId) throw new Error("Clinic ID is required");

    return await fetchLeadsForClinic(clinicId, {
      page,
      pageSize,
      offset: (page - 1) * pageSize,
    });
  },

  // Fetch lead statistics
  fetchLeadStats: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    return await getLeadStatusStats(clinicId);
  },

  // Fetch messages for a specific lead
  fetchLeadMessages: async (params: { leadId: string; clinicId: string; threadId?: string }) => {
    const { leadId, clinicId, threadId } = params;
    if (!leadId || !clinicId) throw new Error("Lead ID and Clinic ID are required");

    return await fetchMessagesForLead(leadId, clinicId, threadId);
  },

  // Get current user's clinic data (to match billing pattern)
  fetchCurrentUserClinic: async () => {
    const data = await getClinicData();
    if (!data?.id) throw new Error("Clinic data not found");
    return data;
  },
};

// Leads mutation functions
export const leadsMutations = {
  // Create new lead
  createLead: async (leadData: {
    clinic_id: string;
    source_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    form_data?: any;
    interest_level?: string;
    urgency?: string;
    status?: string;
  }) => {
    const { error, data } = await supabase.from("lead").insert([leadData]).select().single();

    if (error?.code === "23505") {
      throw new Error("Lead with this email already registered in this clinic");
    }

    if (error) throw error;
    return data;
  },

  // Update lead (comprehensive)
  updateLead: async (params: {
    leadId: string;
    updates: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      status?: string;
      interest_level?: string;
      urgency?: string;
      notes?: string;
    };
  }) => {
    const { leadId, updates } = params;

    const { error, data } = await supabase
      .from("lead")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update lead status
  updateLeadStatus: async (params: {
    leadId: string;
    updates: {
      status?: string;
      interest_level?: string;
      urgency?: string;
      notes?: string;
    };
  }) => {
    const { leadId, updates } = params;
    return await updateLeadStatus(leadId, updates);
  },

  // Send message to lead
  sendMessageToLead: async (params: { leadId: string; clinicId: string; content: string; isFromUser?: boolean }) => {
    const { leadId, clinicId, content, isFromUser = false } = params;
    return await sendMessageToLead(leadId, clinicId, content, isFromUser);
  },

  // Delete lead
  deleteLead: async (params: { leadId: string; clinicId: string }) => {
    const { leadId, clinicId } = params;

    // Use Supabase directly to delete the lead
    const { error } = await supabase.from("lead").delete().eq("id", leadId).eq("clinic_id", clinicId);

    if (error) throw error;

    return { success: true };
  },
};

// Billing query functions
export const billingQueries = {
  // Fetch subscription data for a clinic
  fetchSubscription: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const { data: subscription } = await supabase
      .from("stripe_subscriptions")
      .select("id, status, trial_end, stripe_price_id, current_period_end, stripe_subscription_id, last4, exp_month, exp_year, brand")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return subscription;
  },

  // Fetch subscription events
  fetchSubscriptionEvents: async (subscriptionId: string) => {
    if (!subscriptionId) throw new Error("Subscription ID is required");

    const { data: events } = await supabase
      .from("stripe_events")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("received_at", { ascending: false });

    return events || [];
  },

  // Fetch available plans
  fetchPlans: async () => {
    const { data: planData } = await supabase.from("plans").select("*").eq("active", true).order("amount", { ascending: true });

    return planData || [];
  },

  // Fetch invoices for a clinic
  fetchInvoices: async (clinicId: string) => {
    if (!clinicId) throw new Error("Clinic ID is required");

    const session = await getSupabaseSession();

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clinic_id: clinicId }),
    });

    if (!response.ok) throw new Error("Failed to fetch invoices");

    const { invoices } = await response.json();
    return invoices || [];
  },

  // Get current user's clinic data
  fetchCurrentUserClinic: async () => {
    const data = await getClinicData();
    if (!data?.id) throw new Error("Clinic data not found");
    return data;
  },
};

// User query functions
export const userQueries = {
  // Get current authenticated user
  fetchCurrentUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
};

// Billing mutation functions
export const billingMutations = {
  // Create checkout session for subscription
  createCheckoutSession: async (params: { clinicId: string; priceId: string }) => {
    const { clinicId, priceId } = params;
    const session = await getSupabaseSession();

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        price_id: priceId,
      }),
    });

    if (!response.ok) throw new Error("Checkout session creation failed");

    const { url } = await response.json();
    return { url };
  },
};
