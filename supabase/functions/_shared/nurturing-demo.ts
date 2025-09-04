// _shared/nurturing-demo.ts

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
  mailgun_domain?: string
  mailgun_email?: string
  calendly_link?: string
  twilio_config?: Array<{
    twilio_account_sid: string
    twilio_auth_token: string
    twilio_phone_number: string
    status: string
  }>
}

interface FollowUpRule {
  name: string
  timeFromCreated: number // milliseconds
  maxTimeFromCreated?: number // milliseconds
  leadStatus?: string[] // which lead statuses to target
  communicationType: 'sms' | 'email'
  onlyOnce: boolean
  checkLastActivity?: boolean
  toleranceWindow?: number // NEW: Added tolerance window for 5-minute scheduling
}

interface ProcessingResult {
  leadId: string
  action: 'sent' | 'skipped' | 'error'
  reason: string
  followUpType: string
  communicationType: 'sms' | 'email'
  error?: string
}

// Enhanced logging
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] SHARED: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] SHARED ERROR: ${message}`, error)
}

// Complete follow-up rules - ONLY ADDED tolerance windows, everything else stays the same
const FOLLOW_UP_RULES: FollowUpRule[] = [
  // SMS FLOW - All set to 3 minutes
  {
    name: 'sms_5min_initial',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 5 minutes)
    leadStatus: ['New'],
    communicationType: 'sms',
    onlyOnce: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_2day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 2 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_5day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 5 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_10day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 10 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_20day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 20 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  
  // EMAIL FLOW - All set to 3 minutes (changed from day-based schedule)
  {
    name: 'email_21day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 21 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_24day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 24 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_27day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 27 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_30day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 30 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_33day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 33 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_36day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 36 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_39day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 39 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_42day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 42 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_45day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 45 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_50day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 50 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_55day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 55 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_60day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 60 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_70day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 70 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_80day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 80 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_90day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 90 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_100day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 100 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_110day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 110 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_115day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 115 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_118day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 118 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_120day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 120 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  }
]

// NEW FUNCTION: Process leads that are due within the next 5 minutes
async function processScheduledFollowUps(supabase: any, communicationType?: 'sms' | 'email') {
  logInfo(`=== Starting processScheduledFollowUps - Type: ${communicationType || 'all'} ===`)
  
  const allResults: ProcessingResult[] = []
  let totalProcessed = 0
  let totalErrors = 0
  
  try {
    // Get ALL clinics with their settings (same as original)
   const { data: clinics, error: clinicError } = await supabase
    .from("clinic")
    .select(`
      id,
      name,
      openai_api_key,
      assistant_prompt,
      assistant_model,
      chatbot_name,
      mailgun_domain,
      mailgun_email,
      calendly_link,
      clinic_type,
      twilio_config(
        twilio_account_sid,
        twilio_auth_token,
        twilio_phone_number,
        status
      ),
      assistants(
        assistant_name
      )
    `);

    if (clinicError) {
      logError('Failed to fetch clinics', clinicError)
      return {
        success: false,
        error: 'Failed to fetch clinics',
        results: [],
        summary: { sent: 0, skipped: 0, errors: 1 }
      }
    }

    if (!clinics || clinics.length === 0) {
      logInfo('No clinics found')
      return {
        success: true,
        results: [],
        summary: { sent: 0, skipped: 0, errors: 0 }
      }
    }

    logInfo(`Processing ${clinics.length} clinics for scheduled follow-ups`)

    // Process each clinic independently - errors in one don't affect others
    for (const clinic of clinics) {
      try {
        logInfo(`Processing clinic: ${clinic.name} (${clinic.id})`)
        
        // Get leads that are due for follow-ups within tolerance windows
        const leads = await getLeadsDueForFollowUp(clinic.id, supabase, communicationType)
        
        if (leads.length === 0) {
          logInfo(`No leads due for follow-up in clinic ${clinic.name}`)
          continue
        }

        logInfo(`Found ${leads.length} leads due for follow-up in clinic ${clinic.name}`)

        // Process each lead (using your original logic)
        for (const lead of leads) {
          try {
            const leadResults = await processLeadForClinic(lead, clinic, supabase)
            allResults.push(...leadResults)
            totalProcessed++
          } catch (leadError) {
            logError(`Error processing lead ${lead.id}`, leadError)
            totalErrors++
            allResults.push({
              leadId: lead.id,
              action: 'error',
              reason: 'Lead processing failed',
              followUpType: 'unknown',
              communicationType: communicationType || 'any',
              error: leadError.message
            })
          }
        }

      } catch (clinicError) {
        logError(`Error processing clinic ${clinic.id}`, clinicError)
        totalErrors++
        // Continue with next clinic - don't let one clinic's error stop everything
      }
    }

    // Calculate final summary
    const summary = {
      sent: allResults.filter(r => r.action === 'sent').length,
      skipped: allResults.filter(r => r.action === 'skipped').length,
      errors: allResults.filter(r => r.action === 'error').length
    }

    logInfo(`Scheduled processing completed: ${totalProcessed} leads processed, ${totalErrors} lead errors`)
    logInfo('Final summary', summary)

    return {
      success: true,
      results: allResults,
      summary,
      totalLeads: totalProcessed
    }

  } catch (error: any) {
    logError('Error in processScheduledFollowUps', error)
    return {
      success: false,
      error: error.message,
      results: allResults,
      summary: { sent: 0, skipped: 0, errors: 1 }
    }
  }
}

// NEW FUNCTION: Get leads that are due for follow-up within tolerance windows
async function getLeadsDueForFollowUp(clinicId: string, supabase: any, communicationType?: 'sms' | 'email'): Promise<Lead[]> {
  try {
    const now = new Date()
    const eligibleLeads: Lead[] = []
    
    // Check each rule to see if any leads fall within the tolerance window
    for (const rule of FOLLOW_UP_RULES) {
      // Skip if communication type filter is specified and doesn't match
      if (communicationType && rule.communicationType !== communicationType) {
        continue
      }
      
      const toleranceWindow = rule.toleranceWindow || 5 * 60 * 1000 // Default 5 minutes
      const targetTime = rule.timeFromCreated
      const minTime = targetTime - toleranceWindow
      const maxTime = targetTime + toleranceWindow
      
      // Calculate date range for leads that should receive this follow-up
      const minDate = new Date(now.getTime() - maxTime)
      const maxDate = new Date(now.getTime() - minTime)
      
      let leadQuery = supabase
        .from('lead')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('created_at', minDate.toISOString())
        .lte('created_at', maxDate.toISOString())

      // Filter by lead status if rule specifies
      if (rule.leadStatus && rule.leadStatus.length > 0) {
        leadQuery = leadQuery.in('status', rule.leadStatus)
      }

      // Filter by communication requirements
      if (rule.communicationType === 'sms') {
        leadQuery = leadQuery.not('phone', 'is', null).neq('phone', '')
      } else if (rule.communicationType === 'email') {
        leadQuery = leadQuery.not('email', 'is', null).neq('email', '')
      }

      const { data: leads, error } = await leadQuery

      if (error) {
        logError(`Error fetching leads for rule ${rule.name} in clinic ${clinicId}`, error)
        continue
      }

      if (leads && leads.length > 0) {
        // Filter out leads that already received this follow-up or have replied
        for (const lead of leads) {
          // Check if this follow-up has already been sent
          if (rule.onlyOnce && await hasFollowUpBeenSent(lead.id, rule.name, supabase)) {
            continue
          }
          
          // Check if user has replied after last assistant message
          if (rule.checkLastActivity && await hasUserRepliedToLastAssistantMessage(lead.id, supabase)) {
            continue
          }
          
          eligibleLeads.push(lead)
        }
      }
    }
    
    // Remove duplicates (in case a lead qualifies for multiple rules)
    const uniqueLeads = eligibleLeads.filter((lead, index, self) => 
      self.findIndex(l => l.id === lead.id) === index
    )
    
    return uniqueLeads

  } catch (error) {
    logError(`Error in getLeadsDueForFollowUp for clinic ${clinicId}`, error)
    return []
  }
}

// ORIGINAL FUNCTIONS - Keep exactly as they are, no changes

// MAIN PROCESSING FUNCTION - Processes ALL clinics (ORIGINAL - unchanged)
async function processAllLeads(supabase: any, communicationType?: 'sms' | 'email') {
  logInfo(`=== Starting processAllLeads - Type: ${communicationType || 'all'} ===`)
  
  const allResults: ProcessingResult[] = []
  let totalProcessed = 0
  let totalErrors = 0
  
  try {
    // Get ALL clinics with their settings
    const { data: clinics, error: clinicError } = await supabase
    .from("clinic")
    .select(`
      id,
      name,
      openai_api_key,
      assistant_prompt,
      assistant_model,
      chatbot_name,
      mailgun_domain,
      mailgun_email,
      calendly_link,
      clinic_type,
      twilio_config(
        twilio_account_sid,
        twilio_auth_token,
        twilio_phone_number,
        status
      ),
      assistants(
        assistant_name
      )
    `);

    if (clinicError) {
      logError('Failed to fetch clinics', clinicError)
      return {
        success: false,
        error: 'Failed to fetch clinics',
        results: [],
        summary: { sent: 0, skipped: 0, errors: 1 }
      }
    }

    if (!clinics || clinics.length === 0) {
      logInfo('No clinics found')
      return {
        success: true,
        results: [],
        summary: { sent: 0, skipped: 0, errors: 0 }
      }
    }

    logInfo(`Processing ${clinics.length} clinics`)

    // Process each clinic independently - errors in one don't affect others
    for (const clinic of clinics) {
      try {
        logInfo(`Processing clinic: ${clinic.name} (${clinic.id})`)
        
        // Get leads for this clinic
        const leads = await getLeadsForClinic(clinic.id, supabase, communicationType)
        
        if (leads.length === 0) {
          logInfo(`No leads found for clinic ${clinic.name}`)
          continue
        }

        logInfo(`Found ${leads.length} leads for clinic ${clinic.name}`)

        // Process each lead
        for (const lead of leads) {
          try {
            const leadResults = await processLeadForClinic(lead, clinic, supabase)
            allResults.push(...leadResults)
            totalProcessed++
          } catch (leadError) {
            logError(`Error processing lead ${lead.id}`, leadError)
            totalErrors++
            allResults.push({
              leadId: lead.id,
              action: 'error',
              reason: 'Lead processing failed',
              followUpType: 'unknown',
              communicationType: communicationType || 'any',
              error: leadError.message
            })
          }
        }

      } catch (clinicError) {
        logError(`Error processing clinic ${clinic.id}`, clinicError)
        totalErrors++
        // Continue with next clinic - don't let one clinic's error stop everything
      }
    }

    // Calculate final summary
    const summary = {
      sent: allResults.filter(r => r.action === 'sent').length,
      skipped: allResults.filter(r => r.action === 'skipped').length,
      errors: allResults.filter(r => r.action === 'error').length
    }

    logInfo(`Processing completed: ${totalProcessed} leads processed, ${totalErrors} lead errors`)
    logInfo('Final summary', summary)

    return {
      success: true,
      results: allResults,
      summary,
      totalLeads: totalProcessed
    }

  } catch (error: any) {
    logError('Error in processAllLeads', error)
    return {
      success: false,
      error: error.message,
      results: allResults,
      summary: { sent: 0, skipped: 0, errors: 1 }
    }
  }
}

// Get leads for a specific clinic (ORIGINAL - unchanged)
async function getLeadsForClinic(clinicId: string, supabase: any, communicationType?: 'sms' | 'email'): Promise<Lead[]> {
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

// Process a single lead for a clinic (ORIGINAL - unchanged)
async function processLeadForClinic(lead: Lead, clinic: Clinic, supabase: any): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = []
  
  try {
    // Get applicable follow-up rules for this lead
    const applicableRules = await determineFollowUpsForLead(lead, supabase)
    
    if (applicableRules.length === 0) {
      return [{
        leadId: lead.id,
        action: 'skipped',
        reason: 'No applicable follow-up rules',
        followUpType: 'none',
        communicationType: 'any'
      }]
    }

    // Check clinic capabilities
    const hasSMS = clinic.twilio_config && 
                  clinic.twilio_config.length > 0 && 
                  clinic.twilio_config[0]?.status === 'active'
    
    const hasEmail = clinic.mailgun_domain && clinic.mailgun_email

    // Process each rule
    for (const rule of applicableRules) {
      try {
        // Check clinic capabilities for this communication type
        if (rule.communicationType === 'sms' && !hasSMS) {
          results.push({
            leadId: lead.id,
            action: 'skipped',
            reason: 'Clinic SMS not configured',
            followUpType: rule.name,
            communicationType: rule.communicationType
          })
          continue
        }

        if (rule.communicationType === 'email' && !hasEmail) {
          results.push({
            leadId: lead.id,
            action: 'skipped',
            reason: 'Clinic email not configured',
            followUpType: rule.name,
            communicationType: rule.communicationType
          })
          continue
        }

        // Check lead has required contact info
        const hasRequiredContact = 
          (rule.communicationType === 'sms' && lead.phone) ||
          (rule.communicationType === 'email' && lead.email)

        if (!hasRequiredContact) {
          results.push({
            leadId: lead.id,
            action: 'skipped',
            reason: `Lead missing ${rule.communicationType} contact`,
            followUpType: rule.name,
            communicationType: rule.communicationType
          })
          continue
        }

        // Process this rule
        const result = await processRuleForLead(lead, clinic, rule, supabase)
        results.push(result)

      } catch (ruleError) {
        logError(`Error processing rule ${rule.name} for lead ${lead.id}`, ruleError)
        results.push({
          leadId: lead.id,
          action: 'error',
          reason: `Rule processing failed: ${ruleError.message}`,
          followUpType: rule.name,
          communicationType: rule.communicationType,
          error: ruleError.message
        })
      }
    }

  } catch (error) {
    logError(`Error in processLeadForClinic for lead ${lead.id}`, error)
    results.push({
      leadId: lead.id,
      action: 'error',
      reason: 'Lead processing exception',
      followUpType: 'unknown',
      communicationType: 'any',
      error: error.message
    })
  }

  return results
}

// Process a specific rule for a lead (ORIGINAL - unchanged)
async function processRuleForLead(
  lead: Lead, 
  clinic: Clinic, 
  rule: FollowUpRule, 
  supabase: any
): Promise<ProcessingResult> {
  try {
    // Get or create thread
    const threadId = await getOrCreateThread(lead, supabase)
    if (!threadId) {
      return {
        leadId: lead.id,
        action: 'error',
        reason: 'Failed to create thread',
        followUpType: rule.name,
        communicationType: rule.communicationType
      }
    }

    // Get conversation history
    const conversationHistory = await getConversationHistory(threadId, supabase)

    // Generate message
    const messageContent = await generateIntelligentResponse(
      lead,
      clinic,
      conversationHistory,
      rule.communicationType === 'email'
    )

    // Send message
    const sendResult = await sendMessage(lead, clinic, rule, messageContent, supabase)

    if (sendResult.success) {
      // Save to history
      await saveMessageToHistory(threadId, messageContent, rule.name, supabase)

      return {
        leadId: lead.id,
        action: 'sent',
        reason: `Successfully sent ${rule.name}`,
        followUpType: rule.name,
        communicationType: rule.communicationType
      }
    } else {
      return {
        leadId: lead.id,
        action: 'error',
        reason: `Send failed: ${sendResult.error}`,
        followUpType: rule.name,
        communicationType: rule.communicationType,
        error: sendResult.error
      }
    }

  } catch (error) {
    return {
      leadId: lead.id,
      action: 'error',
      reason: `Rule processing exception: ${error.message}`,
      followUpType: rule.name,
      communicationType: rule.communicationType,
      error: error.message
    }
  }
}

// Determine which follow-ups a lead should receive (ORIGINAL - unchanged)
async function determineFollowUpsForLead(lead: Lead, supabase: any): Promise<FollowUpRule[]> {
  const now = new Date()
  const leadCreatedAt = new Date(lead.created_at)
  const timeSinceCreated = now.getTime() - leadCreatedAt.getTime()
  
  // Filter out initial contact for nurturing function and sort by time
  const followupRules = FOLLOW_UP_RULES
    .filter(rule => rule.name !== 'sms_5min_initial')
    .sort((a, b) => a.timeFromCreated - b.timeFromCreated) // Sort by time ascending
  
  logInfo(`Checking follow-ups for lead ${lead.id}, age: ${Math.round(timeSinceCreated / (24 * 60 * 60 * 1000))} days`)
  
  // Find the NEXT due follow-up (not all overdue ones)
  for (const rule of followupRules) {
    // Check if enough time has passed since lead creation
    if (timeSinceCreated < rule.timeFromCreated) {
      logInfo(`Lead ${lead.id}: ${rule.name} not due yet (need ${Math.round(rule.timeFromCreated / (24 * 60 * 60 * 1000))} days)`)
      continue
    }
    
    // Check if too much time has passed (if rule has max time)
    if (rule.maxTimeFromCreated && timeSinceCreated > rule.maxTimeFromCreated) {
      logInfo(`Lead ${lead.id}: ${rule.name} expired (max ${Math.round(rule.maxTimeFromCreated / (24 * 60 * 60 * 1000))} days)`)
      continue
    }
    
    // Check if lead status matches (if rule specifies status requirements)
    if (rule.leadStatus && !rule.leadStatus.includes(lead.status)) {
      logInfo(`Lead ${lead.id}: ${rule.name} skipped due to status (${lead.status})`)
      continue
    }
    
    // Check if this follow-up has already been sent
    if (rule.onlyOnce && await hasFollowUpBeenSent(lead.id, rule.name, supabase)) {
      logInfo(`Lead ${lead.id}: ${rule.name} already sent`)
      continue
    }
    
    // Check if user has replied after last assistant message
    if (rule.checkLastActivity && await hasUserRepliedToLastAssistantMessage(lead.id, supabase)) {
      logInfo(`Lead ${lead.id}: ${rule.name} skipped - user already replied`)
      continue
    }
    
    // This is the NEXT due follow-up - return only this one
    logInfo(`Lead ${lead.id}: Found next due follow-up: ${rule.name}`)
    return [rule]
  }
  
  logInfo(`Lead ${lead.id}: No applicable follow-ups found`)
  return []
}

// ALL REMAINING FUNCTIONS ARE IDENTICAL TO YOUR ORIGINAL - No changes at all

// Check if a specific follow-up has already been sent
async function hasFollowUpBeenSent(leadId: string, followUpName: string, supabase: any): Promise<boolean> {
  try {
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
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
    return false
  }
}

async function hasUserRepliedToLastAssistantMessage(leadId: string, supabase: any): Promise<boolean> {
  try {
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', leadId)
      .single()
    
    if (!thread) return false
    
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

async function getOrCreateThread(lead: Lead, supabase: any): Promise<string | null> {
  try {
    const { data: existingThread } = await supabase
      .from('threads')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('clinic_id', lead.clinic_id)
      .single()
    
    if (existingThread) {
      return existingThread.id
    }
    
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

async function generateIntelligentResponse(
  lead: Lead,
  clinic: Clinic,
  conversationHistory: Conversation[],
  isEmail: boolean = false
): Promise<string | { subject: string, body: string }> {
  logInfo(`Generating intelligent response for lead ${lead.id} in clinic ${clinic.name}`)
  
  const OPENAI_API_KEY = clinic.openai_api_key || Deno.env.get('OPENAI_API_KEY')
  const bookingLink = clinic.calendly_link;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const unsubscribeLink = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?lead_id=${lead.id}&clinic_id=${clinic.id}`

  const bookingButton = isEmail 
    ? `<a href="${bookingLink}" style="color: #10b981; text-decoration: none; font-weight: bold;">Let's schedule a quick chat!</a>`
    : `📅 Book here: ${bookingLink}`

  const unsubscribeButton = isEmail 
    ? `<a href="${unsubscribeLink}" style="color: #6b7280; text-decoration: none; font-size: 12px;">unsubscribe here</a>`
    : `To stop texts: ${unsubscribeLink}`

  const unsubscribeFooter = isEmail 
    ? `<br><br><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"><div style="text-align: center; font-size: 12px; color: #6b7280;">If you no longer wish to receive these emails, you can ${unsubscribeButton}.</div>`
    : unsubscribeButton

  if (!OPENAI_API_KEY) {
    logInfo('No OpenAI API key found, using fallback message')
    const fallbackMessage = isEmail 
      ? `Hey ${lead.first_name || 'there'}, thanks for your interest in ${clinic.name}! Just wanted to check in - any questions I can help with?<br><br>Ready to take the next step? ${bookingButton}`
      : `Hey ${lead.first_name || 'there'}, thanks for your interest in ${clinic.name}! Just wanted to check in - any questions I can help with?\n\n${bookingButton}`
    
    if (isEmail) {
      return {
        subject: `Quick follow-up from ${clinic.name}`,
        body: `${fallbackMessage}${unsubscribeFooter}`
      }
    }
    return `${fallbackMessage}\n\n${unsubscribeButton}`
  }

  try {
    const conversationContext = conversationHistory
      .map(msg => `${msg.sender_type === 'user' ? `${lead.first_name || 'Patient'}` : clinic.assistants?.[0]?.assistant_name || 'Assistant'}: ${msg.message}`)
      .join('\n')

    const leadCreatedAt = new Date(lead.created_at)
    const leadAge = Math.floor((new Date().getTime() - leadCreatedAt.getTime()) / (24 * 60 * 60 * 1000))
    
    let systemPrompt = ''
    let userPrompt = ''

    if (isEmail) {
      let emailPattern = 'STORY'
      let patternGuidance = ''
      
      if (leadAge >= 21 && leadAge < 24) {
        emailPattern = 'STORY'
        patternGuidance = `Use the STORY pattern - share clinic-specific success stories or case studies. Format: Challenge → Solution → Results → Lesson. Example subjects: "The [clinic-specific] story that changed everything" / "What [patient story] taught us about [service]". End with: "If you're ready to take a decisive step for yourself with ${clinic.clinic_type}, reply and I'll help you explore what that could look like."`
      } else if (leadAge >= 24 && leadAge < 27) {
        emailPattern = 'EDUCATION'
        patternGuidance = `Use the EDUCATION pattern - share clinic-specific insights, research, or "why we ignore problems that matter most". Format: Observation → Explanation → Connection to Service → Solution. Example subjects: "Why [clinic insight] matters for ${clinic.clinic_type}" / "The psychology behind [service decision]". End with: "If ${clinic.clinic_type} has been on your mind, reply and I'll help you understand how this applies to your situation."`
      } else if (leadAge >= 27 && leadAge < 30) {
        emailPattern = 'PSYCHOLOGY'
        patternGuidance = `Use the PSYCHOLOGY pattern - use behavioral insights related to decision-making and clinic services. Examples: "The myth of perfect time" / "What surgeons know about confidence". Connect psychological principles to taking action on self-care. End with: "If ${clinic.clinic_type} has been on your 'someday' list, maybe it's time to challenge that assumption."`
      } else if (leadAge >= 30 && leadAge < 45) {
        emailPattern = 'MOMENTUM'
        patternGuidance = `Use the MOMENTUM pattern - focus on taking action, building confidence, overcoming hesitation. Use clinic expertise and patient success patterns. Examples: "The 10-minute rule for doing anything hard" / "How to build confidence through action". End with: "If you want help taking that first step with ${clinic.clinic_type}, just reply."`
      } else if (leadAge >= 45 && leadAge < 60) {
        emailPattern = 'SOCIAL PROOF'
        patternGuidance = `Use the SOCIAL PROOF pattern - share patient feedback patterns. Format: "Over the years, we've heard a lot from patients who finally decided to make a change..." Include common responses: "I wish I'd done this sooner" / "I was nervous for nothing" / "I thought I'd have to have it all figured out". End with: "If you want to talk through what that looks like for ${clinic.clinic_type}, just reply."`
      } else if (leadAge >= 60 && leadAge < 100) {
        emailPattern = 'URGENCY'
        patternGuidance = `Use the URGENCY/SCARCITY pattern - "The quiet cost of putting yourself last" / "The invisible opportunity cost". Focus on what waiting costs vs. benefits of action. End with: "If you've been pushing ${clinic.clinic_type} to the bottom of the list, maybe it's time to ask: What would change if I put myself first?"`
      } else if (leadAge >= 100) {
        emailPattern = 'FINAL SEQUENCE'
        patternGuidance = `Use the FINAL SEQUENCE pattern - Direct close: "Are you still curious about ${clinic.clinic_type}, or should I close your file?" / One-year challenge: "Picture yourself one year from today..." / Final offer: "This is my last email. If you want to finally explore ${clinic.clinic_type}, reply."`
      }

      systemPrompt = `You are the virtual assistant for ${clinic.name}. Generate a conversational, engaging follow-up email that sounds like texting a knowledgeable friend who works there.

CRITICAL TONE REQUIREMENTS:
- Sound like you're texting a friend - casual but knowledgeable
- Create gentle urgency without being pushy
- Use personality and light humor when appropriate
- Be direct and honest - cut through the fluff
- Make people feel like they're talking to a real person
- NEVER use corporate language

❌ AVOID: "Thank you for your inquiry regarding our services..." / "We appreciate your continued interest..." / "I hope this message finds you well..."
✅ USE: "Hey [Name], quick story that might hit home..." / "Been thinking about our conversation..." / "Real talk for a sec..."

EMAIL PATTERN TO USE: ${emailPattern}
${patternGuidance}

REQUIRED ELEMENTS:
- MUST include booking link naturally embedded in text: ${bookingButton}
- DO NOT add unsubscribe text in body - it will be added automatically in footer

EMAIL STRUCTURE:
- Subject: Conversational, intriguing (like "The story that changed everything" or "Why most people wait")
- Opening: Casual greeting using pattern guidance above
- Body: 2-3 short paragraphs, conversational tone, specific to the pattern
- Call-to-action: Natural booking suggestion followed by the embedded booking link
- Close: Natural call-to-action like "If this is resonating, just reply" or specific to pattern guidance
- DO NOT include unsubscribe text in the body - it's added automatically
- Keep under 250 words total

Format your response as:
SUBJECT: [conversational subject line]
BODY: [casual, engaging email content with embedded booking link]`

      userPrompt = `Generate a ${emailPattern} pattern follow-up email for ${lead.first_name || 'this patient'} (${leadAge} days old) at ${clinic.name}.

Previous conversation:
${conversationContext || 'No previous conversation - this is a follow-up email in our nurturing sequence.'}

Patient Details:
- Name: ${lead.first_name || ''} ${lead.last_name || ''}
- Lead Age: ${leadAge} days
- Interest Level: ${lead.interest_level || 'unknown'}
- Urgency: ${lead.urgency || 'unknown'}

Make it sound like you're genuinely checking in with someone you care about, not sending a marketing email. Include the booking link naturally embedded in text. Do not include any unsubscribe text - it will be added automatically.`

    } else {
      // SMS Follow-up patterns based on specific day intervals
      let smsTemplate = ''
      
      if (leadAge === 0) {
        smsTemplate = `Hey ${lead.first_name || '[First Name]'}, it's ${clinic.assistants?.[0]?.assistant_name || '[Avatar]'} at ${clinic.name}. I can hold a spot for ${clinic.clinic_type} this month. Do you want me to save it, or should I stop bugging you?`
      } else if (leadAge === 2) {
        smsTemplate = `Curious - are you still weighing ${clinic.clinic_type} or just feeling it out? Most people I talk to start here. I can help either way.`
      } else if (leadAge === 5) {
        smsTemplate = `Talked to someone last week who felt the same about ${clinic.clinic_type}. They booked, and now wish they had done it sooner. Want me to share what helped them decide?`
      } else if (leadAge === 10) {
        smsTemplate = `We've only got a few ${clinic.clinic_type} openings next week. Want me to hold one for you, or should I circle back later?`
      } else if (leadAge === 20) {
        smsTemplate = `Still curious about ${clinic.clinic_type}, or should I hit pause for now? Totally fine either way. Just let me know.`
      } else {
        // Fallback for other days
        smsTemplate = `Hey ${lead.first_name || 'there'}! Still curious about ${clinic.clinic_type} or should I circle back later? No pressure!`
      }

      systemPrompt = `You are the virtual assistant for ${clinic.name}. Generate a conversational SMS that sounds like texting a knowledgeable friend who works there.

CRITICAL TONE REQUIREMENTS:
- Sound casual and friendly - like texting a friend
- Create gentle urgency without being pushy
- Be direct and honest - cut through the fluff
- Keep under 160 characters for main message (links don't count toward limit)
- Use personality when appropriate

❌ AVOID: "Thank you for your interest in our services"
✅ USE: Natural, conversational language

SMS TEMPLATE FOR DAY ${leadAge}: "${smsTemplate}"

REQUIRED ELEMENTS:
- MUST include booking button: ${bookingButton}
- MUST include unsubscribe option: "${unsubscribeButton}"
- Use the template above but personalize with actual service names and patient details

Replace references to services with ${clinic.clinic_type} and personalize based on conversation history.
Always end with booking button and unsubscribe option.

Keep the main message conversational and under 160 characters, then add the links.`

      userPrompt = `Generate an SMS follow-up for ${lead.first_name || 'this patient'} (Day ${leadAge}) at ${clinic.name}.

Previous conversation:
${conversationContext || 'No previous conversation - this is a follow-up SMS in our nurturing sequence.'}

Patient Details:
- Name: ${lead.first_name || ''} ${lead.last_name || ''}
- Lead Age: ${leadAge} days
- Interest Level: ${lead.interest_level || 'unknown'}
- Urgency: ${lead.urgency || 'unknown'}

Use the SMS template for Day ${leadAge} and personalize it with ${clinic.clinic_type} and details from the conversation. Make it sound natural and casual, not like a marketing message. Include both booking and unsubscribe options.`
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
        temperature: 0.8
      })
    })

    if (response.ok) {
      const data = await response.json()
      const generatedContent = data.choices[0]?.message?.content
      
      if (generatedContent) {
        if (isEmail) {
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
            } else if (isBody && line.trim()) {
              body += '\n' + line
            }
          }

          body += `\n\n${unsubscribeFooter}`
          const htmlBody = body.replace(/\n/g, '<br>')

          if (subject && htmlBody) {
            logInfo('Successfully generated intelligent email response via OpenAI')
            return { subject, body: htmlBody.trim() }
          }
        } else {
          let smsBody = generatedContent.trim()
          
          if (!smsBody.includes(bookingLink)) {
            smsBody += `\n\n${bookingButton}`
          }
          
          if (!smsBody.includes(unsubscribeLink)) {
            smsBody += `\n${unsubscribeButton}`
          }
          
          logInfo('Successfully generated intelligent SMS response via OpenAI')
          return smsBody
        }
      }
    } else {
      logError('OpenAI API call failed', await response.text())
    }
  } catch (error) {
    logError('Error generating intelligent response with OpenAI', error)
  }

  logInfo('Using fallback intelligent response')
  const leadAge = Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (24 * 60 * 60 * 1000))
  
  if (isEmail) {
    let fallbackSubject = ''
    let fallbackBody = ''
    
    if (leadAge >= 21 && leadAge < 30) {
      fallbackSubject = `Quick story from ${clinic.name}`
      fallbackBody = `Hey ${lead.first_name || 'there'},<br><br>Quick story that might hit home - had a patient last month who was in the exact same spot as you. They were curious but hesitant about ${clinic.clinic_type}.<br><br>Long story short: they finally booked, and the first thing they said afterward was "I wish I'd done this sooner."<br><br>If you're ready to take a decisive step for yourself, ${bookingButton}<br><br>Just reply if you want to explore what that could look like.${unsubscribeFooter}`
    } else if (leadAge >= 30 && leadAge < 60) {
      fallbackSubject = `The 10-minute rule`
      fallbackBody = `Hey ${lead.first_name || 'there'},<br><br>Been thinking about something - most people spend months thinking about taking action, but the actual decision takes about 10 minutes.<br><br>The hardest part isn't the ${clinic.clinic_type} itself. It's just making the call.<br><br>If you want help taking that first step, ${bookingButton}<br><br>Just reply and we can talk through it.${unsubscribeFooter}`
    } else if (leadAge >= 60 && leadAge < 100) {
      fallbackSubject = `What waiting costs`
      fallbackBody = `Hey ${lead.first_name || 'there'},<br><br>Real talk - I've been thinking about the invisible cost of putting ourselves last on the list.<br><br>Every month we wait is another month we could have been feeling better about ourselves.<br><br>If you've been pushing ${clinic.clinic_type} to the bottom of the list, maybe it's time to ask: What would change if I put myself first?<br><br>${bookingButton}${unsubscribeFooter}`
    } else if (leadAge >= 100) {
      fallbackSubject = `My last email`
      fallbackBody = `Hey ${lead.first_name || 'there'},<br><br>This is my last email. Are you still curious about ${clinic.clinic_type}, or should I close your file?<br><br>No pressure either way - just want to know if you want to finally explore what this could look like for you.<br><br>If so: ${bookingButton}<br><br>If not, no worries at all.${unsubscribeFooter}`
    } else {
      fallbackSubject = `Quick follow-up from ${clinic.name}`
      fallbackBody = `Hey ${lead.first_name || 'there'},<br><br>Just wanted to check in - still thinking about ${clinic.clinic_type}, or do you have any questions I can help with?<br><br>Most people I talk to are in the same spot - curious but not sure about the next step. Happy to chat through whatever's on your mind.<br><br>Ready to take the next step? ${bookingButton}<br><br>Just reply if you want to talk!${unsubscribeFooter}`
    }
    
    return { subject: fallbackSubject, body: fallbackBody }
  } else {
    let smsMessage = ''
    if (leadAge === 0) {
      smsMessage = `Hey ${lead.first_name || 'there'}, it's ${clinic.assistants?.[0]?.assistant_name || 'the team'} at ${clinic.name}. I can hold a spot for ${clinic.clinic_type} this month. Do you want me to save it, or should I stop bugging you?`
    } else if (leadAge === 2) {
      smsMessage = `Curious - are you still weighing ${clinic.clinic_type} or just feeling it out? Most people I talk to start here. I can help either way.`
    } else if (leadAge === 5) {
      smsMessage = `Talked to someone last week who felt the same about ${clinic.clinic_type}. They booked, and now wish they had done it sooner. Want me to share what helped them decide?`
    } else if (leadAge === 10) {
      smsMessage = `We've only got a few ${clinic.clinic_type} openings next week. Want me to hold one for you, or should I circle back later?`
    } else if (leadAge === 20) {
      smsMessage = `Still curious about ${clinic.clinic_type}, or should I hit pause for now? Totally fine either way. Just let me know.`
    } else {
      smsMessage = `Hey ${lead.first_name || 'there'}! Still curious about ${clinic.clinic_type} or should I circle back later? No pressure!`
    }
    
    return `${smsMessage}\n\n${bookingButton}\n${unsubscribeButton}`
  }
}

async function sendMessage(
  lead: Lead,
  clinic: Clinic,
  rule: FollowUpRule,
  messageContent: string | { subject: string, body: string },
  supabase: any
): Promise<{ success: boolean, error?: string }> {
  if (rule.communicationType === 'sms') {
    if (typeof messageContent === 'string') {
      return await sendSMS(lead.phone, messageContent, lead.clinic_id, supabase, clinic.twilio_config?.[0])
    } else {
      return { success: false, error: 'Invalid message format for SMS' }
    }
  } else {
    if (typeof messageContent === 'object' && messageContent.subject && messageContent.body) {
      return await sendEmail(
        lead.email!, 
        messageContent.subject, 
        messageContent.body, 
        lead.clinic_id, 
        supabase,
        undefined,
        lead.id
      )
    } else {
      return { success: false, error: 'Invalid message format for email' }
    }
  }
}

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

async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
  clinicId: string,
  supabase: any,
  emailSettings?: any,
  leadId?: string
): Promise<{ success: boolean, error?: string }> {
  logInfo(`Attempting to send email to ${toEmail} for clinic ${clinicId}`);

  try {
    let settings = emailSettings;

    if (!settings) {
      const { data: fetchedSettings, error: settingsError } = await supabase
        .from('clinic')
        .select('mailgun_domain, mailgun_email, name, address, phone')
        .eq('id', clinicId)
        .single();

      if (settingsError) {
        logError('Error fetching Mailgun settings from clinic table', { clinicId, error: settingsError });
        return { success: false, error: `Error fetching Mailgun settings: ${settingsError.message}` };
      }

      settings = fetchedSettings;
    }

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

    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    
    if (!MAILGUN_API_KEY) {
      logError('MAILGUN_API_KEY environment variable not set');
      return { 
        success: false, 
        error: 'Mailgun API key not configured' 
      };
    }

    const { 
      mailgun_domain, 
      mailgun_email, 
      name: clinicName,
      
      address,
      phone,
      
    } = settings;

    // Create professional HTML email template
    const primaryColor = '#2563eb'; // Default blue if no color set
    const logo_url = 'https://ozmytbghfvrfhbjvabor.supabase.co/storage/v1/object/public/clinic-logos/39d699cb-f712-431c-ba38-9e718310e2bb-iy9cs5ln.png'
    const logoSection = logo_url ? 
      `<img src="${logo_url}" alt="${clinicName} Logo" style="max-height: 60px; margin-bottom: 30px; display: block;">` :
      `<h1 style="color: ${primaryColor}; font-size: 28px; font-weight: bold; margin: 0 0 30px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${clinicName}</h1>`;

    // Convert body content to HTML with better formatting
    const contentBody = body
      .replace(/\n\n/g, '</p><p style="margin: 0 0 20px 0; line-height: 1.6;">')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p style="margin: 0 0 20px 0; line-height: 1.6;">')
      .replace(/$/, '</p>');

    const professionalHtmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header with Logo -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                                ${logoSection}
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #334155;">
                                ${contentBody}
                            </td>
                        </tr>
                        
                        <!-- Contact Information -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #64748b; text-align: center;">
                                            <strong style="color: ${primaryColor}; font-size: 16px; display: block; margin-bottom: 10px;">${clinicName}</strong>
                                            ${address ? `<div style="margin-bottom: 8px;">${address}</div>` : ''}
                                            ${phone ? `<div style="margin-bottom: 8px;">Phone: <a href="tel:${phone}" style="color: ${primaryColor}; text-decoration: none;">${phone}</a></div>` : ''}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Unsubscribe Footer -->
                        ${leadId && SUPABASE_URL ? `
                        <tr>
                            <td style="padding: 20px 40px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #94a3b8;">
                                    <p style="margin: 0 0 10px 0;">You're receiving this because you showed interest in our services.</p>
                                    <p style="margin: 0;">
                                        Not interested anymore? 
                                        <a href="${SUPABASE_URL}/functions/v1/unsubscribe-lead?leadId=${leadId}" 
                                           style="color: #64748b; text-decoration: underline;">
                                            Unsubscribe here
                                        </a>
                                    </p>
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Create plain text version
    let emailBody = body;
    if (leadId && SUPABASE_URL) {
      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe-lead?leadId=${leadId}`;
      
      const textFooter = `\n\n---\n${clinicName}\n${address ? `${address}\n` : ''}${phone ? `Phone: ${phone}\n` : ''}\n\nYou're receiving this because you showed interest in our services.\nNot interested anymore? Unsubscribe here: ${unsubscribeUrl}`;
      
      emailBody += textFooter;
    }

    logInfo('Sending professional branded email via Mailgun', {
      domain: mailgun_domain,
      from: mailgun_email,
      to: toEmail,
      subject: subject,
      contentLength: emailBody.length,
      hasUnsubscribe: !!leadId,
      hasLogo: !!logo_url,
      clinicName
    });

    const formData = new FormData();
    formData.append('from', `${clinicName} <${mailgun_email}>`); // Include clinic name in sender
    formData.append('to', toEmail);
    formData.append('subject', subject);
    formData.append('text', emailBody);
    formData.append('html', professionalHtmlTemplate);

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
      error: error.message
    };
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
      messageText = `${followUpType.toUpperCase()}: ${messageContent}`
    } else {
      messageText = `${followUpType.toUpperCase()} EMAIL - Subject: ${messageContent.subject}\n\n${messageContent.body}`
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

  const { data: clinicSettings } = await supabase
    .from('twilio_config')
    .select('clinic_id, twilio_account_sid, twilio_auth_token, twilio_phone_number')
    .eq('twilio_phone_number', twilioData.to)
    .eq('status', 'active')
    .single()

  if (!clinicSettings) {
    throw new Error('No clinic found with active Twilio settings for phone number: ' + twilioData.to)
  }

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

  const { data: clinic } = await supabase
    .from('clinic')
    .select('id, mailgun_email')
    .eq('mailgun_email', emailData.to)
    .single()

  if (!clinic) {
    throw new Error('No clinic found with mailgun email address: ' + emailData.to)
  }

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

// Example handler function for scheduled processing (call this every 5 minutes)
export async function scheduledHandler(req: Request) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Process leads that are due for follow-ups within tolerance windows
    const result = await processScheduledFollowUps(supabase)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    logError('Scheduled handler error', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        processedAt: new Date().toISOString()
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Export functions - NEW scheduled function + all original functions
export { 
  processScheduledFollowUps, // NEW: Use this for 5-minute scheduled processing
  processAllLeads, // ORIGINAL: Your existing function unchanged
  FOLLOW_UP_RULES, 
  determineFollowUpsForLead,
  generateIntelligentResponse,
  sendSMS,
  sendEmail,
  handleTwilioWebhook,
  handleEmailWebhook
}