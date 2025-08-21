// src/utils/appointment-helper.ts

import { createClient } from "@/utils/supabase/config/client";

export type MeetingStatus = "confirmed" | "pending";

export interface MeetingSchedule {
  id: string;
  username: string;
  email: string;
  phone_number: string | null; 
  created_at: string;
  preferred_meeting_time: string | null;
  meeting_link: string | null;
  calendly_link: string | null;
  meeting_notes: string | null;
  clinic_id: string | null;
  status: MeetingStatus;
}

export interface CreateMeetingRequest {
  username: string;
  email: string;
  preferred_meeting_time?: string;
  meeting_link?: string;
  calendly_link?: string;
  meeting_notes?: string;
  clinic_id: string;
  status?: MeetingStatus;
}

export interface UpdateMeetingRequest {
  username?: string;
  email?: string;
  preferred_meeting_time?: string;
  meeting_link?: string;
  calendly_link?: string;
  meeting_notes?: string;
  status?: MeetingStatus;
}

export class AppointmentHelper {
  private supabase = createClient();

  /**
   * Get all meetings for a specific clinic
   */
  async getMeetingsByClinic(clinicId: string): Promise<MeetingSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch meetings: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching meetings by clinic:", error);
      throw error;
    }
  }

  /**
   * Get a specific meeting by ID
   */
  async getMeetingById(meetingId: string): Promise<MeetingSchedule | null> {
    try {
      const { data, error } = await this.supabase.from("meeting_schedule").select("*").eq("id", meetingId).single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // No rows returned
        }
        throw new Error(`Failed to fetch meeting: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error fetching meeting by ID:", error);
      throw error;
    }
  }

  /**
   * Create a new meeting
   */
  async createMeeting(meetingData: CreateMeetingRequest): Promise<MeetingSchedule> {
    try {
      // Validate data before creating
      const errors = validateMeetingData(meetingData);
      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(", ")}`);
      }

      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .insert([
          {
            ...meetingData,
            status: meetingData.status || "pending",
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create meeting: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error creating meeting:", error);
      throw error;
    }
  }

  /**
   * Update an existing meeting
   */
  async updateMeeting(meetingId: string, updateData: UpdateMeetingRequest): Promise<MeetingSchedule> {
    try {
      const { data, error } = await this.supabase.from("meeting_schedule").update(updateData).eq("id", meetingId).select().single();

      if (error) {
        throw new Error(`Failed to update meeting: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error updating meeting:", error);
      throw error;
    }
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(meetingId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from("meeting_schedule").delete().eq("id", meetingId);

      if (error) {
        throw new Error(`Failed to delete meeting: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error("Error deleting meeting:", error);
      throw error;
    }
  }

  /**
   * Update meeting status only
   */
  async updateMeetingStatus(meetingId: string, status: MeetingStatus): Promise<MeetingSchedule> {
    return this.updateMeeting(meetingId, { status });
  }

  /**
   * Get meetings by status for a clinic
   */
  async getMeetingsByStatus(clinicId: string, status: MeetingStatus): Promise<MeetingSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch meetings by status: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching meetings by status:", error);
      throw error;
    }
  }

  /**
   * Get meeting by email (since email is unique)
   */
  async getMeetingByEmail(email: string): Promise<MeetingSchedule | null> {
    try {
      const { data, error } = await this.supabase.from("meeting_schedule").select("*").eq("email", email).single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // No rows returned
        }
        throw new Error(`Failed to fetch meeting by email: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Error fetching meeting by email:", error);
      throw error;
    }
  }

  /**
   * Get meetings within a date range for a clinic
   */
  async getMeetingsByDateRange(clinicId: string, startDate: string, endDate: string): Promise<MeetingSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("preferred_meeting_time", startDate)
        .lte("preferred_meeting_time", endDate)
        .order("preferred_meeting_time", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch meetings by date range: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching meetings by date range:", error);
      throw error;
    }
  }

  /**
   * Bulk update meeting statuses
   */
  async bulkUpdateStatus(meetingIds: string[], status: MeetingStatus): Promise<boolean> {
    try {
      const { error } = await this.supabase.from("meeting_schedule").update({ status }).in("id", meetingIds);

      if (error) {
        throw new Error(`Failed to bulk update meeting statuses: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error("Error bulk updating meeting statuses:", error);
      throw error;
    }
  }

  /**
   * Get meeting statistics for a clinic
   */
  async getMeetingStats(clinicId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    try {
      // Get all meetings for the clinic
      const { data: allMeetings, error: allError } = await this.supabase
        .from("meeting_schedule")
        .select("status, preferred_meeting_time, created_at")
        .eq("clinic_id", clinicId);

      if (allError) {
        throw new Error(`Failed to fetch meeting stats: ${allError.message}`);
      }

      const meetings = allMeetings || [];
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: meetings.length,
        confirmed: meetings.filter(m => m.status === "confirmed").length,
        pending: meetings.filter(m => m.status === "pending").length,
        thisWeek: meetings.filter(m => new Date(m.created_at) >= weekAgo).length,
        thisMonth: meetings.filter(m => new Date(m.created_at) >= monthAgo).length,
      };

      return stats;
    } catch (error) {
      console.error("Error fetching meeting stats:", error);
      throw error;
    }
  }

  /**
   * Get upcoming meetings for a clinic (next 7 days)
   */
  async getUpcomingMeetings(clinicId: string, days: number = 7): Promise<MeetingSchedule[]> {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("preferred_meeting_time", now.toISOString())
        .lte("preferred_meeting_time", futureDate.toISOString())
        .order("preferred_meeting_time", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch upcoming meetings: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching upcoming meetings:", error);
      throw error;
    }
  }

  /**
   * Search meetings by username or email for a clinic
   */
  async searchMeetings(clinicId: string, searchTerm: string): Promise<MeetingSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to search meetings: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error searching meetings:", error);
      throw error;
    }
  }

  /**
   * Check if email already exists for a clinic
   */
  async checkEmailExists(email: string, clinicId?: string): Promise<boolean> {
    try {
      let query = this.supabase.from("meeting_schedule").select("id").eq("email", email);

      if (clinicId) {
        query = query.eq("clinic_id", clinicId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to check email existence: ${error.message}`);
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Error checking email existence:", error);
      throw error;
    }
  }

  /**
   * Get meetings by date for a clinic (specific day)
   */
  async getMeetingsByDate(clinicId: string, date: string): Promise<MeetingSchedule[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await this.supabase
        .from("meeting_schedule")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("preferred_meeting_time", startOfDay.toISOString())
        .lte("preferred_meeting_time", endOfDay.toISOString())
        .order("preferred_meeting_time", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch meetings by date: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching meetings by date:", error);
      throw error;
    }
  }
}

// Export a default instance
export const appointmentHelper = new AppointmentHelper();

// Utility functions for date formatting
export const formatMeetingDate = (dateString: string | null): string => {
  if (!dateString) return "Not scheduled";

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatMeetingTime = (dateString: string | null): string => {
  if (!dateString) return "Not scheduled";

  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getStatusColor = (status: MeetingStatus): string => {
  switch (status) {
    case "confirmed":
      return "text-green-600 bg-green-100";
    case "pending":
      return "text-yellow-600 bg-yellow-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

// Validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateMeetingData = (data: CreateMeetingRequest): string[] => {
  const errors: string[] = [];

  if (!data.username?.trim()) {
    errors.push("Username is required");
  }

  if (!data.email?.trim()) {
    errors.push("Email is required");
  } else if (!validateEmail(data.email)) {
    errors.push("Please enter a valid email address");
  }

  if (!data.clinic_id?.trim()) {
    errors.push("Clinic ID is required");
  }

  if (data.preferred_meeting_time) {
    const meetingDate = new Date(data.preferred_meeting_time);
    if (isNaN(meetingDate.getTime())) {
      errors.push("Please enter a valid meeting date and time");
    } else if (meetingDate < new Date()) {
      errors.push("Meeting time cannot be in the past");
    }
  }

  return errors;
};
