// supabase/functions/sms-initial-contact/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import shared logic from _shared folder
import { 
  FOLLOW_UP_RULES, 
  generateIntelligentResponse,
  sendSMS,
  handleTwilioWebhook,
  determineFollowUpsForLead
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
    // Filter for only the initial contact rule
    const initialContactRule = FOLLOW_UP_RULES.find(rule => rule.name === 'sms_5min_initial')
    
    if (!initialContactRule) {
      logError('SMS initial contact rule not found in FOLLOW_UP_RULES')
      return {
        success: false,
        error: 'SMS initial contact rule not configured',
        processed: 0,
        errors: 1
      }
    }
    
    logInfo('Processing with rule:', initialContactRule.name)
    
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

        // Get NEW leads with phone numbers (simplified query)
        const { data: newLeads, error: leadsError } = await supabase
          .from('lead')
          .select('*')
          .eq('clinic_id', clinic.id)
          .eq('status', 'New') // Only New leads
          .not('phone', 'is', null)
          .neq('phone', '')

        if (leadsError) {
          logError(`Error fetching leads for clinic ${clinic.id}`, leadsError)
          totalErrors++
          continue
        }

        logInfo(`Found ${newLeads?.length || 0} new leads for clinic ${clinic.name}`)

        // Process each new lead using shared logic
        for (const lead of newLeads || []) {
          try {
            // Use shared function to determine if initial contact should be sent
            const applicableRules = await determineFollowUpsForLead(lead, supabase, 'sms')
            const shouldSendInitial = applicableRules.some(rule => rule.name === 'sms_5min_initial')

            if (!shouldSendInitial) {
              logInfo(`Lead ${lead.id} not eligible for initial contact (may already be sent)`)
              results.push({
                leadId: lead.id,
                action: 'skipped',
                reason: 'Initial contact not applicable or already sent'
              })
              continue
            }

            // Get or create thread (using shared logic pattern)
            const threadId = await getOrCreateThread(lead, supabase)
            if (!threadId) {
              totalErrors++
              results.push({
                leadId: lead.id,
                action: 'error',
                reason: 'Failed to create thread'
              })
              continue
            }

            // Generate intelligent welcome message using shared function
            const welcomeMessage = await generateIntelligentResponse(
              lead, 
              clinic, 
              [], // No conversation history for initial contact
              false // SMS
            ) as string

            // Send SMS using shared function
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
                  message: `SMS_5MIN_INITIAL: ${welcomeMessage}`,
                  timestamp: new Date().toISOString(),
                  is_from_user: false,
                  sender_type: 'assistant'
                })

              // Update lead status
              await supabase
                .from('lead')
                .update({ 
                  status: 'Engaged', 
                  updated_at: new Date().toISOString() 
                })
                .eq('id', lead.id)

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
      rule: 'sms_5min_initial',
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

// Helper function (simplified version of shared logic)
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

    return newThread.id

  } catch (error) {
    logError(`Error in getOrCreateThread for lead ${lead.id}`, error)
    return null
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