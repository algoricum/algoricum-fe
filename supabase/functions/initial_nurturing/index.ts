// supabase/functions/sms-initial-contact/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

// Import shared logic from _shared folder
import { 
  processAllLeads, 
  FOLLOW_UP_RULES, 
  generateIntelligentResponse,
  sendSMS,
  handleTwilioWebhook 
} from '../_shared/nurturing.ts'

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

interface Clinic {
  id: string
  name: string
  openai_api_key?: string
  assistant_prompt?: string
  assistant_model?: string
  chatbot_name?: string
}

// Enhanced logging function
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] SMS-INITIAL: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] SMS-INITIAL ERROR: ${message}`, error)
}

// Process initial contact SMS (5-minute rule only)
async function processInitialContact(supabase: any) {
  logInfo('=== Starting Initial Contact SMS Processing ===')
  
  try {
    // Filter for only the initial_contact rule
    const initialContactRule = FOLLOW_UP_RULES.find(rule => rule.name === 'initial_contact')
    
    if (!initialContactRule) {
      logError('Initial contact rule not found in FOLLOW_UP_RULES')
      return {
        success: false,
        error: 'Initial contact rule not configured',
        processed: 0,
        errors: 1
      }
    }
    
    logInfo('Processing with rule:', initialContactRule)
    
    // Get all clinics with active Twilio settings
    const { data: clinics, error: clinicError } = await supabase
      .from('clinic')
      .select(`
        id,
        name,
        openai_api_key,
        assistant_prompt,
        assistant_model,
        chatbot_name,
        twilio_config!inner(
          twilio_account_sid,
          twilio_auth_token,
          twilio_phone_number,
          status
        )
      `)
      .eq('twilio_config.status', 'active')

    if (clinicError) {
      logError('Error fetching clinics with Twilio settings', clinicError)
      return {
        success: false,
        error: 'Failed to fetch clinics',
        processed: 0,
        errors: 1
      }
    }

    if (!clinics || clinics.length === 0) {
      logInfo('No clinics with active Twilio settings found')
      return {
        success: true,
        processed: 0,
        errors: 0,
        message: 'No clinics with SMS capabilities'
      }
    }

    logInfo(`Found ${clinics.length} clinics with SMS capabilities`)

    let totalProcessed = 0
    let totalErrors = 0
    const results = []

    // Process each clinic
    for (const clinic of clinics) {
      try {
        const twilioConfig = clinic.twilio_config[0]
        if (!twilioConfig) continue

        logInfo(`Processing clinic: ${clinic.name}`)

        // Get NEW leads created in the last 5 minutes with phone numbers
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

        const { data: newLeads, error: leadsError } = await supabase
          .from('lead')
          .select('*')
          .eq('clinic_id', clinic.id) // Filters by clinic_id
          .or('status.eq.New,created_at.gte.' + fiveMinutesAgo.toISOString()) // Selects leads where status is 'New' OR created_at is within the last 5 minutes
          .not('phone', 'is', null) // Filters out leads with null phone
          .neq('phone', ''); // Filters out leads with empty phone


        if (leadsError) {
          logError(`Error fetching leads for clinic ${clinic.id}`, leadsError)
          totalErrors++
          continue
        }

        logInfo(`Found ${newLeads?.length || 0} new leads for clinic ${clinic.name}`)

        // Process each new lead
        for (const lead of newLeads || []) {
          try {
            // Check if thread exists and if welcome message was already sent
            const { data: existingThread } = await supabase
              .from('threads')
              .select('id')
              .eq('lead_id', lead.id)
              .single()

            let threadId = existingThread?.id
            let shouldSendWelcome = !existingThread

            if (existingThread) {
              // Check if initial contact was already sent
              const { data: existingMessages } = await supabase
                .from('conversation')
                .select('id')
                .eq('thread_id', existingThread.id)
                .eq('is_from_user', false)
                .eq('sender_type', 'assistant')

              shouldSendWelcome = !existingMessages || existingMessages.length === 0
            }

            if (!shouldSendWelcome) {
              logInfo(`Lead ${lead.id} already has initial contact sent`)
              results.push({
                leadId: lead.id,
                action: 'skipped',
                reason: 'Initial contact already sent'
              })
              continue
            }

            // Create thread if needed
            if (!threadId) {
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
                totalErrors++
                continue
              }
              threadId = newThread.id
            }

            // Generate intelligent welcome message
            const welcomeMessage = await generateIntelligentResponse(
              lead, 
              clinic, 
              [], // No conversation history for initial contact
              false // SMS
            ) as string

            // Send SMS
            const smsResult = await sendSMS(
              lead.phone, 
              welcomeMessage, 
              lead.clinic_id, 
              supabase, 
              twilioConfig
            )

            if (smsResult.success) {
              // Save message to conversation
              await supabase
                .from('conversation')
                .insert({
                  thread_id: threadId,
                  message: `INITIAL_CONTACT: ${welcomeMessage}`,
                  timestamp: now.toISOString(),
                  is_from_user: false,
                  sender_type: 'assistant'
                })

              totalProcessed++
              logInfo(`Initial contact SMS sent to lead ${lead.id}`)
              
              results.push({
                leadId: lead.id,
                action: 'sent',
                reason: 'Initial contact SMS sent successfully'
              })
            } else {
              logError(`Failed to send initial contact SMS to lead ${lead.id}`, smsResult.error)
              totalErrors++
              
              results.push({
                leadId: lead.id,
                action: 'error',
                reason: 'Failed to send SMS',
                error: smsResult.error
              })
            }

          } catch (error: any) {
            logError(`Error processing lead ${lead.id}`, error)
            totalErrors++
            
            results.push({
              leadId: lead.id,
              action: 'error',
              reason: 'Exception during processing',
              error: error.message
            })
          }
        }

      } catch (error: any) {
        logError(`Error processing clinic ${clinic.id}`, error)
        totalErrors++
      }
    }

    logInfo(`Initial contact processing completed: ${totalProcessed} sent, ${totalErrors} errors`)

    return {
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      results,
      rule: 'initial_contact',
      timestamp: new Date().toISOString()
    }

  } catch (error: any) {
    logError('Error in processInitialContact', error)
    return {
      success: false,
      error: error.message,
      processed: 0,
      errors: 1
    }
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

  logInfo('=== SMS Initial Contact Function Called ===')
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
    
    // Handle Twilio webhook
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

    // Process initial contact SMS
    logInfo('Starting initial contact processing')
    const result = await processInitialContact(supabase)
    
    logInfo('Initial contact processing completed', {
      processed: result.processed,
      errors: result.errors
    })
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    logError('Function error', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processed: 0,
        errors: 1,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})