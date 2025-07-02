import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface IncomingMessage {
  from_phone: string
  message_body: string
  clinic_id: string
  message_type: 'sms'
  from_name?: string
}

interface ProcessMode {
  mode: 'incoming_message' | 'process_followups' | 'twilio_webhook'
  message_data?: IncomingMessage
  twilio_data?: any
}

interface Lead {
  id: string
  first_name?: string
  last_name?: string
  phone: string
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

// Utility function to extract name from message
function extractNameFromMessage(message: string | undefined): { first_name?: string, last_name?: string } {
  if (!message || typeof message !== 'string') {
    return {}
  }

  const namePatterns = [
    /my name is\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/i,
    /i'm\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/i,
    /this is\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/i,
    /^([a-zA-Z]+)(?:\s+([a-zA-Z]+))?\s+here/i
  ]

  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match) {
      return {
        first_name: match[1],
        last_name: match[2] || undefined
      }
    }
  }
  return {}
}

// Generate messages using GPT
async function generateMessage(
  lead: Lead, 
  messageType: 'welcome' | 'followup_4h' | 'followup_weekly',
  originalMessage?: string,
  conversationHistory?: Conversation[]
): Promise<string> {
  logInfo(`Generating ${messageType} message for lead ${lead.id}`)
  
  const fallbackMessages = {
    welcome: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! 👋 Thanks for reaching out to our clinic. How can we help you today?`,
    followup_4h: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Just checking in - any questions about our services? We're here to help! 🏥`,   
    followup_2d: `Hi${lead.first_name ? ` ${lead.first_name}` : ''},\n\nThanks for your interest in our clinic. We offer:\n• 95% patient satisfaction\n• Personalized care plans\n• Quick scheduling\n\nWould you like to book a consultation?\n\nBest,\nYour Clinic Team`,
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
        userPrompt = `New lead${lead.first_name ? ` named ${lead.first_name}` : ''} sent: "${originalMessage || 'No message provided'}". Generate a welcome response.`
        break
      case 'followup_4h':
        systemPrompt = `You are a caring clinic assistant. Generate a brief SMS follow-up (under 160 chars) for a lead who hasn't responded in 4 hours. Be helpful, not pushy.`
        userPrompt = `Follow up with ${lead.first_name || 'lead'} who contacted us 4 hours ago about: "${originalMessage || 'No message provided'}"`
         break
      case 'followup_2d':
        systemPrompt = `Generate a professional email follow-up for a lead who hasn't responded in 2 days. Include success stats and value proposition. Keep under 200 words.`
        userPrompt = `Email follow-up for ${lead.first_name || 'lead'} who initially asked about: "${originalMessage}"`
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

// Process incoming message
async function processIncomingMessage(messageData: IncomingMessage, supabase: any) {
  logInfo('Processing incoming message', messageData)
  
  try {
    // Validate message_body
    if (!messageData.message_body || typeof messageData.message_body !== 'string') {
      throw new Error('Invalid or missing message_body')
    }

    // Check Twilio settings for the clinic
    const { data: smsSettings } = await supabase
      .from('email_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_webhook_url')
      .eq('clinic_id', messageData.clinic_id)
      .single()

    if (!smsSettings?.twilio_account_sid || !smsSettings?.twilio_auth_token || !smsSettings?.twilio_phone_number || !smsSettings?.twilio_webhook_url) {
      throw new Error('Incomplete Twilio settings for clinic')
    }

    // Get SMS lead source ID
    const { data: smsSource } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'SMS')
      .single()

    if (!smsSource) {
      throw new Error('SMS lead source not found')
    }

    // Check if lead exists
    let lead: Lead | null = null
    let isNewLead = false
    
    const { data: existingLead } = await supabase
      .from('lead')
      .select('*')
      .eq('phone', messageData.from_phone)
      .eq('clinic_id', messageData.clinic_id)
      .single()
    
    lead = existingLead

    // Create new lead if doesn't exist
    if (!lead) {
      logInfo('Creating new lead')
      const extractedName = extractNameFromMessage(messageData.message_body)
      
      const { data: createdLead, error: leadError } = await supabase
        .from('lead')
        .insert({
          first_name: extractedName.first_name || messageData.from_name,
          last_name: extractedName.last_name,
          phone: messageData.from_phone,
          status: 'new',
          source_id: smsSource.id,
          clinic_id: messageData.clinic_id,
          notes: `First contact via SMS: "${messageData.message_body}"`,
          interest_level: 5,
          urgency: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (leadError) throw leadError
      lead = createdLead
      isNewLead = true
      logInfo('New lead created', { leadId: lead.id })
    } else {
      logInfo('Updating existing lead', { leadId: lead.id })
      await supabase
        .from('lead')
        .update({ 
          updated_at: new Date().toISOString(),
          notes: `${lead.notes || ''}\n\nNew message (${new Date().toISOString()}): "${messageData.message_body}"`
        })
        .eq('id', lead.id)
    }

    // Get or create thread
    let thread: Thread | null = null
    const { data: existingThread } = await supabase
      .from('thread')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('clinic_id', messageData.clinic_id)
      .single()

    if (existingThread) {
      thread = existingThread
      logInfo('Using existing thread', { threadId: thread.id })
    } else {
      logInfo('Creating new thread')
      const { data: createdThread, error: threadError } = await supabase
        .from('thread')
        .insert({
          lead_id: lead.id,
          clinic_id: messageData.clinic_id,
          status: 'active',
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
        message: messageData.message_body,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_from_user: true,
        sender_type: 'user'
      })

    // Send immediate welcome message for new leads
    if (isNewLead && messageData.from_phone) {
      logInfo('Sending welcome message to new lead')
      const welcomeMessage = await generateMessage(lead, 'welcome', messageData.message_body)
      
      const smsSent = await sendSMS(messageData.from_phone, welcomeMessage, messageData.clinic_id, supabase)
      
      if (smsSent.success) {
        logInfo('Welcome SMS sent successfully, saving to conversation')
        await supabase
          .from('conversation')
          .insert({
            thread_id: thread.id,
            message: welcomeMessage,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_from_user: false,
            sender_type: 'assistant'
          })
      } else {
        logError('Failed to send welcome SMS', smsSent.error)
      }
    }

    logInfo('Message processing completed successfully')
    return {
      success: true,
      lead_id: lead.id,
      thread_id: thread.id,
      message: 'Message processed successfully'
    }

  } catch (error: any) {
    logError('Error processing message', error)
    throw error
  }
}

// Process follow-ups for all clinics
async function processFollowUps(supabase: any) {
  logInfo('Starting follow-up processing')
  const now = new Date()
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
      logInfo('No clinics with complete Twilio settings found for follow-up')
      return { processed: 0, errors: 0 }
    }

    logInfo(`Found ${clinics.length} clinics with complete Twilio settings`)

    // Process follow-ups for each clinic
    for (const clinic of clinics) {
      logInfo(`Processing follow-ups for clinic ${clinic.clinic_id}`)
      let processed = 0
      let errors = 0

      try {
        // First get leads, then get their threads and conversations separately
        const { data: leads, error: fetchError } = await supabase
          .from('lead')
          .select('id, first_name, last_name, phone, status, clinic_id, created_at')
          .eq('status', 'new')
          .eq('clinic_id', clinic.clinic_id)
          .not('phone', 'is', null)

        if (fetchError) {
          logError(`Error fetching leads for clinic ${clinic.clinic_id}`, fetchError)
          errors++
          continue
        }

        if (!leads || leads.length === 0) {
          logInfo(`No leads found for clinic ${clinic.clinic_id}`)
          continue
        }

        logInfo(`Found ${leads.length} leads for clinic ${clinic.clinic_id}`)

        // Get threads for these leads
        const leadIds = leads.map(lead => lead.id)
        const { data: threads, error: threadError } = await supabase
          .from('threads')
          .select('id, lead_id, status')
          .in('lead_id', leadIds)

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

        // Process each lead with its thread and conversations
        for (const lead of leads) {
          try {
            // Find the thread for this lead
            const leadThread = threads.find(t => t.lead_id === lead.id)
            if (!leadThread) {
              logInfo(`No active thread found for lead ${lead.id}`)
              continue
            }

            // Get conversations for this thread
            const threadConversations = conversations?.filter(c => c.thread_id === leadThread.id) || []
            
            if (threadConversations.length === 0) {
              logInfo(`No conversations found for lead ${lead.id}`)
              continue
            }

            const lastConversation = threadConversations[0] // Already sorted by updated_at desc

            if (!lastConversation) continue

            const lastMessageTime = new Date(lastConversation.updated_at)
            const timeSinceLastMessage = now.getTime() - lastMessageTime.getTime()
            const hoursSince = timeSinceLastMessage / (1000 * 60 * 60)
            const daysSince = timeSinceLastMessage / (1000 * 60 * 60 * 24)

            // Only follow up if the last message was from the user
            if (!lastConversation.is_from_user) {
              logInfo(`Last message from lead ${lead.id} was not from user, skipping`)
              continue
            }

            const conversationHistory = threadConversations
              .sort((a: Conversation, b: Conversation) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .slice(0, 5)

            const firstMessage = threadConversations.find((c: Conversation) => c.is_from_user)?.message || ''

            let followUpType = null
            let messageTemplate = ''

            // Check for 4-hour follow-up (between 4-6 hours)
            if (hoursSince >= 4 && hoursSince < 6) {
              const { data: existingFollowup } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', leadThread.id)
                .eq('is_from_user', false)
                .gte('created_at', new Date(lastMessageTime.getTime() + 4 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .single()

              if (!existingFollowup) {
                followUpType = 'sms'
                messageTemplate = 'followup_4h'
                logInfo(`Lead ${lead.id} needs 4-hour follow-up (${hoursSince.toFixed(1)} hours since last message)`)
              } else {
                logInfo(`Lead ${lead.id} already has 4-hour follow-up`)
              }
            } 
            // Check for weekly follow-up (every 7 days for up to 12 weeks)
            else if (daysSince >= 7 && Math.floor(daysSince) % 7 === 0 && daysSince <= 84) {
              const weeksSince = Math.floor(daysSince / 7)
              const { data: existingFollowup } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', leadThread.id)
                .eq('is_from_user', false)
                .gte('created_at', new Date(lastMessageTime.getTime() + (weeksSince * 7 - 0.5) * 24 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .single()

              if (!existingFollowup) {
                followUpType = 'sms'
                messageTemplate = 'followup_weekly'
                logInfo(`Lead ${lead.id} needs weekly follow-up (${weeksSince} weeks, ${daysSince.toFixed(1)} days since last message)`)
              } else {
                logInfo(`Lead ${lead.id} already has weekly follow-up for week ${weeksSince}`)
              }
            } else {
              logInfo(`Lead ${lead.id} doesn't need follow-up yet (${hoursSince.toFixed(1)} hours / ${daysSince.toFixed(1)} days since last message)`)
            }

            if (followUpType && messageTemplate) {
              logInfo(`Sending ${messageTemplate} to lead ${lead.id}`)
              const message = await generateMessage(lead, messageTemplate as any, firstMessage, conversationHistory)

              const sendResult = await sendSMS(lead.phone, message, lead.clinic_id, supabase)

              if (sendResult.success) {
                await supabase
                  .from('conversation')
                  .insert({
                    thread_id: leadThread.id,
                    message: message,
                    timestamp: now.toISOString(),
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                    is_from_user: false,
                    sender_type: 'assistant'
                  })

                processed++
                logInfo(`Successfully sent ${messageTemplate} to lead ${lead.id}`)
              } else {
                logError(`Failed to send ${messageTemplate} to lead ${lead.id}`, sendResult.error)
                errors++
              }
            }

          } catch (error: any) {
            logError(`Error processing follow-up for lead ${lead.id}`, error)
            errors++
          }
        }

        totalProcessed += processed
        totalErrors += errors
        logInfo(`Completed clinic ${clinic.clinic_id}: ${processed} processed, ${errors} errors`)

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

// Handle Twilio webhook
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

  const { data: clinicSettings } = await supabase
    .from('email_settings')
    .select('clinic_id, twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_webhook_url')
    .eq('twilio_phone_number', twilioData.to)
    .single()

  if (!clinicSettings || !clinicSettings.twilio_account_sid || !clinicSettings.twilio_auth_token || !clinicSettings.twilio_phone_number || !clinicSettings.twilio_webhook_url) {
    throw new Error('No clinic found with complete Twilio settings for phone number: ' + twilioData.to)
  }

  return await processIncomingMessage({
    from_phone: twilioData.from,
    message_body: twilioData.body,
    clinic_id: clinicSettings.clinic_id,
    message_type: 'sms',
    from_name: undefined
  }, supabase)
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
  logInfo(`Request headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`)

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
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      logInfo('Processing Twilio webhook')
      const formData = await req.formData()
      
      const result = await handleTwilioWebhook(formData, supabase)
      
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

    if (requestData.mode === 'process_followups') {
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
    } else if (requestData.mode === 'incoming_message') {
      logInfo('Processing incoming message mode')
      if (!requestData.message_data || !requestData.message_data.from_phone || !requestData.message_data.message_body || !requestData.message_data.clinic_id) {
        throw new Error('Invalid incoming_message data: missing required fields')
      }
      const result = await processIncomingMessage(requestData.message_data, supabase)
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      throw new Error('Invalid mode specified')
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