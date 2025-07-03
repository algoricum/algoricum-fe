import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface ProcessMode {
  mode: 'process_followups' | 'twilio_webhook' | 'process_new_leads'
  twilio_data?: any
}

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
  interest_level: number
  urgency: number
  created_at: string
  updated_at: string
}

interface Thread {
  id: string
  lead_id: string
  clinic_id: string
  status: string
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

// Enhanced logging function
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] ERROR: ${message}`, error)
}

// Generate messages using GPT
async function generateMessage(
  lead: Lead, 
  messageType: 'welcome' | 'followup_4h' | 'followup_2d' | 'followup_weekly',
  conversationHistory?: Conversation[]
): Promise<string> {
  logInfo(`Generating ${messageType} message for lead ${lead.id}`)
  
  const fallbackMessages = {
    welcome: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! 👋 Thanks for your interest in our clinic. How can we help you today?`,
    followup_4h: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Just checking in - any questions about our services? We're here to help! 🏥`,
    followup_2d: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Just wanted to follow up on your interest in our clinic. Any questions we can help with? 💙`,
    followup_weekly: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Hope you're well. Ready to prioritize your health? We're here to help! 💙`
  }

  if (!OPENAI_API_KEY) {
    logInfo('No OpenAI API key found, using fallback message')
    return fallbackMessages[messageType]
  }

  try {
    const conversationContext = conversationHistory?.slice(-3)
      .map(msg => `${msg.sender_type === 'user' ? 'Patient' : 'Clinic'}: ${msg.message}`)
      .join('\n') || 'No previous conversation'

    let systemPrompt = ''
    let userPrompt = ''

    switch (messageType) {
      case 'welcome':
        systemPrompt = `You are a friendly clinic receptionist. Generate a warm, professional welcome SMS (1-2 sentences, under 160 chars) for a new lead. Use their name if provided and ask how you can help.`
        userPrompt = `New lead${lead.first_name ? ` named ${lead.first_name}` : ''} from our clinic. Generate a welcome response.`
        break
      case 'followup_4h':
        systemPrompt = `You are a caring clinic assistant. Generate a brief SMS follow-up (under 160 chars) for a lead who hasn't responded in 4 hours. Be helpful, not pushy.`
        userPrompt = `Follow up with ${lead.first_name || 'lead'} who hasn't responded in 4 hours`
        break
      case 'followup_2d':
        systemPrompt = `Generate a gentle 2-day SMS follow-up (under 160 chars) for a lead who hasn't responded. Be patient and supportive.`
        userPrompt = `2-day follow-up with ${lead.first_name || 'lead'} who hasn't responded`
        break
      case 'followup_weekly':
        systemPrompt = `Generate a gentle weekly SMS check-in (under 160 chars) for a lead. Be supportive and health-focused.`
        userPrompt = `Weekly check-in for ${lead.first_name || 'lead'}`
        break
    }

    logInfo('Calling OpenAI API for message generation')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${userPrompt}\n\nRecent conversation:\n${conversationContext}` }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    })

    if (response.ok) {
      const data = await response.json()
      const generatedMessage = data.choices[0]?.message?.content
      if (generatedMessage) {
        logInfo('Successfully generated message via OpenAI')
        return generatedMessage.trim()
      }
    } else {
      logError('OpenAI API call failed', await response.text())
    }
  } catch (error) {
    logError('Error generating message with OpenAI', error)
  }

  logInfo('Using fallback message')
  return fallbackMessages[messageType]
}

// Send SMS using Twilio
async function sendSMS(toPhone: string, message: string, clinicId: string, supabase: any): Promise<{ success: boolean, error?: string }> {
  logInfo(`Attempting to send SMS to ${toPhone} for clinic ${clinicId}`)
  
  try {
    const { data: smsSettings } = await supabase
      .from('email_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_webhook_url')
      .eq('clinic_id', clinicId)
      .single()

    if (!smsSettings?.twilio_account_sid || !smsSettings?.twilio_auth_token || !smsSettings?.twilio_phone_number || !smsSettings?.twilio_webhook_url) {
      logError('Incomplete Twilio settings for clinic', { clinicId, settings: smsSettings })
      return { success: false, error: 'Incomplete Twilio settings for clinic' }
    }

    const { twilio_account_sid, twilio_auth_token, twilio_phone_number } = smsSettings

    logInfo('Calling Twilio API to send SMS')
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
      logInfo('SMS sent successfully')
      return { success: true }
    } else {
      const errorText = await response.text()
      logError('Twilio API call failed', errorText)
      return { success: false, error: errorText }
    }
  } catch (error: any) {
    logError('Error sending SMS', error)
    return { success: false, error: error.message }
  }
}


// Process existing leads (cron job every 5 minutes)
async function processNewLeads(supabase: any) {
  logInfo('Starting lead processing (checking existing leads for initial contact)')
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  let totalProcessed = 0
  let totalErrors = 0

  try {
    // Get all clinics with complete Twilio settings
    logInfo('Fetching clinics with Twilio settings')
    const { data: clinics, error: clinicError } = await supabase
      .from('email_settings')
      .select('clinic_id')
      .not('twilio_account_sid', 'is', null)
      .not('twilio_auth_token', 'is', null)
      .not('twilio_phone_number', 'is', null)
      .not('twilio_webhook_url', 'is', null)

    if (clinicError) {
      logError('Error fetching clinics with Twilio settings', clinicError)
      return { processed: 0, errors: 1 }
    }

    if (!clinics || clinics.length === 0) {
      logInfo('No clinics with complete Twilio settings found')
      return { processed: 0, errors: 0 }
    }

    logInfo(`Found ${clinics.length} clinics with complete Twilio settings`)

    // Process leads for each clinic
    for (const clinic of clinics) {
      logInfo(`Processing leads for clinic ${clinic.clinic_id}`)

      try {
        // Get all leads that have phone numbers and were created recently (last 5 minutes) or older leads that haven't been contacted
        const { data: leads, error: fetchError } = await supabase
          .from('lead')
          .select('id, first_name, last_name, phone, email, status, clinic_id, created_at')
          .eq('clinic_id', clinic.clinic_id)
          .not('phone', 'is', null)
          .neq('phone', '')

        if (fetchError) {
          logError(`Error fetching leads for clinic ${clinic.clinic_id}`, fetchError)
          totalErrors++
          continue
        }

        if (!leads || leads.length === 0) {
          logInfo(`No leads with phone numbers found for clinic ${clinic.clinic_id}`)
          continue
        }

        logInfo(`Found ${leads.length} leads with phone numbers for clinic ${clinic.clinic_id}`)

        for (const lead of leads) {
          try {
            // Check if thread exists for this lead
            const { data: existingThread } = await supabase
              .from('threads')
              .select('id')
              .eq('lead_id', lead.id)
              .eq('clinic_id', lead.clinic_id)
              .single()

            let shouldSendWelcome = false
            let threadId = existingThread?.id

            if (!existingThread) {
              shouldSendWelcome = true
              logInfo(`No thread found for lead ${lead.id}, will send initial welcome message`)          
            } else {
              // Thread exists - check if any assistant messages have been sent
              const { data: conversations, error: convError } = await supabase
                .from('conversation')
                .select('id, is_from_user, sender_type')
                .eq('thread_id', existingThread.id)

              if (convError) {
                logError(`Error fetching conversations for lead ${lead.id}`, convError)
                totalErrors++
                continue
              }

              const assistantMessages = conversations?.filter(c => !c.is_from_user && c.sender_type === 'assistant').length || 0

              // Send welcome if no assistant messages have been sent yet
              if (assistantMessages === 0) {
                shouldSendWelcome = true
                logInfo(`Lead ${lead.id} has thread but no assistant messages, will send initial welcome`)
              } else {
                logInfo(`Lead ${lead.id} already has assistant messages sent`)
              }
            }

            if (shouldSendWelcome) {
              // Create thread if it doesn't exist
              if (!threadId) {
                const { data: newThread, error: threadError } = await supabase
                  .from('threads')
                  .insert({
                    lead_id: lead.id,
                    clinic_id: lead.clinic_id,
                    status: 'new',
                    created_at: now.toISOString(),
                    updated_at: now.toISOString()
                  })
                  .select('id')
                  .single()

                if (threadError) {
                  logError(`Error creating thread for lead ${lead.id}`, threadError)
                  totalErrors++
                  continue
                }
                threadId = newThread.id
                logInfo(`Created new thread ${threadId} for lead ${lead.id}`)
              }

              // Generate and send welcome message
              const welcomeMessage = await generateMessage(lead, 'welcome')
              const smsSent = await sendSMS(lead.phone, welcomeMessage, lead.clinic_id, supabase)

              if (smsSent.success) {
                // Save welcome message to conversation
                await supabase
                  .from('conversation')
                  .insert({
                    thread_id: threadId,
                    message: welcomeMessage,
                    timestamp: now.toISOString(),
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                    is_from_user: false,
                    sender_type: 'assistant'
                  })

                totalProcessed++
                logInfo(`Successfully sent welcome message to lead ${lead.id}`)
              } else {
                logError(`Failed to send welcome SMS to lead ${lead.id}`, smsSent.error)
                totalErrors++
              }
            }

          } catch (error: any) {
            logError(`Error processing lead ${lead.id}`, error)
            totalErrors++
          }
        }

      } catch (error: any) {
        logError(`Error processing clinic ${clinic.clinic_id}`, error)
        totalErrors++
      }
    }

    logInfo(`Lead processing completed: ${totalProcessed} processed, ${totalErrors} errors`)
    return { processed: totalProcessed, errors: totalErrors }

  } catch (error: any) {
    logError('Error in processNewLeads', error)
    return { processed: 0, errors: 1 }
  }
}

// Handle Twilio webhook - save incoming messages
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

  // Validate Twilio webhook data
  if (!twilioData.from || !twilioData.to || !twilioData.body || !twilioData.messageSid || !twilioData.accountSid) {
    throw new Error('Invalid Twilio webhook data: missing required fields')
  }

  // Find the clinic based on the Twilio phone number
  const { data: clinicSettings } = await supabase
    .from('email_settings')
    .select('clinic_id, twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_webhook_url')
    .eq('twilio_phone_number', twilioData.to)
    .single()

  if (!clinicSettings || !clinicSettings.twilio_account_sid || !clinicSettings.twilio_auth_token || !clinicSettings.twilio_phone_number || !clinicSettings.twilio_webhook_url) {
    throw new Error('No clinic found with complete Twilio settings for phone number: ' + twilioData.to)
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
  let thread: Thread | null = null
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
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_from_user: true,
      sender_type: 'user'
    })

  logInfo('Twilio webhook processed successfully')
  return {
    success: true,
    lead_id: lead.id,
    thread_id: thread.id,
    message: 'Message saved successfully'
  }
}

// Process follow-ups for existing conversations
async function processFollowUps(supabase: any) {
  logInfo('Starting follow-up processing')
  const now = new Date()
  let totalProcessed = 0
  let totalErrors = 0

  try {
    // Get all clinics with complete Twilio settings (SMS only)
    logInfo('Fetching clinics with Twilio settings')
    const { data: clinics, error: clinicError } = await supabase
      .from('email_settings')
      .select('clinic_id')
      .not('twilio_account_sid', 'is', null)
      .not('twilio_auth_token', 'is', null)
      .not('twilio_phone_number', 'is', null)
      .not('twilio_webhook_url', 'is', null)

    if (clinicError) {
      logError('Error fetching clinics', clinicError)
      return { processed: 0, errors: 1 }
    }

    if (!clinics || clinics.length === 0) {
      logInfo('No clinics with complete settings found for follow-up')
      return { processed: 0, errors: 0 }
    }

    logInfo(`Found ${clinics.length} clinics with complete settings`)

    // Process follow-ups for each clinic
    for (const clinic of clinics) {
      logInfo(`Processing follow-ups for clinic ${clinic.clinic_id}`)

      try {
        // Get active threads with their leads
        const { data: threads, error: threadError } = await supabase
          .from('threads')
          .select(`
            id,
            lead_id,
            clinic_id,
            status,
            lead:lead_id (
              id,
              first_name,
              last_name,
              phone,
              email,
              status,
              created_at
            )
          `)
          .eq('clinic_id', clinic.clinic_id)
          .eq('status', 'new')

        if (threadError) {
          logError(`Error fetching threads for clinic ${clinic.clinic_id}`, threadError)
          continue
        }

        if (!threads || threads.length === 0) {
          logInfo(`No active threads found for clinic ${clinic.clinic_id}`)
          continue
        }

        // Get conversations for these threads
        const threadIds = threads.map(thread => thread.id)
        const { data: conversations, error: convError } = await supabase
          .from('conversation')
          .select('thread_id, message, timestamp, is_from_user, sender_type, created_at, updated_at')
          .in('thread_id', threadIds)
          .order('updated_at', { ascending: false })

        if (convError) {
          logError(`Error fetching conversations for clinic ${clinic.clinic_id}`, convError)
          continue
        }

        logInfo(`Found ${conversations?.length || 0} conversations for clinic ${clinic.clinic_id}`)

        // Process each thread
        for (const thread of threads) {
          try {
            const lead = thread.lead as any
            if (!lead) continue

            // Get conversations for this thread
            const threadConversations = conversations?.filter(c => c.thread_id === thread.id) || []
            
            if (threadConversations.length === 0) {
              logInfo(`No conversations found for lead ${lead.id}`)
              continue
            }

            // Find last assistant message to determine follow-up timing
            const lastAssistantMessage = threadConversations.find(c => !c.is_from_user && c.sender_type === 'assistant')
            if (!lastAssistantMessage) {
              logInfo(`No assistant messages found for lead ${lead.id}`)
              continue
            }

            // Check if there's a user reply after the last assistant message
            const userRepliesAfterAssistant = threadConversations.filter(c => 
              c.is_from_user && new Date(c.created_at) > new Date(lastAssistantMessage.created_at)
            )

            if (userRepliesAfterAssistant.length > 0) {
              logInfo(`Lead ${lead.id} has replied, no follow-up needed`)
              continue
            }

            const lastAssistantMessageTime = new Date(lastAssistantMessage.updated_at)
            const timeSinceLastMessage = now.getTime() - lastAssistantMessageTime.getTime()
            const hoursSince = timeSinceLastMessage / (1000 * 60 * 60)
            const daysSince = timeSinceLastMessage / (1000 * 60 * 60 * 24)

            const conversationHistory = threadConversations
              .sort((a: Conversation, b: Conversation) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .slice(0, 5)

            let followUpType = null
            let messageTemplate = ''

            // Check for 4-hour SMS follow-up (between 4-6 hours) - only send once
            if (hoursSince >= 4 && hoursSince < 5) {
              // Check if we already sent a 4-hour follow-up
              const { data: existing4hFollowup } = await supabase
                .from('conversation')
                .select('id, message')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .eq('sender_type', 'assistant')
                .gte('created_at', new Date(lastAssistantMessageTime.getTime() + 3.5 * 60 * 60 * 1000).toISOString()) // 3.5 hours after last message
                .lte('created_at', new Date(lastAssistantMessageTime.getTime() + 6.5 * 60 * 60 * 1000).toISOString()) // 6.5 hours after last message

              if (!existing4hFollowup || existing4hFollowup.length === 0) {
                followUpType = 'sms'
                messageTemplate = 'followup_4h'
                logInfo(`Lead ${lead.id} needs 4-hour SMS follow-up (${hoursSince.toFixed(1)} hours since last message)`)
              } else {
                logInfo(`Lead ${lead.id} already has 4-hour follow-up sent`)
              }
            } 
            // Check for 2-day SMS follow-up (between 48-50 hours) - only send once
            else if (hoursSince >= 48 && hoursSince < 49) {
              // Check if we already sent a 2-day follow-up
              const { data: existing2dFollowup } = await supabase
                .from('conversation')
                .select('id, message')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .eq('sender_type', 'assistant')
                .gte('created_at', new Date(lastAssistantMessageTime.getTime() + 47 * 60 * 60 * 1000).toISOString()) // 47 hours after last message
                .lte('created_at', new Date(lastAssistantMessageTime.getTime() + 51 * 60 * 60 * 1000).toISOString()) // 51 hours after last message

              if (!existing2dFollowup || existing2dFollowup.length === 0) {
                followUpType = 'sms'
                messageTemplate = 'followup_2d'
                logInfo(`Lead ${lead.id} needs 2-day SMS follow-up (${hoursSince.toFixed(1)} hours since last message)`)
              } else {
                logInfo(`Lead ${lead.id} already has 2-day follow-up sent`)
              }
            }
            // Check for weekly SMS follow-up (every 7 days for up to 12 weeks, starting from week 1)
            else if (daysSince >= 7 && Math.floor(daysSince) % 7 === 0 && daysSince <= 84) {
              const weeksSince = Math.floor(daysSince / 7)
              
              // Check if we already sent this week's follow-up
              const { data: existingWeeklyFollowup } = await supabase
                .from('conversation')
                .select('id, message')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .eq('sender_type', 'assistant')
                .gte('created_at', new Date(lastAssistantMessageTime.getTime() + (weeksSince * 7 - 0.5) * 24 * 60 * 60 * 1000).toISOString())
                .lte('created_at', new Date(lastAssistantMessageTime.getTime() + (weeksSince * 7 + 0.5) * 24 * 60 * 60 * 1000).toISOString())

              if (!existingWeeklyFollowup || existingWeeklyFollowup.length === 0) {
                followUpType = 'sms'
                messageTemplate = 'followup_weekly'
                logInfo(`Lead ${lead.id} needs weekly SMS follow-up (week ${weeksSince}, ${daysSince.toFixed(1)} days since last message)`)
              } else {
                logInfo(`Lead ${lead.id} already has weekly follow-up for week ${weeksSince}`)
              }
            } else {
              logInfo(`Lead ${lead.id} doesn't need follow-up yet (${hoursSince.toFixed(1)} hours / ${daysSince.toFixed(1)} days since last message)`)
            }

            if (followUpType && messageTemplate) {
              const message = await generateMessage(lead, messageTemplate as any, conversationHistory)

              // Only SMS follow-ups now
              const sendResult = await sendSMS(lead.phone, message, lead.clinic_id, supabase)

              if (sendResult.success) {
                await supabase
                  .from('conversation')
                  .insert({
                    thread_id: thread.id,
                    message: message,
                    timestamp: now.toISOString(),
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                    is_from_user: false,
                    sender_type: 'assistant'
                  })

                totalProcessed++
                logInfo(`Successfully sent ${messageTemplate} to lead ${lead.id}`)
              } else {
                logError(`Failed to send ${messageTemplate} to lead ${lead.id}`, sendResult.error)
                totalErrors++
              }
            }

          } catch (error: any) {
            logError(`Error processing follow-up for thread ${thread.id}`, error)
            totalErrors++
          }
        }

      } catch (error: any) {
        logError(`Error processing clinic ${clinic.clinic_id}`, error)
        totalErrors++
      }
    }

    logInfo(`Follow-up processing completed: ${totalProcessed} processed, ${totalErrors} errors`)
    return { processed: totalProcessed, errors: totalErrors }

  } catch (error: any) {
    logError('Error in processFollowUps', error)
    return { processed: 0, errors: 1 }
  }
}

// Main Edge Function
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  logInfo('=== SMS Function Called ===')
  logInfo(`Request method: ${req.method}`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    logInfo('Supabase client created successfully')

    const contentType = req.headers.get('content-type') || ''
    logInfo(`Content type: ${contentType}`)
    
    // Handle Twilio webhook
    if (contentType.includes('application/x-www-form-urlencoded')) {
      logInfo('Processing Twilio webhook')
      const formData = await req.formData()
      
      await handleTwilioWebhook(formData, supabase)
      
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <Response></Response>`,
        { 
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        }
      )
    }

    const requestData = await req.json()
    logInfo('Request data received', requestData)
    
    if (!requestData.mode) {
      throw new Error('Missing mode in request body')
    }

    if (requestData.mode === 'process_new_leads') {
      logInfo('Starting new leads processing mode (initial contact)')
      const result = await processNewLeads(supabase)
      
      const response = {
        success: true,
        processed: result.processed,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
      
      logInfo('New leads processing completed', response)
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else if (requestData.mode === 'process_followups') {
      logInfo('Starting follow-up processing mode')
      const result = await processFollowUps(supabase)
      
      const response = {
        success: true,
        processed: result.processed,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
      
      logInfo('Follow-up processing completed', response)
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else if (requestData.mode === 'run_all') {
      logInfo('Starting full processing mode (new leads + followups)')
      
      // Process new leads first
      const newLeadsResult = await processNewLeads(supabase)
      logInfo('New leads processing completed', newLeadsResult)
      
      // Then process follow-ups
      const followupsResult = await processFollowUps(supabase)
      logInfo('Follow-ups processing completed', followupsResult)
      
      const response = {
        success: true,
        new_leads: {
          processed: newLeadsResult.processed,
          errors: newLeadsResult.errors
        },
        followups: {
          processed: followupsResult.processed,
          errors: followupsResult.errors
        },
        total_processed: newLeadsResult.processed + followupsResult.processed,
        total_errors: newLeadsResult.errors + followupsResult.errors,
        timestamp: new Date().toISOString()
      }
      
      logInfo('Full processing completed', response)
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      throw new Error('Invalid mode specified. Use: process_new_leads, process_followups, or run_all')
    }

  } catch (error: any) {
    logError('Function error', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
})