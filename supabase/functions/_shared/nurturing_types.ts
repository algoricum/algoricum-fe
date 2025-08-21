// _shared/types.ts

export interface Lead {
  id: string
  first_name?: string
  last_name?: string
  phone: string
  email?: string
  status: string
  source_id: string
  clinic_id: string
  notes?: string
  interest_level: string
  urgency: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id?: string
  thread_id: string
  message: string
  timestamp: string
  created_at: string
  updated_at: string
  is_from_user: boolean
  sender_type: 'user' | 'assistant'
}

export interface Clinic {
  id: string
  name: string
  openai_api_key?: string
  assistant_prompt?: string
  assistant_model?: string
  chatbot_name?: string
  mailgun_domain?: string
  mailgun_email?: string
  twilio_config?: Array<{
    twilio_account_sid: string
    twilio_auth_token: string
    twilio_phone_number: string
    status: string
  }>
}

export interface FollowUpRule {
  name: string
  timeFromCreated: number // milliseconds
  maxTimeFromCreated?: number // milliseconds
  leadStatus?: string[] // which lead statuses to target
  communicationType: 'sms' | 'email'
  onlyOnce: boolean
  checkLastActivity?: boolean
}

export interface ProcessingResult {
  leadId: string
  action: 'sent' | 'skipped' | 'error'
  reason: string
  followUpType: string
  communicationType: 'sms' | 'email'
  error?: string
}

export interface TwilioWebhookData {
  from: string
  to: string
  body: string
  messageSid: string
  accountSid: string
}

export interface EmailWebhookData {
  from: string
  to: string
  subject: string
  body: string
}

export interface Thread {
  id: string
  lead_id: string
  clinic_id: string
  status: string
  created_at?: string
  updated_at?: string
}