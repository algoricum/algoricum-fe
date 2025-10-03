// _shared/nurturing-types.ts

export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  status: string;
  source_id: string;
  clinic_id: string;
  notes?: string;
  interest_level: string;
  urgency: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id?: string;
  thread_id: string;
  message: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  is_from_user: boolean;
  sender_type: "user" | "assistant";
}

export interface Clinic {
  id: string;
  name: string;
  mailgun_domain?: string;
  mailgun_email?: string;
  calendly_link?: string;
  clinic_type?: string;
  twilio_config?: Array<{
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_phone_number: string;
    status: string;
  }>;
  assistants?: Array<{
    assistant_name?: string;
    instructions?: string;
  }>;
}

export interface FollowUpRule {
  name: string;
  timeFromCreated: number;
  maxTimeFromCreated?: number;
  leadStatus?: string[];
  communicationType: "sms" | "email";
  onlyOnce: boolean;
  checkLastActivity?: boolean;
  toleranceWindow?: number; // For demo version scheduling
}

export interface ProcessingResult {
  leadId: string;
  action: "sent" | "skipped" | "error";
  reason: string;
  followUpType: string;
  communicationType: "sms" | "email";
  error?: string;
}
