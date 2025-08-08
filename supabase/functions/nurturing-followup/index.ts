// supabase/functions/nurturing-followups/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import only what we need from shared
import { 
  processAllLeads,
  FOLLOW_UP_RULES
} from '../_shared/nurturing.ts'

// Enhanced logging
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] FOLLOWUPS: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] FOLLOWUPS ERROR: ${message}`, error)
}

// Simple main processing function
async function processNurturingFollowups(supabase: any) {
  logInfo('=== Starting Nurturing Follow-ups Processing ===')
  
  try {
    // Get only follow-up rules (exclude initial contact)
    const followupRules = FOLLOW_UP_RULES.filter(rule => rule.name !== 'sms_5min_initial')
    logInfo(`Processing ${followupRules.length} follow-up rules`)
    
    // Use the shared processAllLeads function - it handles everything
    const result = await processAllLeads(supabase)
    
    if (!result.success) {
      logError('processAllLeads failed', result.error)
      return {
        success: false,
        error: result.error,
        summary: { sms: 0, email: 0, errors: 1 }
      }
    }
    
    // Calculate summary by communication type
    const smsCount = result.results.filter(r => 
      r.action === 'sent' && r.communicationType === 'sms'
    ).length
    
    const emailCount = result.results.filter(r => 
      r.action === 'sent' && r.communicationType === 'email'  
    ).length
    
    const errorCount = result.results.filter(r => r.action === 'error').length
    
    logInfo(`Follow-ups completed: ${smsCount} SMS, ${emailCount} emails, ${errorCount} errors`)
    
    return {
      success: true,
      summary: {
        sms: smsCount,
        email: emailCount,
        errors: errorCount,
        total: smsCount + emailCount
      },
      results: result.results,
      rulesProcessed: followupRules.map(r => r.name),
      timestamp: new Date().toISOString()
    }
    
  } catch (error: any) {
    logError('Error in processNurturingFollowups', error)
    return {
      success: false,
      error: error.message,
      summary: { sms: 0, email: 0, errors: 1 }
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

  logInfo('=== Nurturing Follow-ups Function Called ===')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    logInfo('Supabase client created successfully')

    const result = await processNurturingFollowups(supabase)
    
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
        summary: { sms: 0, email: 0, errors: 1 },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})