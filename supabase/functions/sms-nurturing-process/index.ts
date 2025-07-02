import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface IncomingMessage {
  from_phone?: string
  from_email?: string
  message_body: string
  clinic_id: string
  message_type: 'sms' | 'email'
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
  phone?: string
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

// Utility function to extract name from message
function extractNameFromMessage(message: string): { first_name?: string, last_name?: string } {
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
  messageType: 'welcome' | 'followup_4h' | 'followup_2d' | 'followup_weekly',
  originalMessage?: string,
  conversationHistory?: Conversation[]
): Promise<string> {
  const fallbackMessages = {
    welcome: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! 👋 Thanks for rea
    ching out to our clinic. How can we help you today?`,
    followup_4h: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Just checking in - any questions about our services? We're here to help! 🏥`,
    followup_2d: `Hi${lead.first_name ? ` ${lead.first_name}` : ''},\n\nThanks for your interest in our clinic. We offer:\n• 95% patient satisfaction\n• Personalized care plans\n• Quick scheduling\n\nWould you like to book a consultation?\n\nBest,\nYour Clinic Team`,
    followup_weekly: `Hi${lead.first_name ? ` ${lead.first_name}` : ''}! Hope you're well. Ready to prioritize your health? We're here to help! 💙`
  }

  if (!OPENAI_API_KEY) {
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
        systemPrompt = `You are a friendly clinic receptionist. Generate a warm, professional welcome message (1-2 sentences) for a new lead. Use their name if provided and ask how you can help.`
        userPrompt = `New lead${lead.first_name ? ` named ${lead.first_name}` : ''} sent: "${originalMessage}". Generate a welcome response.`
        break
      case 'followup_4h':
        systemPrompt = `You are a caring clinic assistant. Generate a brief SMS follow-up (under 160 chars) for a lead who hasn't responded in 4 hours. Be helpful, not pushy.`
        userPrompt = `Follow up with ${lead.first_name || 'lead'} who contacted us 4 hours ago about: "${originalMessage}"`
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
        max_tokens: messageType === 'followup_2d' ? 300 : 150,
        temperature: 0.7
      })
    })

    if (response.ok) {
      const data = await response.json()
      const generatedMessage = data.choices[0]?.message?.content
      if (generatedMessage) {
        return generatedMessage.trim()
      }
    }
  } catch (error) {
    console.error('Error generating message:', error)
  }

  return fallbackMessages[messageType]
}

// Send SMS using Twilio
async function sendSMS(toPhone: string, message: string, clinicId: string, supabase: any): Promise<{ success: boolean, error?: string }> {
  try {
    const { data: smsSettings } = await supabase
      .from('email_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('clinic_id', clinicId)
      .single()

    if (!smsSettings?.twilio_account_sid) {
      return { success: false, error: 'SMS settings not configured' }
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

    return { success: response.ok, error: response.ok ? undefined : await response.text() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Send Email using external function
async function sendEmail(toEmail: string, subject: string, message: string, clinicId: string, threadId: string): Promise<{ success: boolean, error?: string }> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        to_email: toEmail,
        subject: subject,
        message: message,
        clinic_id: clinicId,
        thread_id: threadId
      })
    })

    return { success: response.ok, error: response.ok ? undefined : await response.text() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Process incoming message
async function processIncomingMessage(messageData: IncomingMessage, supabase: any) {
  try {
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
    
    if (messageData.from_phone) {
      const { data: existingLead } = await supabase
        .from('lead')
        .select('*')
        .eq('phone', messageData.from_phone)
        .eq('clinic_id', messageData.clinic_id)
        .single()
      
      lead = existingLead
    }

    // Create new lead if doesn't exist
    if (!lead) {
      const extractedName = extractNameFromMessage(messageData.message_body)
      
      const { data: createdLead, error: leadError } = await supabase
        .from('lead')
        .insert({
          first_name: extractedName.first_name || messageData.from_name,
          last_name: extractedName.last_name,
          phone: messageData.from_phone,
          email: messageData.from_email,
          status: 'new',
          source_id: smsSource.id,
          clinic_id: messageData.clinic_id,
          notes: `First contact via ${messageData.message_type.toUpperCase()}: "${messageData.message_body}"`,
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
    } else {
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
    } else {
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
    }

    // Save the incoming message
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
    if (isNewLead && messageData.message_type === 'sms' && messageData.from_phone) {
      const welcomeMessage = await generateMessage(lead, 'welcome', messageData.message_body)
      
      const smsSent = await sendSMS(messageData.from_phone, welcomeMessage, messageData.clinic_id, supabase)
      
      if (smsSent.success) {
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
      }
    }

    return {
      success: true,
      lead_id: lead.id,
      thread_id: thread.id,
      message: 'Message processed successfully'
    }

  } catch (error: any) {
    console.error('Error processing message:', error)
    throw error
  }
}

// Process follow-ups for all clinics
async function processFollowUps(supabase: any) {
  const now = new Date()
  let totalProcessed = 0
  let totalErrors = 0

  try {
    // Get all clinics
    const { data: clinics, error: clinicError } = await supabase
      .from('clinic')
      .select('id')

    if (clinicError) {
      console.error('Error fetching clinics:', clinicError)
      return { processed: 0, errors: 1 }
    }

    if (!clinics || clinics.length === 0) {
      console.log('No clinics found for follow-up')
      return { processed: 0, errors: 0 }
    }

    // Process follow-ups for each clinic
    for (const clinic of clinics) {
      let processed = 0
      let errors = 0

      try {
        const { data: leads, error: fetchError } = await supabase
          .from('lead')
          .select(`
            id,
            first_name,
            last_name,
            phone,
            email,
            status,
            clinic_id,
            created_at,
            thread:thread!inner (
              id,
              status,
              conversation (
                message,
                timestamp,
                is_from_user,
                sender_type,
                created_at,
                updated_at
              )
            )
          `)
          .eq('status', 'new')
          .eq('thread.status', 'active')
          .eq('clinic_id', clinic.id)
          .not('phone', 'is', null)

        if (fetchError) {
          console.error(`Error fetching leads for clinic ${clinic.id}:`, fetchError)
          errors++
          continue
        }

        if (!leads || leads.length === 0) {
          console.log(`No active leads found for clinic ${clinic.id}`)
          continue
        }

        for (const lead of leads) {
          try {
            const thread = lead.thread[0]
            if (!thread) continue

            const lastConversation = thread.conversation
              .sort((a: Conversation, b: Conversation) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]

            if (!lastConversation) continue

            const lastMessageTime = new Date(lastConversation.updated_at)
            const timeSinceLastMessage = now.getTime() - lastMessageTime.getTime()
            const hoursSince = timeSinceLastMessage / (1000 * 60 * 60)
            const daysSince = timeSinceLastMessage / (1000 * 60 * 60 * 24)

            if (!lastConversation.is_from_user) {
              continue
            }

            const conversationHistory = thread.conversation
              .sort((a: Conversation, b: Conversation) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .slice(0, 5)

            const firstMessage = thread.conversation.find((c: Conversation) => c.is_from_user)?.message || ''

            let followUpType = null
            let messageTemplate = ''
            let subject = 'Following up on your inquiry'

            if (hoursSince >= 4 && hoursSince < 6) {
              const { data: existingFollowup } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .gte('created_at', new Date(lastMessageTime.getTime() + 4 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .single()

              if (!existingFollowup) {
                followUpType = 'sms'
                messageTemplate = 'followup_4h'
              }
            } else if (daysSince >= 2 && daysSince < 2.2 && lead.email) {
              const { data: existingFollowup } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .gte('created_at', new Date(lastMessageTime.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .single()

              if (!existingFollowup) {
                followUpType = 'email'
                messageTemplate = 'followup_2d'
              }
            } else if (daysSince >= 7 && Math.floor(daysSince) % 7 === 0 && daysSince <= 84) {
              const weeksSince = Math.floor(daysSince / 7)
              const { data: existingFollowup } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', thread.id)
                .eq('is_from_user', false)
                .gte('created_at', new Date(lastMessageTime.getTime() + (weeksSince * 7 - 0.5) * 24 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .single()

              if (!existingFollowup) {
                followUpType = 'sms'
                messageTemplate = 'followup_weekly'
              }
            }

            if (followUpType && messageTemplate) {
              const message = await generateMessage(lead, messageTemplate as any, firstMessage, conversationHistory)

              let sendResult = { success: false, error: 'Unknown error' }

              if (followUpType === 'sms' && lead.phone) {
                sendResult = await sendSMS(lead.phone, message, lead.clinic_id, supabase)
              } else if (followUpType === 'email' && lead.email) {
                sendResult = await sendEmail(lead.email, subject, message, lead.clinic_id, thread.id)
              }

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

                processed++
              } else {
                console.error(`Failed to send ${messageTemplate} to lead ${lead.id} for clinic ${clinic.id}:`, sendResult.error)
                errors++
              }
            }

          } catch (error: any) {
            console.error(`Error processing follow-up for lead ${lead.id} in clinic ${clinic.id}:`, error)
            errors++
          }
        }

        totalProcessed += processed
        totalErrors += errors
        console.log(`Processed ${processed} follow-ups with ${errors} errors for clinic ${clinic.id}`)

      } catch (error: any) {
        console.error(`Error processing clinic ${clinic.id}:`, error)
        totalErrors++
      }
    }

    return { processed: totalProcessed, errors: totalErrors }

  } catch (error: any) {
    console.error('Error in processFollowUps:', error)
    return { processed: 0, errors: 1 }
  }
}

// Handle Twilio webhook
async function handleTwilioWebhook(formData: FormData, supabase: any) {
  const twilioData = {
    from: formData.get('From') as string,
    to: formData.get('To') as string,
    body: formData.get('Body') as string,
    messageSid: formData.get('MessageSid') as string,
    accountSid: formData.get('AccountSid') as string
  }

  const { data: clinicSettings } = await supabase
    .from('email_settings')
    .select('clinic_id')
    .eq('twilio_phone_number', twilioData.to)
    .single()

  if (!clinicSettings) {
    throw new Error('No clinic found for phone number: ' + twilioData.to)
  }

  return await processIncomingMessage({
    from_phone: twilioData.from,
    message_body: twilioData.body,
    clinic_id: clinicSettings.clinic_id,
    message_type: 'sms'
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
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
    
    if (requestData.mode === 'process_followups') {
      const result = await processFollowUps(supabase)
      
      return new Response(
        JSON.stringify({
          success: true,
          processed: result.processed,
          errors: result.errors,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      const result = await processIncomingMessage(requestData, supabase)
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error: any) {
    console.error('Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})