// _shared/nurturing.ts


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

// Updated follow-up rules with new SMS and Email schedule
const FOLLOW_UP_RULES: FollowUpRule[] = [
  // SMS FLOW
  // Initial contact after 5 minutes
  {
    name: 'sms_5min_initial',
    timeFromCreated: 5 * 60 * 1000, // 5 minutes
    leadStatus: ['New'],
    communicationType: 'sms',
    onlyOnce: true
  },
  
  // SMS after 2 days
  {
    name: 'sms_2day_followup',
    timeFromCreated: 2 * 24 * 60 * 60 * 1000, // 2 days
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // SMS after 5 days
  {
    name: 'sms_5day_followup',
    timeFromCreated: 5 * 24 * 60 * 60 * 1000, // 5 days
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // SMS after 10 days
  {
    name: 'sms_10day_followup',
    timeFromCreated: 10 * 24 * 60 * 60 * 1000, // 10 days
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // SMS after 20 days
  {
    name: 'sms_20day_followup',
    timeFromCreated: 20 * 24 * 60 * 60 * 1000, // 20 days
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // EMAIL FLOW (starts from day 21)
  // Day 21
  {
    name: 'email_21day_followup',
    timeFromCreated: 21 * 24 * 60 * 60 * 1000, // 21 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 24
  {
    name: 'email_24day_followup',
    timeFromCreated: 24 * 24 * 60 * 60 * 1000, // 24 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 27
  {
    name: 'email_27day_followup',
    timeFromCreated: 27 * 24 * 60 * 60 * 1000, // 27 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 30
  {
    name: 'email_30day_followup',
    timeFromCreated: 30 * 24 * 60 * 60 * 1000, // 30 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 33
  {
    name: 'email_33day_followup',
    timeFromCreated: 33 * 24 * 60 * 60 * 1000, // 33 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 36
  {
    name: 'email_36day_followup',
    timeFromCreated: 36 * 24 * 60 * 60 * 1000, // 36 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 39
  {
    name: 'email_39day_followup',
    timeFromCreated: 39 * 24 * 60 * 60 * 1000, // 39 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 42
  {
    name: 'email_42day_followup',
    timeFromCreated: 42 * 24 * 60 * 60 * 1000, // 42 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 45
  {
    name: 'email_45day_followup',
    timeFromCreated: 45 * 24 * 60 * 60 * 1000, // 45 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 50
  {
    name: 'email_50day_followup',
    timeFromCreated: 50 * 24 * 60 * 60 * 1000, // 50 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 55
  {
    name: 'email_55day_followup',
    timeFromCreated: 55 * 24 * 60 * 60 * 1000, // 55 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 60
  {
    name: 'email_60day_followup',
    timeFromCreated: 60 * 24 * 60 * 60 * 1000, // 60 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 70
  {
    name: 'email_70day_followup',
    timeFromCreated: 70 * 24 * 60 * 60 * 1000, // 70 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 80
  {
    name: 'email_80day_followup',
    timeFromCreated: 80 * 24 * 60 * 60 * 1000, // 80 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 90
  {
    name: 'email_90day_followup',
    timeFromCreated: 90 * 24 * 60 * 60 * 1000, // 90 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 100
  {
    name: 'email_100day_followup',
    timeFromCreated: 100 * 24 * 60 * 60 * 1000, // 100 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 110
  {
    name: 'email_110day_followup',
    timeFromCreated: 110 * 24 * 60 * 60 * 1000, // 110 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 115
  {
    name: 'email_115day_followup',
    timeFromCreated: 115 * 24 * 60 * 60 * 1000, // 115 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 118
  {
    name: 'email_118day_followup',
    timeFromCreated: 118 * 24 * 60 * 60 * 1000, // 118 days
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true
  },
  
  // Day 120
  {
    name: 'email_120day_followup',
    timeFromCreated: 120 * 24 * 60 * 60 * 1000, // 120 days
    communicationType: 'email',
    onlyOnce: true,
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
        
        // Generate message content using intelligent response
        const messageContent = await generateMessageContent(lead, clinic, rule, conversationHistory)
        
        // Send the message based on communication type
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
  logInfo(`Generating message content for ${rule.name}`)
  
  // Use the intelligent response generator
  return await generateIntelligentResponse(
    lead,
    clinic,
    conversationHistory,
    rule.communicationType === 'email'
  )
}

async function sendMessage(
  lead: Lead,
  clinic: Clinic,
  rule: FollowUpRule,
  messageContent: string | { subject: string, body: string },
  supabase: any
): Promise<{ success: boolean, error?: string }> {
  logInfo(`Sending ${rule.communicationType} message for ${rule.name} to lead ${lead.id}`)
  
  try {
    if (rule.communicationType === 'sms') {
      if (typeof messageContent === 'string') {
        return await sendSMS(lead.phone, messageContent, lead.clinic_id, supabase)
      } else {
        return { success: false, error: 'Invalid message format for SMS' }
      }
    } else if (rule.communicationType === 'email') {
      if (typeof messageContent === 'object' && messageContent.subject && messageContent.body) {
        return await sendEmail(
          lead.email!,
          messageContent.subject,
          messageContent.body,
          lead.clinic_id,
          supabase
        )
      } else {
        return { success: false, error: 'Invalid message format for email' }
      }
    } else {
      return { success: false, error: `Unsupported communication type: ${rule.communicationType}` }
    }
  } catch (error) {
    logError(`Error in sendMessage for lead ${lead.id}`, error)
    return { success: false, error: error.message }
  }
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

// Generate intelligent responses based on conversation history
async function generateIntelligentResponse(
  lead: Lead,
  clinic: Clinic,
  conversationHistory: Conversation[],
  isEmail: boolean = false
): Promise<string | { subject: string, body: string }> {
  logInfo(`Generating intelligent response for lead ${lead.id} in clinic ${clinic.name}`)
  
  // Use clinic-specific OpenAI key or fallback to global
  const OPENAI_API_KEY = clinic.openai_api_key || Deno.env.get('OPENAI_API_KEY')

  if (!OPENAI_API_KEY) {
    logInfo('No OpenAI API key found, using fallback message')
    const fallbackMessage = `Hi ${lead.first_name || 'there'}, thank you for your interest in ${clinic.name}. We're here to help with any questions you might have about our services.`
    
    if (isEmail) {
      return {
        subject: `Thank you for your interest in ${clinic.name}`,
        body: fallbackMessage
      }
    }
    return fallbackMessage
  }

  try {
    // Build conversation context from history
    const conversationContext = conversationHistory
      .map(msg => `${msg.sender_type === 'user' ? `Patient (${lead.first_name || 'Patient'})` : clinic.name}: ${msg.message}`)
      .join('\n')

    // Use clinic-specific assistant prompt if available
    const basePrompt = clinic.assistant_prompt || `You are a helpful AI assistant for ${clinic.name}, a healthcare clinic.`
    
    let systemPrompt = ''
    let userPrompt = ''

    if (isEmail) {
      systemPrompt = `${basePrompt}

You are responding to a patient via email. Based on the conversation history, generate an appropriate email response that:
1. Addresses any questions or concerns the patient has raised
2. Provides helpful and accurate information about healthcare services
3. Maintains a professional, caring, and empathetic tone
4. Includes relevant next steps or call-to-action if appropriate
5. Keeps the response concise but thorough (under 300 words)

Format your response as:
SUBJECT: [appropriate email subject line]
BODY: [email body content]`

      userPrompt = `Please generate an email response for ${lead.first_name || 'this patient'} based on the following conversation history at ${clinic.name}:

${conversationContext || 'No previous conversation - this is an initial follow-up email.'}

Patient Details:
- Name: ${lead.first_name || ''} ${lead.last_name || ''}
- Email: ${lead.email || 'N/A'}
- Phone: ${lead.phone || 'N/A'}
- Interest Level: ${lead.interest_level || 'N/A'}
- Urgency: ${lead.urgency || 'N/A'}`

    } else {
      systemPrompt = `${basePrompt}

You are responding to a patient via SMS. Based on the conversation history, generate an appropriate SMS response that:
1. Addresses any questions or concerns the patient has raised
2. Provides helpful information in a concise format (under 160 characters)
3. Maintains a friendly, professional tone
4. Includes a call-to-action if appropriate

Keep the response short and conversational for SMS format.`

      userPrompt = `Please generate an SMS response for ${lead.first_name || 'this patient'} based on the following conversation history at ${clinic.name}:

${conversationContext || 'No previous conversation - this is an initial welcome message.'}

Patient Details:
- Name: ${lead.first_name || ''} ${lead.last_name || ''}
- Interest Level: ${lead.interest_level || 'N/A'}
- Urgency: ${lead.urgency || 'N/A'}`
    }

    logInfo('Calling OpenAI API for intelligent response generation')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: clinic.assistant_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: isEmail ? 500 : 150,
        temperature: 0.7
      })
    })

    if (response.ok) {
      const data = await response.json()
      const generatedContent = data.choices[0]?.message?.content
      
      if (generatedContent) {
        if (isEmail) {
          // Parse email response
          const lines = generatedContent.split('\n')
          let subject = ''
          let body = ''
          let isBody = false

          for (const line of lines) {
            if (line.startsWith('SUBJECT:')) {
              subject = line.replace('SUBJECT:', '').trim()
            } else if (line.startsWith('BODY:')) {
              body = line.replace('BODY:', '').trim()
              isBody = true
            } else if (isBody) {
              body += '\n' + line
            }
          }

          if (subject && body) {
            logInfo('Successfully generated intelligent email response via OpenAI')
            return { subject, body: body.trim() }
          }
        } else {
          logInfo('Successfully generated intelligent SMS response via OpenAI')
          return generatedContent.trim()
        }
      }
    } else {
      logError('OpenAI API call failed', await response.text())
    }
  } catch (error) {
    logError('Error generating intelligent response with OpenAI', error)
  }

  // Fallback to simple response
  logInfo('Using fallback intelligent response')
  const fallbackMessage = `Hi ${lead.first_name || 'there'}, thank you for your interest in ${clinic.name}. We're here to help with any questions you might have about our services.`
  
  if (isEmail) {
    return {
      subject: `Thank you for your interest in ${clinic.name}`,
      body: fallbackMessage
    }
  }
  return fallbackMessage
}

// Enhanced sendSMS function
async function sendSMS(
  toPhone: string, 
  message: string, 
  clinicId: string, 
  supabase: any,
  twilioSettings?: any
): Promise<{ success: boolean, error?: string }> {
  logInfo(`Attempting to send SMS to ${toPhone} for clinic ${clinicId}`)
  
  try {
    let smsSettings = twilioSettings;
    
    if (!smsSettings) {
      const { data: fetchedSettings, error: settingsError } = await supabase
        .from('twilio_config')
        .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .single()
        
      if (settingsError) {
        logError('Error fetching Twilio settings', { clinicId, error: settingsError })
        return { success: false, error: `Error fetching Twilio settings: ${settingsError.message}` }
      }
      
      smsSettings = fetchedSettings
    }

    const missingFields = []
    if (!smsSettings?.twilio_account_sid) missingFields.push('twilio_account_sid')
    if (!smsSettings?.twilio_auth_token) missingFields.push('twilio_auth_token') 
    if (!smsSettings?.twilio_phone_number) missingFields.push('twilio_phone_number')

    if (missingFields.length > 0) {
      logError('Incomplete Twilio settings for clinic', { 
        clinicId, 
        missingFields
      })
      return { 
        success: false, 
        error: `Incomplete Twilio settings for clinic. Missing: ${missingFields.join(', ')}` 
      }
    }

    const { twilio_account_sid, twilio_auth_token, twilio_phone_number } = smsSettings

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilio_account_sid}:${twilio_auth_token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: twilio_phone_number,
        To: toPhone,
        Body: message
      })
    })

    if (response.ok) {
      const responseData = await response.json()
      logInfo('SMS sent successfully', { messageSid: responseData.sid })
      return { success: true }
    } else {
      const errorText = await response.text()
      logError('Twilio API call failed', { status: response.status, error: errorText })
      return { success: false, error: `Twilio API error (${response.status}): ${errorText}` }
    }
  } catch (error: any) {
    logError('Error sending SMS', error)
    return { success: false, error: error.message }
  }
}

// Enhanced sendEmail function using Mailgun
async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
  clinicId: string,
  supabase: any,
  emailSettings?: any
): Promise<{ success: boolean, error?: string }> {
  logInfo(`Attempting to send email to ${toEmail} for clinic ${clinicId}`);

  try {
    let settings = emailSettings;

    // Fetch settings from clinic table if not provided
    if (!settings) {
      const { data: fetchedSettings, error: settingsError } = await supabase
        .from('clinic')
        .select('mailgun_domain, mailgun_email')
        .eq('id', clinicId)
        .single();

      if (settingsError) {
        logError('Error fetching Mailgun settings from clinic table', { clinicId, error: settingsError });
        return { success: false, error: `Error fetching Mailgun settings: ${settingsError.message}` };
      }

      settings = fetchedSettings;
    }

    // Validate required fields
    const missingFields = [];
    if (!settings?.mailgun_domain) missingFields.push('mailgun_domain');
    if (!settings?.mailgun_email) missingFields.push('mailgun_email');

    if (missingFields.length > 0) {
      logError('Incomplete Mailgun settings for clinic', { 
        clinicId, 
        missingFields
      });
      return { 
        success: false, 
        error: `Incomplete Mailgun settings for clinic. Missing: ${missingFields.join(', ')}` 
      };
    }

    // Get Mailgun API key from environment
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY');
    if (!MAILGUN_API_KEY) {
      logError('MAILGUN_API_KEY environment variable not set');
      return { 
        success: false, 
        error: 'Mailgun API key not configured' 
      };
    }

    const { mailgun_domain, mailgun_email } = settings;

    logInfo('Sending email via Mailgun', {
      domain: mailgun_domain,
      from: mailgun_email,
      to: toEmail,
      subject: subject,
      contentLength: body.length,
      contentPreview: body.substring(0, 150)
    });

    // Prepare form data for Mailgun API
    const formData = new FormData();
    formData.append('from', mailgun_email);
    formData.append('to', toEmail);
    formData.append('subject', subject);
    formData.append('text', body);
    formData.append('html', body.replace(/\n/g, '<br>')); // Convert line breaks to HTML

    // Send via Mailgun API
    const response = await fetch(`https://api.mailgun.net/v3/${mailgun_domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
      },
      body: formData
    });

    if (response.ok) {
      const responseData = await response.json();
      logInfo('Email sent successfully via Mailgun', { 
        messageId: responseData.id,
        message: responseData.message 
      });
      return { success: true };
    } else {
      const errorText = await response.text();
      logError('Mailgun API call failed', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      
      let errorMessage = `Mailgun API error (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `Mailgun error: ${errorJson.message}`;
        }
      } catch (e) {
        // If response is not JSON, use the text
        errorMessage = `Mailgun error: ${errorText}`;
      }

      return { 
        success: false, 
        error: errorMessage 
      };
    }

  } catch (error: any) {
    logError('Error sending email via Mailgun', error);
    return {
      success: false,
      error: error.message,
      troubleshooting: {
        issues: [
          {
            issue: 'Mailgun API failure',
            solutions: [
              'Verify MAILGUN_API_KEY environment variable is set',
              'Check mailgun_domain is correct and verified in Mailgun',
              'Ensure mailgun_email is authorized sender in Mailgun',
              'Verify network connectivity to api.mailgun.net'
            ]
          }
        ],
        tips: [
          'Check Mailgun dashboard for sending limits and account status',
          'Verify domain DNS settings are configured correctly',
          'Review clinic table mailgun configuration',
          'Monitor Mailgun logs for detailed error information'
        ]
      }
    };
  }
}

// Handle Twilio webhook - save incoming messages and update lead status
async function handleTwilioWebhook(formData: FormData, supabase: any) {
  logInfo('Handling Twilio webhook')
  
  const twilioData = {
    from: formData.get('From') as string,
    to: formData.get('To') as string,
    body: formData.get('Body') as string,
    messageSid: formData.get('MessageSid') as string,
    accountSid: formData.get('AccountSid') as string
  }

  logInfo('Twilio webhook data', twilioData)

  if (!twilioData.from || !twilioData.to || !twilioData.body || !twilioData.messageSid || !twilioData.accountSid) {
    throw new Error('Invalid Twilio webhook data: missing required fields')
  }

  // Find the clinic based on the Twilio phone number
  const { data: clinicSettings } = await supabase
    .from('twilio_config')
    .select('clinic_id, twilio_account_sid, twilio_auth_token, twilio_phone_number')
    .eq('twilio_phone_number', twilioData.to)
    .eq('status', 'active')
    .single()

  if (!clinicSettings) {
    throw new Error('No clinic found with active Twilio settings for phone number: ' + twilioData.to)
  }

  // Find the lead by phone number
  const { data: lead } = await supabase
    .from('lead')
    .select('*')
    .eq('phone', twilioData.from)
    .eq('clinic_id', clinicSettings.clinic_id)
    .single()

  if (!lead) {
    logError(`No lead found with phone ${twilioData.from} for clinic ${clinicSettings.clinic_id}`)
    throw new Error('No lead found for this phone number')
  }

  // Get or create thread
  let thread = null
  const { data: existingThread } = await supabase
    .from('threads')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('clinic_id', clinicSettings.clinic_id)
    .single()

  if (existingThread) {
    thread = existingThread
    logInfo('Using existing thread', { threadId: thread.id })
  } else {
    logInfo('Creating new thread for incoming message')
    const { data: createdThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        lead_id: lead.id,
        clinic_id: clinicSettings.clinic_id,
        status: 'new'
      })
      .select()
      .single()

    if (threadError) throw threadError
    thread = createdThread
    logInfo('New thread created', { threadId: thread.id })
  }

  // Save the incoming message
  logInfo('Saving incoming message to conversation')
  await supabase
    .from('conversation')
    .insert({
      thread_id: thread.id,
      message: twilioData.body,
      timestamp: new Date().toISOString(),
      is_from_user: true,
      sender_type: 'user'
    })

  // Update lead status to "Engaged" if currently "New"
  if (lead.status === 'New') {
    await supabase
      .from('lead')
      .update({ 
        status: 'Engaged',
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id)
    
    logInfo(`Updated lead ${lead.id} status from New to Engaged`)
  }

  logInfo('Twilio webhook processed successfully')
  return {
    success: true,
    lead_id: lead.id,
    thread_id: thread.id,
    message: 'Message saved successfully'
  }
}

async function handleEmailWebhook(emailData: any, supabase: any) {
  logInfo('Handling email webhook')
  
  if (!emailData.from || !emailData.to || !emailData.subject || !emailData.body) {
    throw new Error('Invalid email webhook data: missing required fields')
  }

  // Find the clinic based on the mailgun_email in the clinic table
  const { data: clinic } = await supabase
    .from('clinic')
    .select('id, mailgun_email')
    .eq('mailgun_email', emailData.to)
    .single()

  if (!clinic) {
    throw new Error('No clinic found with mailgun email address: ' + emailData.to)
  }

  // Find the lead by email address
  const { data: lead } = await supabase
    .from('lead')
    .select('*')
    .eq('email', emailData.from)
    .eq('clinic_id', clinic.id)
    .single()

  if (!lead) {
    logError(`No lead found with email ${emailData.from} for clinic ${clinic.id}`)
    throw new Error('No lead found for this email address')
  }

  // Get or create thread
  let thread = null
  const { data: existingThread } = await supabase
    .from('threads')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('clinic_id', clinic.id)
    .single()

  if (existingThread) {
    thread = existingThread
    logInfo('Using existing thread', { threadId: thread.id })
  } else {
    logInfo('Creating new thread for incoming email')
    const { data: createdThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        lead_id: lead.id,
        clinic_id: clinic.id,
        status: 'new'
      })
      .select()
      .single()

    if (threadError) throw threadError
    thread = createdThread
    logInfo('New thread created', { threadId: thread.id })
  }

  // Save the incoming email
  logInfo('Saving incoming email to conversation')
  const emailMessage = `EMAIL RECEIVED - Subject: ${emailData.subject}\n\n${emailData.body}`
  
  await supabase
    .from('conversation')
    .insert({
      thread_id: thread.id,
      message: emailMessage,
      timestamp: new Date().toISOString(),
      is_from_user: true,
      sender_type: 'user'
    })

  // Update lead status to "Engaged" if currently "New"
  if (lead.status === 'New') {
    await supabase
      .from('lead')
      .update({ 
        status: 'Engaged',
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id)
    
    logInfo(`Updated lead ${lead.id} status from New to Engaged`)
  }

  logInfo('Email webhook processed successfully')
  return {
    success: true,
    lead_id: lead.id,
    thread_id: thread.id,
    message: 'Email saved successfully'
  }
}

// Update the export statement at the bottom
export { 
  processAllLeads, 
  FOLLOW_UP_RULES, 
  determineFollowUpsForLead,
  generateIntelligentResponse,
  sendSMS,
  sendEmail,
  handleTwilioWebhook,
  handleEmailWebhook
}