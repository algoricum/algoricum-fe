// utils/supabase/email-settings-helper.ts - Updated for IMAP

import { createClient } from "./config/client"

// Types and Interfaces
export interface EmailSettings {
  id?: string
  clinic_id: string
  // SMTP Settings
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_sender_name: string
  smtp_sender_email: string
  smtp_use_tls: boolean
  // IMAP Settings (updated from POP3)
  imap_server: string
  imap_port: number
  imap_user: string
  imap_password: string
  imap_use_ssl: boolean
  imap_folder?: string
  last_processed_uid?: number
  // Processing Settings
  auto_reply_enabled: boolean
  check_frequency_minutes: number
  last_email_check?: string | null
  created_at?: string
  updated_at?: string
}

export interface EmailSettingsInput {
  // SMTP Settings
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_sender_name: string
  smtp_sender_email: string
  smtp_use_tls: boolean
  // IMAP Settings (updated from POP3)
  imap_server: string
  imap_port: number
  imap_user: string
  imap_password: string
  imap_use_ssl: boolean
  // Processing Settings
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
  summary?: {
    smtp_status: string
    imap_status: string
    test_email_sent: boolean
    mailbox_access: boolean
  }
  details?: {
    smtp: {
      success: boolean
      message?: string
      error?: string
      response_time?: number
      details?: any
    }
    imap: {
      success: boolean
      message?: string
      error?: string
      response_time?: number
      details?: {
        hostname: string
        port: number
        username: string
        useSsl: boolean
        greeting?: string
        folder_info?: any
        status_info?: any
        search_results?: any
        available_folders?: any[]
        capabilities_tested?: string[]
      }
    }
    overall: boolean
    test_timestamp: string
  }
  troubleshooting?: {
    smtp_issues: Array<{
      issue: string
      solutions: string[]
    }>
    imap_issues: Array<{
      issue: string
      solutions: string[]
    }>
    general_tips: string[]
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
      // SMTP settings
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: settings.smtp_password,
      smtp_sender_name: settings.smtp_sender_name,
      smtp_sender_email: settings.smtp_sender_email,
      smtp_use_tls: settings.smtp_use_tls,
      // IMAP settings (updated from POP3)
      imap_server: settings.imap_server,
      imap_port: settings.imap_port,
      imap_user: settings.imap_user,
      imap_password: settings.imap_password,
      imap_use_ssl: settings.imap_use_ssl,
      imap_folder: 'INBOX', // Default folder
      // Processing settings
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
        .insert({
          ...emailSettingsData,
          created_at: new Date().toISOString()
        })
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
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`)
    }

    const result: EmailTestResult = await response.json()
    return result

  } catch (error: any) {
    console.log(error,error.details)
    return {
      success: false,
      message: error.message || "Failed to test email connection",
      details: {
        smtp: { success: error.details.smtp.success, error: error.details.smtp.message },
        imap: { success: error.details.imap.success, error: error.details.imap.message },
        overall: false,
        test_timestamp: new Date().toISOString()
      }
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
  
  // SMTP port validation
  if (!settings.smtp_port || settings.smtp_port < 1 || settings.smtp_port > 65535) {
    errors.push("Valid SMTP port is required (1-65535)")
  }

  // IMAP validation (updated from POP3)
  if (!settings.imap_server) errors.push("IMAP server is required")
  if (!settings.imap_user) errors.push("IMAP username is required")
  if (!settings.imap_password) errors.push("IMAP password is required")
  
  // IMAP port validation
  if (!settings.imap_port || settings.imap_port < 1 || settings.imap_port > 65535) {
    errors.push("Valid IMAP port is required (1-65535)")
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (settings.smtp_user && !emailRegex.test(settings.smtp_user)) {
    errors.push("SMTP username must be a valid email address")
  }
  if (settings.smtp_sender_email && !emailRegex.test(settings.smtp_sender_email)) {
    errors.push("Sender email must be a valid email address")
  }
  if (settings.imap_user && !emailRegex.test(settings.imap_user)) {
    errors.push("IMAP username must be a valid email address")
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
    imap_port: 993, // Updated from POP3 port 995
    imap_use_ssl: true, // Updated from pop_use_ssl
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
    return !!data && !!data.smtp_host && !!data.imap_server // Updated from pop_server
  } catch (error) {
    console.error("Error checking email configuration:", error)
    return false
  }
}

/**
 * Get common email provider settings for auto-configuration
 */
export const getProviderSettings = (emailDomain: string): Partial<EmailSettingsInput> | null => {
  const domain = emailDomain.toLowerCase()
  
  const providers: Record<string, Partial<EmailSettingsInput>> = {
    'gmail.com': {
      smtp_host: 'smtp.gmail.com',
      smtp_port: 465,
      smtp_use_tls: true,
      imap_server: 'imap.gmail.com',
      imap_port: 993,
      imap_use_ssl: true
    },
    'outlook.com': {
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_use_tls: true,
      imap_server: 'outlook.office365.com',
      imap_port: 993,
      imap_use_ssl: true
    },
    'hotmail.com': {
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_use_tls: true,
      imap_server: 'outlook.office365.com',
      imap_port: 993,
      imap_use_ssl: true
    },
    'yahoo.com': {
      smtp_host: 'smtp.mail.yahoo.com',
      smtp_port: 465,
      smtp_use_tls: true,
      imap_server: 'imap.mail.yahoo.com',
      imap_port: 993,
      imap_use_ssl: true
    },
    'live.com': {
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_use_tls: true,
      imap_server: 'outlook.office365.com',
      imap_port: 993,
      imap_use_ssl: true
    }
  }

  return providers[domain] || null
}

/**
 * Auto-fill provider settings based on email address
 */
export const autoFillProviderSettings = (
  emailAddress: string,
  currentSettings: Partial<EmailSettingsInput>
): Partial<EmailSettingsInput> => {
  const domain = emailAddress.split('@')[1]?.toLowerCase()
  
  if (!domain) {
    return currentSettings
  }
  
  const providerSettings = getProviderSettings(domain)
  
  if (providerSettings) {
    return {
      ...currentSettings,
      ...providerSettings,
      smtp_user: emailAddress,
      imap_user: emailAddress,
      smtp_sender_email: emailAddress
    }
  }
  
  return currentSettings
}

/**
 * Get email monitoring status for display
 */
export const getEmailMonitoringStatus = (settings: EmailSettings | null) => {
  if (!settings) {
    return {
      status: 'not_configured',
      message: 'Email not configured',
      color: 'gray',
      badge: '⚪'
    }
  }
  
  if (!isCompletelyConfigured(settings)) {
    return {
      status: 'incomplete',
      message: 'Email configuration incomplete',
      color: 'orange',
      badge: '🟡'
    }
  }
  
  if (!settings.auto_reply_enabled) {
    return {
      status: 'disabled',
      message: 'Auto-reply disabled',
      color: 'red',
      badge: '🔴'
    }
  }
  
  const lastCheck = settings.last_email_check
  if (!lastCheck) {
    return {
      status: 'configured',
      message: 'Email configured, never checked',
      color: 'blue',
      badge: '🔵'
    }
  }
  
  const lastCheckDate = new Date(lastCheck)
  const now = new Date()
  const timeDiff = now.getTime() - lastCheckDate.getTime()
  const minutesDiff = Math.floor(timeDiff / (1000 * 60))
  
  if (minutesDiff > settings.check_frequency_minutes * 2) {
    return {
      status: 'warning',
      message: `Last checked ${minutesDiff} minutes ago`,
      color: 'orange',
      badge: '🟡'
    }
  }
  
  return {
    status: 'active',
    message: `Active, last checked ${minutesDiff} minutes ago`,
    color: 'green',
    badge: '🟢'
  }
}

/**
 * Check if email settings are completely configured
 */
export const isCompletelyConfigured = (settings: EmailSettings): boolean => {
  return !!(
    settings.smtp_host &&
    settings.smtp_port &&
    settings.smtp_user &&
    settings.smtp_password &&
    settings.smtp_sender_email &&
    settings.smtp_sender_name &&
    settings.imap_server && // Updated from pop_server
    settings.imap_port && // Updated from pop_port
    settings.imap_user && // Updated from pop_user
    settings.imap_password // Updated from pop_password
  )
}

/**
 * Migration helper for existing POP3 configurations
 * This helps migrate users from POP3 to IMAP
 */
export const migratePOP3ToIMAP = (popSettings: any): Partial<EmailSettingsInput> => {
  const imapSettings: Partial<EmailSettingsInput> = {}
  
  // Copy SMTP settings as-is
  if (popSettings.smtp_host) imapSettings.smtp_host = popSettings.smtp_host
  if (popSettings.smtp_port) imapSettings.smtp_port = popSettings.smtp_port
  if (popSettings.smtp_user) imapSettings.smtp_user = popSettings.smtp_user
  if (popSettings.smtp_password) imapSettings.smtp_password = popSettings.smtp_password
  if (popSettings.smtp_sender_name) imapSettings.smtp_sender_name = popSettings.smtp_sender_name
  if (popSettings.smtp_sender_email) imapSettings.smtp_sender_email = popSettings.smtp_sender_email
  if (typeof popSettings.smtp_use_tls === 'boolean') imapSettings.smtp_use_tls = popSettings.smtp_use_tls
  
  // Migrate POP3 to IMAP settings
  if (popSettings.pop_server) {
    // Convert common POP3 servers to IMAP equivalents
    const popToImapMap: Record<string, string> = {
      'pop.gmail.com': 'imap.gmail.com',
      'pop3.live.com': 'outlook.office365.com',
      'pop.mail.yahoo.com': 'imap.mail.yahoo.com'
    }
    
    imapSettings.imap_server = popToImapMap[popSettings.pop_server] || 
                               popSettings.pop_server.replace('pop', 'imap')
  }
  
  // Convert POP3 port (995) to IMAP port (993)
  if (popSettings.pop_port === 995) {
    imapSettings.imap_port = 993
  } else if (popSettings.pop_port) {
    imapSettings.imap_port = popSettings.pop_port
  }
  
  if (popSettings.pop_user) imapSettings.imap_user = popSettings.pop_user
  if (popSettings.pop_password) imapSettings.imap_password = popSettings.pop_password
  if (typeof popSettings.pop_use_ssl === 'boolean') imapSettings.imap_use_ssl = popSettings.pop_use_ssl
  
  // Copy processing settings
  if (typeof popSettings.auto_reply_enabled === 'boolean') imapSettings.auto_reply_enabled = popSettings.auto_reply_enabled
  if (popSettings.check_frequency_minutes) imapSettings.check_frequency_minutes = popSettings.check_frequency_minutes
  
  return imapSettings
}