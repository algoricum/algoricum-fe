// utils/supabase/email-settings-helper.ts

import { createClient } from "./config/client"


// Types and Interfaces
export interface EmailSettings {
  id?: string
  clinic_id: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_sender_name: string
  smtp_sender_email: string
  smtp_use_tls: boolean
  pop_server: string
  pop_port: number
  pop_user: string
  pop_password: string
  pop_use_ssl: boolean
  auto_reply_enabled: boolean
  check_frequency_minutes: number
  last_email_check?: string | null
  created_at?: string
  updated_at?: string
}

export interface EmailSettingsInput {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_sender_name: string
  smtp_sender_email: string
  smtp_use_tls: boolean
  pop_server: string
  pop_port: number
  pop_user: string
  pop_password: string
  pop_use_ssl: boolean
  auto_reply_enabled: boolean
  check_frequency_minutes: number
}

export interface EmailSettingsWithClinic extends EmailSettings {
  clinic: {
    id: string
    name: string
  }
}

export interface EmailTestResult {
  success: boolean
  message?: string
  details?: {
    smtp: {
      success: boolean
      error?: string
    }
    pop: {
      success: boolean
      error?: string
      message?: string
    }
    overall: boolean
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface EmailSettingsResponse<T = EmailSettings> {
  data: T | null
  error: any
}

export interface SaveEmailSettingsResponse extends EmailSettingsResponse {
  isUpdate: boolean
}

/**
 * Get email settings for a clinic
 */
export const getEmailSettings = async (clinicId: string): Promise<EmailSettingsResponse> => {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("email_settings")
      .select("*")
      .eq("clinic_id", clinicId)
      .single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return { data: data as EmailSettings | null, error: null }
  } catch (error) {
    console.error("Error fetching email settings:", error)
    return { data: null, error }
  }
}

/**
 * Save email settings (create or update)
 */
export const saveEmailSettings = async (
  clinicId: string, 
  settings: EmailSettingsInput
): Promise<SaveEmailSettingsResponse> => {
  try {
    const supabase = createClient()

    // First check if settings exist
    const { data: existingSettings } = await supabase
      .from("email_settings")
      .select("id")
      .eq("clinic_id", clinicId)
      .single()

    const emailSettingsData: Partial<EmailSettings> = {
      clinic_id: clinicId,
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: settings.smtp_password,
      smtp_sender_name: settings.smtp_sender_name,
      smtp_sender_email: settings.smtp_sender_email,
      smtp_use_tls: settings.smtp_use_tls,
      pop_server: settings.pop_server,
      pop_port: settings.pop_port,
      pop_user: settings.pop_user,
      pop_password: settings.pop_password,
      pop_use_ssl: settings.pop_use_ssl,
      auto_reply_enabled: settings.auto_reply_enabled,
      check_frequency_minutes: settings.check_frequency_minutes,
      updated_at: new Date().toISOString()
    }

    let result

    if (existingSettings) {
      // Update existing record
      result = await supabase
        .from("email_settings")
        .update(emailSettingsData)
        .eq("clinic_id", clinicId)
        .select()
        .single()
    } else {
      // Insert new record
      result = await supabase
        .from("email_settings")
        .insert(emailSettingsData)
        .select()
        .single()
    }

    if (result.error) {
      throw result.error
    }

    return { 
      data: result.data as EmailSettings, 
      error: null, 
      isUpdate: !!existingSettings 
    }

  } catch (error) {
    console.error("Error saving email settings:", error)
    return { data: null, error, isUpdate: false }
  }
}

/**
 * Test email connection
 */
export const testEmailConnection = async (
  settings: EmailSettingsInput, 
  clinicId: string
): Promise<EmailTestResult> => {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error("Please log in to test email connection")
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-email-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...settings,
        clinic_id: clinicId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: EmailTestResult = await response.json()
    return result

  } catch (error: any) {
    console.error('Test connection error:', error)
    return {
      success: false,
      message: error.message || "Failed to test email connection"
    }
  }
}

/**
 * Update email processing settings only
 */
export const updateEmailProcessingSettings = async (
  clinicId: string, 
  processingSettings: Pick<EmailSettingsInput, 'auto_reply_enabled' | 'check_frequency_minutes'>
): Promise<EmailSettingsResponse> => {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("email_settings")
      .update({
        auto_reply_enabled: processingSettings.auto_reply_enabled,
        check_frequency_minutes: processingSettings.check_frequency_minutes,
        updated_at: new Date().toISOString()
      })
      .eq("clinic_id", clinicId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return { data: data as EmailSettings, error: null }

  } catch (error) {
    console.error("Error updating email processing settings:", error)
    return { data: null, error }
  }
}

/**
 * Update last email check timestamp
 */
export const updateLastEmailCheck = async (clinicId: string): Promise<EmailSettingsResponse> => {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("email_settings")
      .update({
        last_email_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("clinic_id", clinicId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return { data: data as EmailSettings, error: null }

  } catch (error) {
    console.error("Error updating last email check:", error)
    return { data: null, error }
  }
}

/**
 * Delete email settings
 */
export const deleteEmailSettings = async (clinicId: string): Promise<{ error: any }> => {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from("email_settings")
      .delete()
      .eq("clinic_id", clinicId)

    if (error) {
      throw error
    }

    return { error: null }

  } catch (error) {
    console.error("Error deleting email settings:", error)
    return { error }
  }
}

/**
 * Get all email settings (for admin purposes)
 */
export const getAllEmailSettings = async (): Promise<EmailSettingsResponse<EmailSettingsWithClinic[]>> => {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("email_settings")
      .select(`
        *,
        clinic:clinic_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return { data: data as EmailSettingsWithClinic[], error: null }

  } catch (error) {
    console.error("Error fetching all email settings:", error)
    return { data: null, error }
  }
}

/**
 * Validate email settings
 */
export const validateEmailSettings = (settings: Partial<EmailSettingsInput>): ValidationResult => {
  const errors: string[] = []

  // SMTP validation
  if (!settings.smtp_host) errors.push("SMTP host is required")
  if (!settings.smtp_user) errors.push("SMTP username is required")
  if (!settings.smtp_password) errors.push("SMTP password is required")
  if (!settings.smtp_sender_email) errors.push("Sender email is required")
  if (!settings.smtp_sender_name) errors.push("Sender name is required")
  
  // Port validation
  if (!settings.smtp_port || settings.smtp_port < 1 || settings.smtp_port > 65535) {
    errors.push("Valid SMTP port is required (1-65535)")
  }

  // POP3 validation
  if (!settings.pop_server) errors.push("POP3 server is required")
  if (!settings.pop_user) errors.push("POP3 username is required")
  if (!settings.pop_password) errors.push("POP3 password is required")
  
  if (!settings.pop_port || settings.pop_port < 1 || settings.pop_port > 65535) {
    errors.push("Valid POP3 port is required (1-65535)")
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (settings.smtp_user && !emailRegex.test(settings.smtp_user)) {
    errors.push("SMTP username must be a valid email address")
  }
  if (settings.smtp_sender_email && !emailRegex.test(settings.smtp_sender_email)) {
    errors.push("Sender email must be a valid email address")
  }
  if (settings.pop_user && !emailRegex.test(settings.pop_user)) {
    errors.push("POP3 username must be a valid email address")
  }

  // Processing settings validation
  if (settings.check_frequency_minutes !== undefined && 
      (settings.check_frequency_minutes < 1 || settings.check_frequency_minutes > 60)) {
    errors.push("Check frequency must be between 1 and 60 minutes")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get default email settings
 */
export const getDefaultEmailSettings = (): Partial<EmailSettingsInput> => {
  return {
    smtp_port: 465,
    smtp_use_tls: true,
    pop_port: 995,
    pop_use_ssl: true,
    auto_reply_enabled: true,
    check_frequency_minutes: 5
  }
}

/**
 * Check if email settings are configured for a clinic
 */
export const isEmailConfigured = async (clinicId: string): Promise<boolean> => {
  try {
    const { data } = await getEmailSettings(clinicId)
    return !!data && !!data.smtp_host && !!data.pop_server
  } catch (error) {
    console.error("Error checking email configuration:", error)
    return false
  }
}