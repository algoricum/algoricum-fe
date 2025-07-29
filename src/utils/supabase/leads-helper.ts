// Path @utils/supabase/leads-helper.ts
import { createClient } from "./config/client";
// Updated interfaces to match our new comprehensive status system
export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string; // computed field
  email: string | null;
  phone: string | null;
  status: string; // new comprehensive statuses
  interest_level: string | null; // from new schema
  urgency: string | null; // from new schema
  source_id: string | null;
  clinic_id: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  avatar?: string; // computed field
  channel?: "chatbot" | "form" | "email"; // computed field
  lastMessage?: string; // computed field
  lastActivity?: Date; // computed field
  messages?: Message[];
  thread_id?: string; // for optimization
}

export interface Thread {
  id: string;
  lead_id: string | null;
  clinic_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  openai_thread_id: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  message: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  is_from_user: boolean | null;
  // For component compatibility
  content: string; // mapped from message
  isFromLead: boolean; // mapped from is_from_user
  leadId: string; // computed from thread
}

export interface LeadsFilters {
  status?: string;
  interest_level?: string;
  urgency?: string;
  channel?: "chatbot" | "form" | "email" | "all";
  search?: string;
}

export interface ChannelStats {
  chatbot: number;
  form: number;
  email: number;
}

// Valid status options for the new comprehensive system
export const LEAD_STATUSES = [
  "New",
  "Engaged",
  "Cold",
  "Booked",
] as const;

export const INTEREST_LEVELS = ["high", "medium", "low"] as const;
export const URGENCY_LEVELS = ["asap", "this_month", "curious"] as const;

const supabase = createClient();

// Helper function to get current user's clinic
export async function getCurrentUserClinic() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { data: userClinic, error: clinicError } = await supabase
    .from("user_clinic")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (clinicError || !userClinic) {
    throw new Error("No clinic found for user");
  }

  return userClinic.clinic_id;
}

// Helper function to determine channel based on source
function determineChannel(sourceId: string | null): "chatbot" | "form" | "email" {
  if (!sourceId) return "chatbot";
  // Add logic based on your source_id patterns
  // For now, defaulting to chatbot since most leads come from there
  return "chatbot";
}

// Helper function to generate avatar URL
function generateAvatar(name: string): string {
  const initials = name.substring(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2563eb&color=fff&size=40`;
}

// OPTIMIZED: Fetch all leads with their latest messages in fewer queries
export async function fetchLeadsForClinic(clinicId: string, filters?: LeadsFilters): Promise<Lead[]> {
  try {
    // Single query to get leads with their threads and latest messages
    let query = supabase
      .from("lead")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        interest_level,
        urgency,
        source_id,
        clinic_id,
        assigned_to,
        notes,
        created_at,
        updated_at,
        threads:threads!lead_id (
          id,
          openai_thread_id,
          updated_at,
          latest_message:conversation (
            message,
            timestamp,
            is_from_user
          )
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false });

    // Apply server-side filters
    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters?.interest_level && filters.interest_level !== "all") {
      query = query.eq("interest_level", filters.interest_level);
    }
    if (filters?.urgency && filters.urgency !== "all") {
      query = query.eq("urgency", filters.urgency);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw error;
    }

    if (!leads) {
      return [];
    }

    // Transform and enrich the leads data
    const enrichedLeads: Lead[] = leads.map((lead: any) => {
      const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Anonymous";

      // Get the latest thread and message
      const latestThread = lead.threads?.[0];
      let lastMessage = "No messages yet";
      let lastActivity = new Date(lead.updated_at);
      let thread_id = latestThread?.id;

      if (latestThread?.latest_message?.[0]) {
        const msg = latestThread.latest_message[0];
        lastMessage = msg.message;
        lastActivity = new Date(msg.timestamp);
      }

      return {
        ...lead,
        name,
        avatar: generateAvatar(name),
        channel: determineChannel(lead.source_id),
        lastMessage,
        lastActivity,
        thread_id,
        messages: [], // Will be loaded separately when needed
      };
    });

    // Apply client-side filters
    let filteredLeads = enrichedLeads;

    if (filters?.channel && filters.channel !== "all") {
      filteredLeads = filteredLeads.filter(lead => lead.channel === filters.channel);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredLeads = filteredLeads.filter(
        lead =>
          lead.name.toLowerCase().includes(searchLower) ||
          (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
          lead?.lastMessage?.toLowerCase().includes(searchLower),
      );
    }

    return filteredLeads;
  } catch (error) {
    console.error("Error fetching leads:", error);
    throw error;
  }
}

// OPTIMIZED: Fetch messages for a specific lead using existing thread_id
export async function fetchMessagesForLead(leadId: string, clinicId: string, threadId?: string): Promise<Message[]> {
  try {
    let actualThreadId = threadId;

    // Only query for thread if not provided
    if (!actualThreadId) {
      const { data: thread, error: threadError } = await supabase
        .from("threads")
        .select("id")
        .eq("lead_id", leadId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadError || !thread) {
        return [];
      }
      actualThreadId = thread.id;
    }

    // Get all messages for this thread
    const { data: messages, error: messagesError } = await supabase
      .from("conversation")
      .select("*")
      .eq("thread_id", actualThreadId)
      .order("timestamp", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    if (!messages) {
      return [];
    }

    // Transform messages to match component interface
    return messages.map(msg => ({
      ...msg,
      content: msg.message,
      isFromLead: msg.is_from_user === true,
      leadId: leadId,
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

// Send a message to a lead
export async function sendMessageToLead(leadId: string, clinicId: string, content: string, isFromUser: boolean = false): Promise<Message> {
  try {
    // Get or create thread for this lead
    let { data: thread, error: threadError } = await supabase
      .from("threads")
      .select("id")
      .eq("lead_id", leadId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (threadError && threadError.code !== "PGRST116") {
      throw threadError;
    }

    // Create thread if it doesn't exist
    if (!thread) {
      const { data: newThread, error: createThreadError } = await supabase
        .from("threads")
        .insert({
          lead_id: leadId,
          clinic_id: clinicId,
          status: "active",
        })
        .select("id")
        .single();

      if (createThreadError) {
        throw createThreadError;
      }

      thread = newThread;
    }

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from("conversation")
      .insert({
        thread_id: thread.id,
        message: content,
        timestamp: new Date().toISOString(),
        is_from_user: isFromUser,
      })
      .select("*")
      .single();

    if (messageError) {
      throw messageError;
    }

    // Update lead's updated_at timestamp
    await supabase.from("lead").update({ updated_at: new Date().toISOString() }).eq("id", leadId);

    return {
      ...message,
      content: message.message,
      isFromLead: message.is_from_user === true,
      leadId: leadId,
    };
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

// OPTIMIZED: Calculate channel statistics with single query
export async function getChannelStats(clinicId: string): Promise<ChannelStats> {
  try {
    const { data: leads, error } = await supabase.from("lead").select("source_id").eq("clinic_id", clinicId);

    if (error) {
      throw error;
    }

    const stats: ChannelStats = {
      chatbot: 0,
      form: 0,
      email: 0,
    };

    leads?.forEach(lead => {
      const channel = determineChannel(lead.source_id);
      stats[channel]++;
    });

    return stats;
  } catch (error) {
    console.error("Error calculating channel stats:", error);
    return { chatbot: 0, form: 0, email: 0 };
  }
}

// Update lead status, interest_level, or urgency
export async function updateLeadStatus(
  leadId: string,
  updates: {
    status?: string;
    interest_level?: string;
    urgency?: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase
      .from("lead")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error updating lead:", error);
    throw error;
  }
}

// Helper function to format status for display
export function formatStatus(status: string): string {
  return status
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper function to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-800";
    case "responded":
      return "bg-green-100 text-green-800";
    case "needs-follow-up":
      return "bg-yellow-100 text-yellow-800";
    case "in-nurture":
      return "bg-purple-100 text-purple-800";
    case "cold":
      return "bg-gray-100 text-gray-800";
    case "reactivated":
      return "bg-cyan-100 text-cyan-800";
    case "booked":
      return "bg-indigo-100 text-indigo-800";
    case "confirmed":
      return "bg-emerald-100 text-emerald-800";
    case "no-show":
      return "bg-red-100 text-red-800";
    case "converted":
      return "bg-green-100 text-green-800";
    case "not-interested":
      return "bg-orange-100 text-orange-800";
    case "archived":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Helper function to get priority color (for interest_level)
export function getInterestColor(interest: string): string {
  switch (interest) {
    case "high":
      return "text-red-600";
    case "medium":
      return "text-yellow-600";
    case "low":
      return "text-green-600";
    default:
      return "text-gray-600";
  }
}

// Helper function to get urgency color
export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "asap":
      return "text-red-600";
    case "this_month":
      return "text-yellow-600";
    case "curious":
      return "text-green-600";
    default:
      return "text-gray-600";
  }
}
