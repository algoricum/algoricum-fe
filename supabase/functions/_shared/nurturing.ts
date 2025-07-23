
interface Lead {
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


interface Conversation {
  id?: string
  thread_id: string
  message: string
  timestamp: string
  created_at: string
  updated_at: string
  is_from_user: boolean
  sender_type: 'user' | 'assistant'
}

interface Clinic {
  id: string
  name: string
  openai_api_key?: string
  assistant_prompt?: string
  assistant_model?: string
  chatbot_name?: string
}

interface FollowUpRule {
  name: string
  timeFromCreated: number // milliseconds
  maxTimeFromCreated?: number // milliseconds (optional upper bound)
  leadStatus?: string[] // which lead statuses to target
  communicationType: 'sms' | 'email'
  onlyOnce: boolean // should this follow-up only be sent once
  checkLastActivity?: boolean // should we check if user replied after last assistant message
}

interface ProcessingResult {
  leadId: string
  action: 'sent' | 'skipped' | 'error'
  reason: string
  followUpType: string
  communicationType: 'sms' | 'email'
  error?: string
}

// Enhanced logging function
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] ERROR: ${message}`, error)
}

// Define follow-up rules - this is where all the logic lives
const FOLLOW_UP_RULES: FollowUpRule[] = [
  // Initial contact for new leads
  {
    name: 'initial_contact',
    timeFromCreated: 5 * 60 * 1000, // 5 minutes
    leadStatus: ['New'],
    communicationType: 'sms',
    onlyOnce: true
  },
  
  // 4-hour follow-up for engaged leads
  {
    name: '4h_followup',
    timeFromCreated: 4 * 60 * 60 * 1000, // 4 hours
    maxTimeFromCreated: 24 * 60 * 60 * 1000, // 24 hours max
    leadStatus: ['Engaged'],
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // 2-day email follow-up
  {
    name: '2d_email_followup',
    timeFromCreated: 48 * 60 * 60 * 1000, // 48 hours
    maxTimeFromCreated: 7 * 24 * 60 * 60 * 1000, // 7 days max
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // 7-day email follow-up
  {
    name: '7d_email_followup',
    timeFromCreated: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxTimeFromCreated: 14 * 24 * 60 * 60 * 1000, // 14 days max
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // 14-day email follow-up
  {
    name: '14d_email_followup',
    timeFromCreated: 14 * 24 * 60 * 60 * 1000, // 14 days
    maxTimeFromCreated: 30 * 24 * 60 * 60 * 1000, // 30 days max
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // 30-day email follow-up (recurring weekly)
  {
    name: '30d_email_followup',
    timeFromCreated: 30 * 24 * 60 * 60 * 1000, // 30 days
    communicationType: 'email',
    onlyOnce: false, // Can send multiple times
    checkLastActivity: true
  }
]

// Core function to determine which follow-ups a lead should receive
async function determineFollowUpsForLead(
  lead: Lead,
  supabase: any,
  communicationType?: 'sms' | 'email'
): Promise<FollowUpRule[]> {
  const now = new Date()
  const leadCreatedAt = new Date(lead.created_at)
  const timeSinceCreated = now.getTime() - leadCreatedAt.getTime()
  
  const applicableRules: FollowUpRule[] = []
  
  for (const rule of FOLLOW_UP_RULES) {
    // Filter by communication type if specified
    if (communicationType && rule.communicationType !== communicationType) {
      continue
    }
    
    // Check if lead status matches (if rule specifies status requirements)
    if (rule.leadStatus && !rule.leadStatus.includes(lead.status)) {
      continue
    }
    
    // Check if enough time has passed since lead creation
    if (timeSinceCreated < rule.timeFromCreated) {
      continue
    }
    
    // Check if too much time has passed (if rule has max time)
    if (rule.maxTimeFromCreated && timeSinceCreated > rule.maxTimeFromCreated) {
      continue
    }
    
    // Check if this follow-up has already been sent (if onlyOnce is true)
    if (rule.onlyOnce) {
      const alreadySent = await hasFollowUpBeenSent(lead.id, rule.name, supabase)
      if (alreadySent) {
        continue
      }
    }
    
    // For 30-day recurring follow-ups, check if one was sent recently
    if (!rule.onlyOnce && rule.name === '30d_email_followup') {
      const recentlySent = await hasRecentFollowUp(lead.id, rule.name, 7 * 24 * 60 * 60 * 1000, supabase) // 7 days
      if (recentlySent) {
        continue
      }
    }
    
    // Check if user has replied after last assistant message (if rule requires it)
    if (rule.checkLastActivity) {
      const hasUserReplied = await hasUserRepliedToLastAssistantMessage(lead.id, supabase)
      if (hasUserReplied) {
        continue // Skip if user already replied
      }
    }
    
    applicableRules.push(rule)
  }
  
  return applicableRules
}

// Check if a specific follow-up has already been sent
async function hasFollowUpBeenSent(leadId: string, followUpName: string, supabase: any): Promise<boolean> {
  try {
    // Get thread for this lead
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
    // Check if this follow-up type has been sent
    const { data: conversations } = await supabase
      .from('conversation')
      .select('id')
      .eq('thread_id', thread.id)
      .eq('is_from_user', false)
      .eq('sender_type', 'assistant')
      .ilike('message', `%${followUpName}%`)
    
    return conversations && conversations.length > 0
    
  } catch (error) {
    logError(`Error checking if follow-up ${followUpName} was sent for lead ${leadId}`, error)
    return false
  }
}

// Check if a follow-up was sent recently (for recurring follow-ups)
async function hasRecentFollowUp(leadId: string, followUpName: string, timeWindow: number, supabase: any): Promise<boolean> {
  try {
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
    const timeThreshold = new Date(Date.now() - timeWindow).toISOString()
    
    const { data: conversations } = await supabase
      .from('conversation')
      .select('id')
      .eq('thread_id', thread.id)
      .eq('is_from_user', false)
      .eq('sender_type', 'assistant')
      .ilike('message', `%${followUpName}%`)
      .gte('created_at', timeThreshold)
    
    return conversations && conversations.length > 0
    
  } catch (error) {
    logError(`Error checking recent follow-up ${followUpName} for lead ${leadId}`, error)
    return false
  }
}

// Check if user replied after the last assistant message
async function hasUserRepliedToLastAssistantMessage(leadId: string, supabase: any): Promise<boolean> {
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

// Get all leads that need processing based on the rules
async function getLeadsForProcessing(supabase: any, communicationType?: 'sms' | 'email'): Promise<Lead[]> {
  logInfo(`Fetching leads for processing - communication type: ${communicationType || 'all'}`)
  
  try {
    // Get all clinics first
    const { data: clinics, error: clinicError } = await supabase
      .from('clinic')
      .select('id')
    
    if (clinicError) {
      logError('Error fetching clinics', clinicError)
      return []
    }
    
    if (!clinics || clinics.length === 0) {
      logInfo('No clinics found')
      return []
    }
    
    // Get all leads from all clinics that have required contact info
    let leadQuery = supabase
      .from('lead')
      .select('*')
      .in('clinic_id', clinics.map(c => c.id))
    
    // Filter by communication type requirements
    if (communicationType === 'sms') {
      leadQuery = leadQuery
        .not('phone', 'is', null)
        .neq('phone', '')
    } else if (communicationType === 'email') {
      leadQuery = leadQuery
        .not('email', 'is', null)
        .neq('email', '')
    } else {
      // For 'all', we need either phone or email
      leadQuery = leadQuery
        .or('phone.not.is.null,email.not.is.null')
    }
    
    const { data: leads, error: leadsError } = await leadQuery
    
    if (leadsError) {
      logError('Error fetching leads', leadsError)
      return []
    }
    
    logInfo(`Found ${leads?.length || 0} leads with required contact info`)
    return leads || []
    
  } catch (error) {
    logError('Error in getLeadsForProcessing', error)
    return []
  }
}

// Process a single lead and return the result
async function processLead(
  lead: Lead,
  clinic: Clinic,
  supabase: any,
  communicationType?: 'sms' | 'email'
): Promise<ProcessingResult[]> {
  logInfo(`Processing lead ${lead.id} for clinic ${clinic.name}`)
  
  const results: ProcessingResult[] = []
  
  try {
    // Determine which follow-ups this lead should receive
    const applicableRules = await determineFollowUpsForLead(lead, supabase, communicationType)
    
    if (applicableRules.length === 0) {
      results.push({
        leadId: lead.id,
        action: 'skipped',
        reason: 'No applicable follow-up rules',
        followUpType: 'none',
        communicationType: communicationType || 'any'
      })
      return results
    }
    
    logInfo(`Lead ${lead.id} has ${applicableRules.length} applicable follow-up rules`)
    
    // Process each applicable follow-up rule
    for (const rule of applicableRules) {
      try {
        // Check if lead has required contact info for this communication type
        const hasContactInfo = (rule.communicationType === 'sms' && lead.phone) || 
                             (rule.communicationType === 'email' && lead.email)
        
        if (!hasContactInfo) {
          results.push({
            leadId: lead.id,
            action: 'skipped',
            reason: `Missing ${rule.communicationType} contact info`,
            followUpType: rule.name,
            communicationType: rule.communicationType
          })
          continue
        }
        
        // Get or create thread
        const threadId = await getOrCreateThread(lead, supabase)
        if (!threadId) {
          results.push({
            leadId: lead.id,
            action: 'error',
            reason: 'Failed to get or create thread',
            followUpType: rule.name,
            communicationType: rule.communicationType,
            error: 'Thread creation failed'
          })
          continue
        }
        
        // Get conversation history for context
        const conversationHistory = await getConversationHistory(threadId, supabase)
        
        // Generate message content (this will be implemented later)
        const messageContent = await generateMessageContent(lead, clinic, rule, conversationHistory)
        
        // Send the message (this will be implemented later based on communication type)
        const sendResult = await sendMessage(lead, clinic, rule, messageContent, supabase)
        
        if (sendResult.success) {
          // Save the message to conversation history
          await saveMessageToHistory(threadId, messageContent, rule.name, supabase)
          
          results.push({
            leadId: lead.id,
            action: 'sent',
            reason: `Successfully sent ${rule.name}`,
            followUpType: rule.name,
            communicationType: rule.communicationType
          })
          
          logInfo(`Successfully sent ${rule.name} to lead ${lead.id}`)
        } else {
          results.push({
            leadId: lead.id,
            action: 'error',
            reason: `Failed to send ${rule.name}`,
            followUpType: rule.name,
            communicationType: rule.communicationType,
            error: sendResult.error
          })
          
          logError(`Failed to send ${rule.name} to lead ${lead.id}`, sendResult.error)
        }
        
      } catch (error) {
        logError(`Error processing rule ${rule.name} for lead ${lead.id}`, error)
        results.push({
          leadId: lead.id,
          action: 'error',
          reason: `Exception while processing ${rule.name}`,
          followUpType: rule.name,
          communicationType: rule.communicationType,
          error: error.message
        })
      }
    }
    
  } catch (error) {
    logError(`Error processing lead ${lead.id}`, error)
    results.push({
      leadId: lead.id,
      action: 'error',
      reason: 'Exception during lead processing',
      followUpType: 'unknown',
      communicationType: communicationType || 'any',
      error: error.message
    })
  }
  
  return results
}

// Get or create thread for a lead
async function getOrCreateThread(lead: Lead, supabase: any): Promise<string | null> {
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

// Get conversation history for a thread
async function getConversationHistory(threadId: string, supabase: any): Promise<Conversation[]> {
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

// Placeholder functions that will be implemented later

async function generateMessageContent(
  lead: Lead,
  clinic: Clinic,
  rule: FollowUpRule,
  conversationHistory: Conversation[]
): Promise<string | { subject: string, body: string }> {
  // This will be implemented with OpenAI integration
  logInfo(`Generating message content for ${rule.name}`)
  
  const fallbackMessage = `Hi ${lead.first_name || 'there'}, this is a ${rule.name} message from ${clinic.name}.`
  
  if (rule.communicationType === 'email') {
    return {
      subject: `Follow-up from ${clinic.name}`,
      body: fallbackMessage
    }
  }
  
  return fallbackMessage
}

async function sendMessage(
  lead: Lead,
  clinic: Clinic,
  rule: FollowUpRule,
  messageContent: string | { subject: string, body: string },
  supabase: any
): Promise<{ success: boolean, error?: string }> {
  // This will be implemented with actual SMS/Email sending
  logInfo(`Sending ${rule.communicationType} message for ${rule.name} to lead ${lead.id}`)
  
  // Simulate success for now
  return { success: true }
}

async function saveMessageToHistory(
  threadId: string,
  messageContent: string | { subject: string, body: string },
  followUpType: string,
  supabase: any
): Promise<void> {
  try {
    const now = new Date().toISOString()
    let messageText = ''
    
    if (typeof messageContent === 'string') {
      messageText = messageContent
    } else {
      messageText = `EMAIL SENT (${followUpType}) - Subject: ${messageContent.subject}\n\n${messageContent.body}`
    }
    
    await supabase
      .from('conversation')
      .insert({
        thread_id: threadId,
        message: messageText,
        timestamp: now,
        is_from_user: false,
        sender_type: 'assistant'
      })
    
    logInfo(`Saved message to history for thread ${threadId}`)
    
  } catch (error) {
    logError(`Error saving message to history for thread ${threadId}`, error)
  }
}

// Main processing function
async function processAllLeads(supabase: any, communicationType?: 'sms' | 'email') {
  logInfo(`=== Starting Lead Processing - Type: ${communicationType || 'all'} ===`)
  
  try {
    // Get all leads that need processing
    const leads = await getLeadsForProcessing(supabase, communicationType)
    
    if (leads.length === 0) {
      logInfo('No leads found for processing')
      return {
        success: true,
        totalLeads: 0,
        results: [],
        summary: {
          sent: 0,
          skipped: 0,
          errors: 0
        }
      }
    }
    
    logInfo(`Processing ${leads.length} leads`)
    
    // Get all clinics for context
    const { data: clinics } = await supabase
      .from('clinic')
      .select('id, name, openai_api_key, assistant_prompt, assistant_model, chatbot_name')
    
    const clinicMap = new Map(clinics?.map(c => [c.id, c]) || [])
    
    // Process each lead
    const allResults: ProcessingResult[] = []
    
    for (const lead of leads) {
      const clinic = clinicMap.get(lead.clinic_id)
      if (!clinic) {
        allResults.push({
          leadId: lead.id,
          action: 'error',
          reason: 'Clinic not found',
          followUpType: 'unknown',
          communicationType: communicationType || 'any',
          error: `Clinic ${lead.clinic_id} not found`
        })
        continue
      }
      
      const leadResults = await processLead(lead, clinic, supabase, communicationType)
      allResults.push(...leadResults)
    }
    
    // Calculate summary
    const summary = {
      sent: allResults.filter(r => r.action === 'sent').length,
      skipped: allResults.filter(r => r.action === 'skipped').length,
      errors: allResults.filter(r => r.action === 'error').length
    }
    
    logInfo('Lead processing completed', summary)
    
    return {
      success: true,
      totalLeads: leads.length,
      results: allResults,
      summary
    }
    
  } catch (error) {
    logError('Error in processAllLeads', error)
    return {
      success: false,
      error: error.message,
      totalLeads: 0,
      results: [],
      summary: {
        sent: 0,
        skipped: 0,
        errors: 1
      }
    }
  }
}

// Export the main function for testing
export { processAllLeads, FOLLOW_UP_RULES, determineFollowUpsForLead }