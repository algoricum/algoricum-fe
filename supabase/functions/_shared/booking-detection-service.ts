// _shared/booking-detection-service.ts

export interface BookingDetectionOptions {
  messageBody: string;
  subject?: string;
  leadData: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
  clinicData: {
    id: string;
    name: string;
    calendly_link?: string;
  };
  communicationType: "sms" | "email";
  senderPhone?: string;
  forceBooking?: boolean; // Force booking creation even if keywords don't match
}

export interface BookingDetectionResult {
  isBookingRequest: boolean;
  meetingScheduleCreated: boolean;
  meetingScheduleId?: string;
  error?: string;
}

// Enhanced logging for booking service
function logBookingInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] BOOKING-SERVICE: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logBookingError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] BOOKING-SERVICE ERROR: ${message}`, error);
}

export async function detectBookingRequestAndCreateSchedule(
  options: BookingDetectionOptions,
  supabaseClient: any,
): Promise<BookingDetectionResult> {
  try {
    logBookingInfo("=== Starting booking detection ===");
    logBookingInfo("Detection options:", {
      leadId: options.leadData.id,
      leadName: `${options.leadData.first_name} ${options.leadData.last_name}`,
      clinicId: options.clinicData.id,
      clinicName: options.clinicData.name,
      communicationType: options.communicationType,
      messageLength: options.messageBody.length,
      hasSubject: !!options.subject,
    });

    // Check for booking/appointment keywords
    const bookingKeywords = [
      "book",
      "booking",
      "appointment",
      "schedule",
      "meet",
      "consultation",
      "available",
      "time",
      "when can",
      "calendly",
      "visit",
      "see doctor",
      "consultation",
      "checkup",
    ];

    const messageBodyLower = options.messageBody.toLowerCase().trim();
    const subjectLower = options.subject?.toLowerCase().trim() || "";

    const keywordMatch = bookingKeywords.some(
      keyword => messageBodyLower.includes(keyword.toLowerCase()) || subjectLower.includes(keyword.toLowerCase()),
    );

    // Check if this is a booking request (either keyword match OR forced booking)
    const isBookingRequest = keywordMatch || options.forceBooking || false;

    logBookingInfo("Booking detection result:", {
      keywordMatch,
      forceBooking: options.forceBooking,
      isBookingRequest,
      matchedInBody: bookingKeywords.filter(keyword => messageBodyLower.includes(keyword)),
      matchedInSubject: bookingKeywords.filter(keyword => subjectLower.includes(keyword)),
    });

    if (!isBookingRequest) {
      return {
        isBookingRequest: false,
        meetingScheduleCreated: false,
      };
    }

    // Log booking request detection
    const detectionContext =
      options.communicationType === "email" ? `"${options.subject}" - "${options.messageBody}"` : `"${options.messageBody}"`;

    logBookingInfo(`📅 Booking request detected via ${options.communicationType.toUpperCase()}: ${detectionContext}`);

    // Generate a preferred meeting time (current time + 24 hours as default)
    const preferredTime = new Date();
    preferredTime.setDate(preferredTime.getDate() + 1); // Tomorrow
    preferredTime.setHours(10, 0, 0, 0); // 10 AM

    // Create meeting_schedule record
    const meetingData = {
      username:
        options.leadData.first_name ||
        options.leadData.email?.split("@")[0] ||
        (options.communicationType === "sms" ? `SMS Lead ${options.senderPhone?.slice(-4) || "Unknown"}` : "Email Lead"),
      email:
        options.leadData.email || (options.communicationType === "sms" ? `sms-lead-${options.leadData.id}@temp.com` : "unknown@temp.com"),
      clinic_id: options.clinicData.id,
      preferred_meeting_time: preferredTime.toISOString(),
      calendly_link: options.clinicData.calendly_link || "",
      meeting_notes: createMeetingNotes(options),
      phone_number: options.leadData.phone || options.senderPhone || null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    logBookingInfo("Creating meeting schedule with data:", meetingData);

    const { data: meetingSchedule, error: meetingError } = await supabaseClient
      .from("meeting_schedule")
      .insert(meetingData)
      .select()
      .single();

    if (meetingError) {
      logBookingError("❌ Error creating meeting schedule:", meetingError);
      return {
        isBookingRequest: true,
        meetingScheduleCreated: false,
        error: meetingError.message,
      };
    }

    logBookingInfo(`✅ Meeting schedule created: ${meetingSchedule.id} for lead ${options.leadData.id}`);

    // Update lead status to indicate booking interest
    const leadUpdateData = {
      status: "Booked",
      updated_at: new Date().toISOString(),
      notes: createLeadNotes(options, meetingSchedule.id),
    };

    logBookingInfo("Updating lead with booking interest:", leadUpdateData);

    const { error: leadUpdateError } = await supabaseClient.from("lead").update(leadUpdateData).eq("id", options.leadData.id);

    if (leadUpdateError) {
      logBookingError("❌ Error updating lead status:", leadUpdateError);
    } else {
      logBookingInfo(`✅ Lead ${options.leadData.id} marked as Engaged due to booking request`);
    }

    logBookingInfo("=== Booking detection completed successfully ===");

    return {
      isBookingRequest: true,
      meetingScheduleCreated: true,
      meetingScheduleId: meetingSchedule.id,
    };
  } catch (error) {
    logBookingError("❌ Unexpected error in booking detection:", error);
    return {
      isBookingRequest: true,
      meetingScheduleCreated: false,
      error: error.message,
    };
  }
}

function createMeetingNotes(options: BookingDetectionOptions): string {
  const timestamp = new Date().toISOString();

  if (options.communicationType === "email") {
    return `Auto-created from email booking request on ${timestamp}\nSubject: "${options.subject}"\nMessage: "${options.messageBody}"`;
  } else {
    return `Auto-created from SMS booking request on ${timestamp}: "${options.messageBody}"`;
  }
}

function createLeadNotes(options: BookingDetectionOptions, meetingScheduleId: string): string {
  const timestamp = new Date().toISOString();
  const existingNotes = options.leadData.notes || "";

  let newNote: string;
  if (options.communicationType === "email") {
    newNote = `Booking request via email on ${timestamp}\nSubject: "${options.subject}" - Meeting schedule created: ${meetingScheduleId}`;
  } else {
    newNote = `Booking request via SMS on ${timestamp}: "${options.messageBody}" - Meeting schedule created: ${meetingScheduleId}`;
  }

  return existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
}

export default {
  detectBookingRequestAndCreateSchedule,
};
