import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./config/client";


export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string; // computed field
  email: string | null;
  phone: string | null;
  status: string;
  source_id: string;
  clinic_id: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  avatar?: string; // computed field
  priority?: 'high' | 'medium' | 'low'; // computed field
  channel?: 'chatbot' | 'form' | 'email'; // computed field
  lastMessage?: string; // computed field
  lastActivity?: Date; // computed field
  messages?: Message[];
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
  priority?: 'high' | 'medium' | 'low' | 'all';
  channel?: 'chatbot' | 'form' | 'email' | 'all';
  search?: string;
}

export interface ChannelStats {
  chatbot: number;
  form: number;
  email: number;
}
const supabase = createClient()
// Helper function to get current user's clinic
export async function getCurrentUserClinic() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data: userClinic, error: clinicError } = await supabase
    .from('user_clinic')
    .select('clinic_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (clinicError || !userClinic) {
    throw new Error('No clinic found for user');
  }

  return userClinic.clinic_id;
}

// Helper function to determine priority based on lead data
function calculatePriority(lead: any): 'high' | 'medium' | 'low' {
  // Business logic for priority calculation
  const now = new Date();
  const createdAt = new Date(lead.created_at);
  const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (lead.status === 'new' && hoursOld < 2) return 'high';
  if (lead.status === 'responded') return 'high';
  if (hoursOld < 24) return 'medium';
  return 'low';
}

// Helper function to determine channel (you might want to add a source table)
function determineChannel(sourceId: string): 'chatbot' | 'form' | 'email' {
  // This is simplified - you might want to create a sources table
  // For now, using simple logic based on source_id patterns
  return 'chatbot'; // Default - you can enhance this
}

// Helper function to generate avatar URL
function generateAvatar(name: string): string {
  return `/placeholder.svg?height=40&width=40&text=${encodeURIComponent(name.substring(0, 2).toUpperCase())}`;
}

// Fetch all leads for a clinic with their latest messages
export async function fetchLeadsForClinic(

  clinicId: string,
  filters?: LeadsFilters
): Promise<Lead[]> {
  try {
    let query = supabase
      .from('lead')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        source_id,
        clinic_id,
        assigned_to,
        notes,
        created_at,
        updated_at
      `)
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw error;
    }

    if (!leads) {
      return [];
    }

    // Transform and enrich the leads data
    const enrichedLeads: Lead[] = await Promise.all(
      leads.map(async (lead) => {
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Anonymous';
        
        // Get the latest thread for this lead
        const { data: thread } = await supabase
          .from('threads')
          .select('id, openai_thread_id')
          .eq('lead_id', lead.id)
          .eq('clinic_id', clinicId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastMessage = '';
        let lastActivity = new Date(lead.updated_at);

        // Get latest message if thread exists
        if (thread) {
          const { data: latestMessage } = await supabase
            .from('conversation')
            .select('message, timestamp')
            .eq('thread_id', thread.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMessage) {
            lastMessage = latestMessage.message;
            lastActivity = new Date(latestMessage.timestamp);
          }
        }

        return {
          ...lead,
          name,
          avatar: generateAvatar(name),
          priority: calculatePriority(lead),
          channel: determineChannel(lead.source_id),
          lastMessage: lastMessage || 'No messages yet',
          lastActivity,
          messages: [], // Will be loaded separately when needed
        };
      })
    );

    // Apply client-side filters
    let filteredLeads = enrichedLeads;

    if (filters?.priority && filters.priority !== 'all') {
      filteredLeads = filteredLeads.filter(lead => lead.priority === filters.priority);
    }

    if (filters?.channel && filters.channel !== 'all') {
      filteredLeads = filteredLeads.filter(lead => lead.channel === filters.channel);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredLeads = filteredLeads.filter(lead =>
        lead.name.toLowerCase().includes(searchLower) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
        lead?.lastMessage?.toLowerCase().includes(searchLower)
      );
    }

    return filteredLeads;
  } catch (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
}

// Fetch messages for a specific lead
export async function fetchMessagesForLead(

  leadId: string,
  clinicId: string
): Promise<Message[]> {
  try {
    // First get the thread for this lead
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (threadError || !thread) {
      return [];
    }

    // Get all messages for this thread
    const { data: messages, error: messagesError } = await supabase
      .from('conversation')
      .select('*')
      .eq('thread_id', thread.id)
      .order('timestamp', { ascending: true });

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
    console.error('Error fetching messages:', error);
    throw error;
  }
}

// Send a message to a lead
export async function sendMessageToLead(

  leadId: string,
  clinicId: string,
  content: string,
  isFromUser: boolean = false
): Promise<Message> {
  try {
    // Get or create thread for this lead
    let { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (threadError && threadError.code !== 'PGRST116') {
      throw threadError;
    }

    // Create thread if it doesn't exist
    if (!thread) {
      const { data: newThread, error: createThreadError } = await supabase
        .from('threads')
        .insert({
          lead_id: leadId,
          clinic_id: clinicId,
          status: 'active'
        })
        .select('id')
        .single();

      if (createThreadError) {
        throw createThreadError;
      }

      thread = newThread;
    }

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from('conversation')
      .insert({
        thread_id: thread.id,
        message: content,
        timestamp: new Date().toISOString(),
        is_from_user: isFromUser
      })
      .select('*')
      .single();

    if (messageError) {
      throw messageError;
    }

    // Update lead's updated_at timestamp
    await supabase
      .from('lead')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', leadId);

    return {
      ...message,
      content: message.message,
      isFromLead: message.is_from_user === true,
      leadId: leadId,
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Calculate channel statistics
export async function getChannelStats(

  clinicId: string
): Promise<ChannelStats> {
  try {
    const { data: leads, error } = await supabase
      .from('lead')
      .select('source_id')
      .eq('clinic_id', clinicId);

    if (error) {
      throw error;
    }

    const stats: ChannelStats = {
      chatbot: 0,
      form: 0,
      email: 0
    };

    leads?.forEach(lead => {
      const channel = determineChannel(lead.source_id);
      stats[channel]++;
    });

    return stats;
  } catch (error) {
    console.error('Error calculating channel stats:', error);
    return { chatbot: 0, form: 0, email: 0 };
  }
}

// Update lead status
export async function updateLeadStatus(
  leadId: string,
  status: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('lead')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
}