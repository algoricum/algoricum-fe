// supabase/functions/lead-manager/index.ts
// Single function that handles incoming messages AND follow-ups

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Get API keys from environment
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
  leadInfo: any, 
  messageType: 'welcome' | 'followup_4h' | 'followup_2d' | 'followup_weekly',
  originalMessage?: string,
  conversationHistory?: any[]
): Promise<string> {
  
  // Fallback messages if OpenAI is not available
  const fallbackMessages = {
    welcome: `Hi${leadInfo.first_name ? ` ${leadInfo.first_name}` : ''}! 👋 Thanks for reaching out to our clinic. We received your message and will get back to you shortly. How can we help you today?`,
    
    followup_4h: `Hi${leadInfo.first_name ? ` ${leadInfo.first_name}` : ''}! Just checking in - did you have any questions about our services? We're here to help! 🏥`,
    
    followup_2d: `Hi${leadInfo.first_name ? ` ${leadInfo.first_name}` : ''},\n\nI wanted to follow up on your inquiry. Many of our patients have had great success with our treatments:\n\n• 95% patient satisfaction rate\n• Personalized care plans\n• Quick appointment scheduling\n\nWould you like to schedule a consultation?\n\nBest regards,\nYour Clinic Team`,
    
    followup_weekly: `Hi${leadInfo.first_name ? ` ${leadInfo.first_name}` : ''}! Hope you're doing well. Just a friendly reminder that we're here when you're ready to prioritize your health. Any questions? 💙`
  }

  if (!OPENAI_API_KEY) {
    return fallbackMessages[messageType]
  }

  try {
    const conversationContext = conversationHistory?.slice(-3)
      .map(msg => `${msg.is_from_user ? 'Patient' : 'Clinic'}: ${msg.message}`)
      .join('\n') || 'No previous conversation'

    let systemPrompt = ''
    let userPrompt = ''

    switch (messageType) {
      case 'welcome':
        systemPrompt = `You are a friendly clinic receptionist. Generate a warm, professional welcome message for a new lead. Keep it brief (1-2 sentences), welcoming, and ask how you can help. Use their name if provided.`
        userPrompt = `New lead${leadInfo.first_name ? ` named ${leadInfo.first_name}` : ''} sent: "${originalMessage}". Generate a welcome response.`
        break
        
      case 'followup_4h':
        systemPrompt = `You are a caring clinic follow-up assistant. Generate a brief SMS follow-up (under 160 chars) for a lead who hasn't responded in 4 hours. Be helpful, not pushy.`
        userPrompt = `Follow up with ${leadInfo.first_name || 'lead'} who contacted us 4 hours ago about: "${originalMessage}"`
        break
        
      case 'followup_2d':
        systemPrompt = `Generate a professional email follow-up for a lead who hasn't responded in 2 days. Include success stories and value proposition. Keep under 200 words.`
        userPrompt = `Email follow-up for ${leadInfo.first_name || 'lead'} who initially asked about: "${originalMessage}"`
        break
        
      case 'followup_weekly':
        systemPrompt = `Generate a gentle weekly SMS check-in (under 160 chars) for a lead. Be supportive and health-focused, not sales-y.`
        userPrompt = `Weekly check-in for ${leadInfo.first_name || 'lead'}`
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

// Send Email using your existing email function
async function sendEmail(toEmail: string, subject: string, message: string, clinicId: string): Promise<{ success: boolean, error?: string }> {
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
        clinic_id: clinicId
      })
    })

    return { success: response.ok, error: response.ok ? undefined : await response.text() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Process incoming message
async function processIncomingMessage(messageData: IncomingMessage, supabase: any) {
  console.log('Processing incoming message:', messageData)

  try {
    // 1. Get SMS lead source ID
    const { data: smsSource } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'SMS')
      .single()

    if (!smsSource) {
      throw new Error('SMS lead source not found')
    }

    // 2. Check if lead already exists
    let lead = null
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

    // 3. Create new lead if doesn't exist
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
      console.log('Created new lead:', lead.id)
    } else {
      // Update existing lead
      await supabase
        .from('lead')
        .update({ 
          updated_at: new Date().toISOString(),
          notes: `${lead.notes || ''}\n\nNew message (${new Date().toISOString()}): "${messageData.message_body}"`
        })
        .eq('id', lead.id)
    }

    // 4. Get or create thread
    let thread = null
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

    // 5. Save the incoming message
    await supabase
      .from('conversation')
      .insert({
        thread_id: thread.id,
        message: messageData.message_body,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_from_user: true
      })

    // 6. Send immediate welcome message for new leads
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
            is_from_user: false
          })

        console.log('Sent welcome SMS to:', messageData.from_phone)
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

// Process follow-ups based on conversation timestamps
async function processFollowUps(supabase: any) {
  console.log('Processing follow-ups...')
  
  const now = new Date()
  let processed = 0
  let errors = 0

  try {
    // Get all active leads with their last conversation details
    const { data: leadsWithLastMessage, error: fetchError } = await supabase
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
          last_conversation:conversation (
            message,
            timestamp,
            is_from_user,
            created_at,
            updated_at
          )
        )
      `)
      .eq('status', 'new')
      .eq('thread.status', 'active')
      .not('phone', 'is', null)

    if (fetchError) {
      console.error('Error fetching leads:', fetchError)
      return { processed: 0, errors: 1 }
    }

    if (!leadsWithLastMessage || leadsWithLastMessage.length === 0) {
      console.log('No active leads found for follow-up')
      return { processed: 0, errors: 0 }
    }

    for (const lead of leadsWithLastMessage) {
      try {
        const thread = lead.thread[0] // Since we're using inner join, there should be exactly one
        if (!thread) continue

        // Get the most recent conversation for this thread
        const { data: lastConversation } = await supabase
          .from('conversation')
          .select('*')
          .eq('thread_id', thread.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        if (!lastConversation) continue

        const lastMessageTime = new Date(lastConversation.updated_at)
        const timeSinceLastMessage = now.getTime() - lastMessageTime.getTime()
        const hoursSince = timeSinceLastMessage / (1000 * 60 * 60)
        const daysSince = timeSinceLastMessage / (1000 * 60 * 60 * 24)

        // Skip if the last message was from us (clinic)
        if (!lastConversation.is_from_user) {
          console.log(`Skipping lead ${lead.id} - last message was from clinic`)
          continue
        }

        // Get conversation history for context
        const { data: conversationHistory } = await supabase
          .from('conversation')
          .select('message, is_from_user, timestamp')
          .eq('thread_id', thread.id)
          .order('timestamp', { ascending: false })
          .limit(5)

        // Get the first message from user for context
        const { data: firstMessage } = await supabase
          .from('conversation')
          .select('message')
          .eq('thread_id', thread.id)
          .eq('is_from_user', true)
          .order('timestamp', { ascending: true })
          .limit(1)
          .single()

        const originalMessage = firstMessage?.message || ''

        // Determine what follow-up to send based on time elapsed
        let followUpType = null
        let messageTemplate = ''

        if (hoursSince >= 4 && hoursSince < 6) {
          // 4-hour follow-up (SMS)
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
        } else if (daysSince >= 2 && daysSince < 2.2) {
          // 2-day follow-up (Email)
          const { data: existingFollowup } = await supabase
            .from('conversation')
            .select('id')
            .eq('thread_id', thread.id)
            .eq('is_from_user', false)
            .gte('created_at', new Date(lastMessageTime.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1)
            .single()

          if (!existingFollowup && lead.email) {
            followUpType = 'email'
            messageTemplate = 'followup_2d'
          }
        } else if (daysSince >= 7 && Math.floor(daysSince) % 7 === 0 && daysSince <= 84) {
          // Weekly follow-up (SMS) - up to 12 weeks
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

        // Send the follow-up if needed
        if (followUpType && messageTemplate) {
          console.log(`Sending ${messageTemplate} to lead ${lead.id}`)

          const message = await generateMessage(
            lead, 
            messageTemplate as any, 
            originalMessage, 
            conversationHistory
          )

          let sendResult = { success: false, error: 'Unknown error' }

          if (followUpType === 'sms' && lead.phone) {
            sendResult = await sendSMS(lead.phone, message, lead.clinic_id, supabase)
          } else if (followUpType === 'email' && lead.email) {
            let subject = 'Following up on your inquiry'
            let emailMessage = message
            
            if (message.includes('Subject:')) {
              const lines = message.split('\n')
              subject = lines[0].replace('Subject:', '').trim()
              emailMessage = lines.slice(1).join('\n').trim()
            }
            
            sendResult = await sendEmail(lead.email, subject, emailMessage, lead.clinic_id)
          }

          if (sendResult.success) {
            // Save the follow-up message to conversation
            await supabase
              .from('conversation')
              .insert({
                thread_id: thread.id,
                message: message,
                timestamp: now.toISOString(),
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                is_from_user: false
              })

            console.log(`Sent ${messageTemplate} to lead ${lead.id}`)
            processed++
          } else {
            console.error(`Failed to send ${messageTemplate} to lead ${lead.id}:`, sendResult.error)
            errors++
          }
        }

      } catch (error: any) {
        console.error(`Error processing follow-up for lead ${lead.id}:`, error)
        errors++
      }
    }

    return { processed, errors }

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

  console.log('Received Twilio webhook:', twilioData)

  // Find which clinic this phone number belongs to
  const { data: clinicSettings } = await supabase
    .from('email_settings')
    .select('clinic_id')
    .eq('twilio_phone_number', twilioData.to)
    .single()

  if (!clinicSettings) {
    throw new Error('No clinic found for phone number: ' + twilioData.to)
  }

  // Process the incoming message
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const contentType = req.headers.get('content-type') || ''
    
    // Handle Twilio webhook (form data)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log('Processing Twilio webhook')
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

    // Handle JSON requests (API calls)
    const requestData = await req.json()
    
    if (requestData.mode === 'process_followups') {
      console.log('Processing follow-ups')
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
      // Process incoming message
      console.log('Processing incoming message')
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