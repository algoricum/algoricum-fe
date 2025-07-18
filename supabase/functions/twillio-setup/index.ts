import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get request data
    const { clinic_id, area_code } = await req.json()

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if clinic already has a number
    const { data: existingRecord } = await supabaseClient
      .from('email-settings')
      .select('*')
      .eq('clinic_id', clinic_id)
      .single()

    if (existingRecord) {
      return new Response(
        JSON.stringify({ 
          error: 'Clinic already has a phone number assigned',
          existing_number: existingRecord.twilio_phone_number 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Twilio credentials from environment
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const baseUrl = Deno.env.get('BASE_URL') || 'https://your-app.com'

    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create basic auth header for Twilio
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

    // Step 1: Search for available numbers
    let searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&Limit=5`
    
    if (area_code) {
      searchUrl += `&AreaCode=${area_code}`
    }

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const searchData = await searchResponse.json()

    if (!searchData.available_phone_numbers || searchData.available_phone_numbers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No available phone numbers found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the first available number
    const selectedNumber = searchData.available_phone_numbers[0].phone_number

    // Step 2: Purchase the number
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`
    
    const purchaseBody = new URLSearchParams({
      PhoneNumber: selectedNumber,
      SmsUrl: `${baseUrl}/api/sms/webhook/${clinic_id}`,
      SmsMethod: 'POST'
    })

    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: purchaseBody
    })

    const purchaseData = await purchaseResponse.json()

    if (!purchaseResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to purchase phone number', 
          details: purchaseData 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 3: Save to Supabase
    const { data, error } = await supabaseClient
      .from('twilio_config')
      .insert({
        clinic_id: clinic_id,
        twilio_sid: purchaseData.sid,
        twilio_phone_number: purchaseData.phone_number,
        sms_enabled: true
      })
      .select()
      .single()

    if (error) {
      // If database save fails, we should ideally release the Twilio number
      // For now, just log the error
      console.error('Database save failed:', error)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save phone number to database', 
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS number assigned successfully',
        phone_number: purchaseData.phone_number,
        formatted_number: formatPhoneNumber(purchaseData.phone_number),
        twilio_sid: purchaseData.sid,
        clinic_id: clinic_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge Function Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to format phone number
function formatPhoneNumber(phoneNumber: string): string {
  // Remove +1 and format as (XXX) XXX-XXXX
  const cleaned = phoneNumber.replace('+1', '')
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
}