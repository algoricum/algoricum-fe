// _shared/database.ts

import type { Lead, Conversation, Clinic, Thread, TwilioWebhookData, EmailWebhookData } from './types.ts'

function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] DATABASE: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] DATABASE ERROR: ${message}`, error)
}

export async function getAllClinicsWithSettings(supabase: any): Promise<{ data: Clinic[] | null, error: any }> {
  try {
    const { data: clinics, error: clinicError } = await supabase
      .from('clinic')
      .select(`
        id,
        name,
        openai_api_key,
        assistant_prompt,
        assistant_model,
        chatbot_name,
        mailgun_domain,
        mailgun_email,
        twilio_config(
          twilio_account_sid,
          twilio_auth_token,
          twilio_phone_number,
          status
        )
      `)

    return { data: clinics, error: clinicError }
  } catch (error) {
    logError('Error in getAllClinicsWithSettings', error)
    return { data: null, error }
  }
}

export async function getClinicById(clinicId: string, supabase: any): Promise<{ data: Clinic | null, error: any }> {
  try {
    const { data: clinic, error } = await supabase
      .from('clinic')
      .select('*')
      .eq('id', clinicId)
      .single()

    return { data: clinic, error }
  } catch (error) {
    logError(`Error getting clinic ${clinicId}`, error)
    return { data: null, error }
  }
}

export async function getClinicByMailgunEmail(email: string, supabase: any): Promise<{ data: Clinic | null, error: any }> {
  try {
    const { data: clinic, error } = await supabase
      .from('clinic')
      .select('id, mailgun_email')
      .eq('mailgun_email', email)
      .single()

    return { data: clinic, error }
  } catch (error) {
    logError(`Error getting clinic by mailgun email ${email}`, error)
    return { data: null, error }
  }
}

// ==================== LEAD QUERIES ====================

export async function getLeadsForClinic(
  clinicId: string, 
  supabase: any, 
  communicationType?: 'sms' | 'email'
): Promise<Lead[]> {
  try {
    let leadQuery = supabase
      .from('lead')
      .select('*')
      .eq('clinic_id', clinicId)

    // Filter by communication requirements
    if (communicationType === 'sms') {
      leadQuery = leadQuery.not('phone', 'is', null).neq('phone', '')
    } else if (communicationType === 'email') {
      leadQuery = leadQuery.not('email', 'is', null).neq('email', '')
    } else {
      // Need either phone or email
      leadQuery = leadQuery.or('phone.not.is.null,email.not.is.null')
    }

    const { data: leads, error } = await leadQuery

    if (error) {
      logError(`Error fetching leads for clinic ${clinicId}`, error)
      return []
    }

    return leads || []

  } catch (error) {
    logError(`Error in getLeadsForClinic for ${clinicId}`, error)
    return []
  }
}

export async function getLeadByPhone(phone: string, clinicId: string, supabase: any): Promise<{ data: Lead | null, error: any }> {
  try {
    const { data: lead, error } = await supabase
      .from('lead')
      .select('*')
      .eq('phone', phone)
      .eq('clinic_id', clinicId)
      .single()

    return { data: lead, error }
  } catch (error) {
    logError(`Error getting lead by phone ${phone} for clinic ${clinicId}`, error)
    return { data: null, error }
  }
}

export async function getLeadByEmail(email: string, clinicId: string, supabase: any): Promise<{ data: Lead | null, error: any }> {
  try {
    const { data: lead, error } = await supabase
      .from('lead')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', clinicId)
      .single()

    return { data: lead, error }
  } catch (error) {
    logError(`Error getting lead by email ${email} for clinic ${clinicId}`, error)
    return { data: null, error }
  }
}

export async function updateLeadStatus(leadId: string, status: string, supabase: any): Promise<{ success: boolean, error?: any }> {
  try {
    const { error } = await supabase
      .from('lead')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
    
    if (error) {
      logError(`Error updating lead ${leadId} status to ${status}`, error)
      return { success: false, error }
    }

    logInfo(`Updated lead ${leadId} status to ${status}`)
    return { success: true }

  } catch (error) {
    logError(`Error in updateLeadStatus for lead ${leadId}`, error)
    return { success: false, error }
  }
}

export async function getThreadByLeadId(leadId: string, supabase: any): Promise<{ data: Thread | null, error: any }> {
  try {
    const { data: thread, error } = await supabase
      .from('threads')
      .select('*')
      .eq('lead_id', leadId)
      .single()

    return { data: thread, error }
  } catch (error) {
    logError(`Error getting thread for lead ${leadId}`, error)
    return { data: null, error }
  }
}

export async function getOrCreateThread(lead: Lead, supabase: any): Promise<string | null> {
  try {
    // Try to get existing thread
    const { data: existingThread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('clinic_id', lead.clinic_id)
      .single()
    
    if (existingThread) {
      return existingThread.id
    }
    
    // Create new thread
    const { data: newThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        status: 'new'
      })
      .select('id')
      .single()
    
    if (threadError) {
      logError(`Error creating thread for lead ${lead.id}`, threadError)
      return null
    }
    
    logInfo(`Created new thread ${newThread.id} for lead ${lead.id}`)
    return newThread.id
    
  } catch (error) {
    logError(`Error in getOrCreateThread for lead ${lead.id}`, error)
    return null
  }
}

export async function getConversationHistory(threadId: string, supabase: any): Promise<Conversation[]> {
  try {
    const { data: conversations, error } = await supabase
      .from('conversation')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    
    if (error) {
      logError(`Error fetching conversation history for thread ${threadId}`, error)
      return []
    }
    
    return conversations || []
    
  } catch (error) {
    logError(`Error in getConversationHistory for thread ${threadId}`, error)
    return []
  }
}

export async function saveMessageToHistory(
  threadId: string,
  messageContent: string | { subject: string, body: string },
  followUpType: string,
  supabase: any
): Promise<{ success: boolean, error?: any }> {
  try {
    const now = new Date().toISOString()
    let messageText = ''
    
    if (typeof messageContent === 'string') {
      messageText = `${followUpType.toUpperCase()}: ${messageContent}`
    } else {
      messageText = `${followUpType.toUpperCase()} EMAIL - Subject: ${messageContent.subject}\n\n${messageContent.body}`
    }
    
    const { error } = await supabase
      .from('conversation')
      .insert({
        thread_id: threadId,
        message: messageText,
        timestamp: now,
        is_from_user: false,
        sender_type: 'assistant'
      })
    
    if (error) {
      logError(`Error saving message to history for thread ${threadId}`, error)
      return { success: false, error }
    }

    logInfo(`Saved message to history for thread ${threadId}`)
    return { success: true }
    
  } catch (error) {
    logError(`Error in saveMessageToHistory for thread ${threadId}`, error)
    return { success: false, error }
  }
}

export async function saveIncomingMessage(
  threadId: string,
  message: string,
  supabase: any
): Promise<{ success: boolean, error?: any }> {
  try {
    const { error } = await supabase
      .from('conversation')
      .insert({
        thread_id: threadId,
        message: message,
        timestamp: new Date().toISOString(),
        is_from_user: true,
        sender_type: 'user'
      })

    if (error) {
      logError(`Error saving incoming message for thread ${threadId}`, error)
      return { success: false, error }
    }

    logInfo(`Saved incoming message for thread ${threadId}`)
    return { success: true }

  } catch (error) {
    logError(`Error in saveIncomingMessage for thread ${threadId}`, error)
    return { success: false, error }
  }
}

// ==================== FOLLOW-UP TRACKING QUERIES ====================

export async function hasFollowUpBeenSent(leadId: string, followUpName: string, supabase: any): Promise<boolean> {
  try {
    // Get thread for this lead
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
    // Check if this follow-up type has been sent using multiple patterns
    const searchPatterns = [
      `%${followUpName}%`,
      `%${followUpName.toUpperCase()}%`,
      `%${followUpName.toLowerCase()}%`
    ]
    
    for (const pattern of searchPatterns) {
      const { data: conversations } = await supabase
        .from('conversation')
        .select('id, message')
        .eq('thread_id', thread.id)
        .eq('is_from_user', false)
        .eq('sender_type', 'assistant')
        .ilike('message', pattern)
      
      if (conversations && conversations.length > 0) {
        logInfo(`Follow-up ${followUpName} already sent for lead ${leadId}`)
        return true
      }
    }
    
    return false
    
  } catch (error) {
    logError(`Error checking if follow-up ${followUpName} was sent for lead ${leadId}`, error)
    return false // If we can't check, assume it wasn't sent (safer for follow-ups)
  }
}

export async function hasUserRepliedToLastAssistantMessage(leadId: string, supabase: any): Promise<boolean> {
  try {
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
    // Get last assistant message
    const { data: lastAssistantMessage } = await supabase
      .from('conversation')
      .select('created_at')
      .eq('thread_id', thread.id)
      .eq('is_from_user', false)
      .eq('sender_type', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (!lastAssistantMessage) return false
    
    // Check if there are user messages after the last assistant message
    const { data: userReplies } = await supabase
      .from('conversation')
      .select('id')
      .eq('thread_id', thread.id)
      .eq('is_from_user', true)
      .eq('sender_type', 'user')
      .gt('created_at', lastAssistantMessage.created_at)
    
    return userReplies && userReplies.length > 0
    
  } catch (error) {
    logError(`Error checking user replies for lead ${leadId}`, error)
    return false
  }
}

export async function getTwilioConfigByPhone(phoneNumber: string, supabase: any): Promise<{ data: any, error: any }> {
  try {
    const { data: clinicSettings, error } = await supabase
      .from('twilio_config')
      .select('clinic_id, twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('twilio_phone_number', phoneNumber)
      .eq('status', 'active')
      .single()

    return { data: clinicSettings, error }
  } catch (error) {
    logError(`Error getting Twilio config for phone ${phoneNumber}`, error)
    return { data: null, error }
  }
}

export async function getTwilioConfigByClinic(clinicId: string, supabase: any): Promise<{ data: any, error: any }> {
  try {
    const { data: fetchedSettings, error: settingsError } = await supabase
      .from('twilio_config')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('clinic_id', clinicId)
      .eq('status', 'active')
      .single()
      
    return { data: fetchedSettings, error: settingsError }
  } catch (error) {
    logError(`Error getting Twilio config for clinic ${clinicId}`, error)
    return { data: null, error }
  }
}

export async function processIncomingSMSWebhook(
  webhookData: TwilioWebhookData, 
  supabase: any
): Promise<{ success: boolean, lead_id?: string, thread_id?: string, message?: string, error?: string }> {
  try {
    // Find the clinic based on the Twilio phone number
    const { data: clinicSettings, error: clinicError } = await getTwilioConfigByPhone(webhookData.to, supabase)

    if (clinicError || !clinicSettings) {
      throw new Error('No clinic found with active Twilio settings for phone number: ' + webhookData.to)
    }

    // Find the lead by phone number
    const { data: lead, error: leadError } = await getLeadByPhone(webhookData.from, clinicSettings.clinic_id, supabase)

    if (leadError || !lead) {
      throw new Error('No lead found for this phone number')
    }

    // Get or create thread
    const threadId = await getOrCreateThread(lead, supabase)
    if (!threadId) {
      throw new Error('Failed to create or get thread')
    }

    // Save the incoming message
    const saveResult = await saveIncomingMessage(threadId, webhookData.body, supabase)
    if (!saveResult.success) {
      throw new Error('Failed to save incoming message')
    }

    // Update lead status to "Engaged" if currently "New"
    if (lead.status === 'New') {
      await updateLeadStatus(lead.id, 'Engaged', supabase)
    }

    return {
      success: true,
      lead_id: lead.id,
      thread_id: threadId,
      message: 'Message saved successfully'
    }

  } catch (error) {
    logError('Error processing incoming SMS webhook', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export async function processIncomingEmailWebhook(
  emailData: EmailWebhookData,
  supabase: any
): Promise<{ success: boolean, lead_id?: string, thread_id?: string, message?: string, error?: string }> {
  try {
    // Find the clinic based on the mailgun_email in the clinic table
    const { data: clinic, error: clinicError } = await getClinicByMailgunEmail(emailData.to, supabase)

    if (clinicError || !clinic) {
      throw new Error('No clinic found with mailgun email address: ' + emailData.to)
    }

    // Find the lead by email address
    const { data: lead, error: leadError } = await getLeadByEmail(emailData.from, clinic.id, supabase)

    if (leadError || !lead) {
      throw new Error('No lead found for this email address')
    }

    // Get or create thread
    const threadId = await getOrCreateThread(lead, supabase)
    if (!threadId) {
      throw new Error('Failed to create or get thread')
    }

    // Save the incoming email
    const emailMessage = `EMAIL RECEIVED - Subject: ${emailData.subject}\n\n${emailData.body}`
    const saveResult = await saveIncomingMessage(threadId, emailMessage, supabase)
    if (!saveResult.success) {
      throw new Error('Failed to save incoming email')
    }

    // Update lead status to "Engaged" if currently "New"
    if (lead.status === 'New') {
      await updateLeadStatus(lead.id, 'Engaged', supabase)
    }

    return {
      success: true,
      lead_id: lead.id,
      thread_id: threadId,
      message: 'Email saved successfully'
    }

  } catch (error) {
    logError('Error processing incoming email webhook', error)
    return {
      success: false,
      error: error.message
    }
  }
}