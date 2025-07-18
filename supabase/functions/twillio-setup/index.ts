import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log request initiation
    console.log('Starting twilio-setup edge function', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers),
    });

    // Initialize Supabase client
    console.log('Initializing Supabase client', {
      supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'set' : 'not set',
      anonKey: Deno.env.get('SUPABASE_ANON_KEY') ? 'set' : 'not set',
    });
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get and log request data
    const { clinic_id, phone_number, name, twilio_config_id } = await req.json()
    console.log('Received request payload', {
      clinic_id,
      phone_number,
      name,
      twilio_config_id,
    });

    if (!clinic_id || !phone_number || !name) {
      console.log('Validation failed: Missing required fields', {
        clinic_id: !!clinic_id,
        phone_number: !!phone_number,
        name: !!name,
      });
      return new Response(
        JSON.stringify({ error: 'clinic_id, phone_number, and name are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // // Validate clinic_id exists
    // console.log('Checking if clinic_id exists in clinics table', { clinic_id });
    // const { data: clinicExists } = await supabaseClient
    //   .from('clinics')
    //   .select('id')
    //   .eq('id', clinic_id)
    //   .single();

    // if (!clinicExists) {
    //   console.log('Clinic validation failed: Clinic does not exist', { clinic_id });
    //   return new Response(
    //     JSON.stringify({ error: 'Invalid clinic_id: Clinic does not exist' }),
    //     { 
    //       status: 400, 
    //       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    //     }
    //   )
    // }
    // console.log('Clinic validated successfully', { clinic_id });

    // Check if clinic already has an active Twilio configuration
    console.log('Checking for existing twilio_config record', { clinic_id, phone_number });
    const { data: existingRecord } = await supabaseClient
      .from('twilio_config')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('phone_number', phone_number)
      .neq('status', 'failed') // Allow retry if status is failed
      .single()

    if (existingRecord && existingRecord.status === 'active') {
      console.log('Existing active Twilio configuration found', {
        clinic_id,
        phone_number,
        twilio_phone_number: existingRecord.twilio_phone_number,
        status: existingRecord.status,
      });
      return new Response(
        JSON.stringify({ 
          error: 'Clinic already has an active phone number assigned',
          existing_number: existingRecord.twilio_phone_number 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    console.log('No active twilio_config record found or status is failed, proceeding', {
      existingRecord: existingRecord ? { id: existingRecord.id, status: existingRecord.status } : null,
    });

    // Twilio credentials from environment
    console.log('Checking Twilio credentials');
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const baseUrl = Deno.env.get('BASE_URL') || 'https://your-app.com'
    console.log('Twilio environment variables', {
      twilioAccountSid: twilioAccountSid ? 'set' : 'not set',
      twilioAuthToken: twilioAuthToken ? 'set' : 'not set',
      baseUrl,
    });

    if (!twilioAccountSid || !twilioAuthToken) {
      console.log('Twilio credentials missing, updating twilio_config to failed if exists', { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient
          .from('twilio_config')
          .update({ status: 'failed' })
          .eq('id', twilio_config_id)
      }
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
    console.log('Twilio auth header created');

    // Step 1: Search for available numbers
    let searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&Limit=5`
    
    // Extract area code from phone_number if provided
    const areaCodeMatch = phone_number.match(/^\+1(\d{3})/)
    if (areaCodeMatch) {
      searchUrl += `&AreaCode=${areaCodeMatch[1]}`
      console.log('Area code extracted from phone_number', { areaCode: areaCodeMatch[1] });
    } else {
      console.log('No area code provided in phone_number, proceeding without area code filter');
    }
    console.log('Searching for available Twilio numbers', { searchUrl });

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const searchData = await searchResponse.json()
    console.log('Twilio number search response', {
      status: searchResponse.status,
      ok: searchResponse.ok,
      availableNumbersCount: searchData.available_phone_numbers?.length || 0,
    });

    if (!searchData.available_phone_numbers || searchData.available_phone_numbers.length === 0) {
      console.log('No available phone numbers found, updating twilio_config to failed if exists', { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient
          .from('twilio_config')
          .update({ status: 'failed' })
          .eq('id', twilio_config_id)
      }
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
    console.log('Selected Twilio phone number', { selectedNumber });

    // Step 2: Purchase the number
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`
    const purchaseBody = new URLSearchParams({
      PhoneNumber: selectedNumber,
      SmsUrl: `${baseUrl}/api/sms/webhook/${clinic_id}`,
      SmsMethod: 'POST'
    })
    console.log('Purchasing Twilio phone number', {
      purchaseUrl,
      phoneNumber: selectedNumber,
      smsUrl: `${baseUrl}/api/sms/webhook/${clinic_id}`,
    });

    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: purchaseBody
    })

    const purchaseData = await purchaseResponse.json()
    console.log('Twilio purchase response', {
      status: purchaseResponse.status,
      ok: purchaseResponse.ok,
      phone_number: purchaseData.phone_number,
      sid: purchaseData.sid,
    });

    if (!purchaseResponse.ok) {
      console.log('Failed to purchase phone number, updating twilio_config to failed if exists', {
        twilio_config_id,
        errorDetails: purchaseData,
      });
      if (twilio_config_id) {
        await supabaseClient
          .from('twilio_config')
          .update({ status: 'failed' })
          .eq('id', twilio_config_id)
      }
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

    // Step 3: Update or insert into twilio_config
    const twilioConfigData = {
      clinic_id,
      phone_number: "+12264074828",
      twilio_account_sid: twilioAccountSid,
      twilio_auth_token: twilioAuthToken,
      twilio_phone_number: purchaseData.phone_number,
      status: 'active',
    }
    console.log('Preparing to upsert twilio_config', { twilioConfigData, twilio_config_id });

    let upsertResult
    if (twilio_config_id) {
      // Update existing record
      console.log('Updating existing twilio_config record', { twilio_config_id });
      upsertResult = await supabaseClient
        .from('twilio_config')
        .update(twilioConfigData)
        .eq('id', twilio_config_id)
        .select()
        .single()
    } else {
      // Insert new record
      console.log('Inserting new twilio_config record');
      upsertResult = await supabaseClient
        .from('twilio_config')
        .insert(twilioConfigData)
        .select()
        .single()
    }

    const { data, error } = upsertResult
    if (error) {
      console.error('Database save failed', {
        operation: twilio_config_id ? 'update' : 'insert',
        twilio_config_id,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save Twilio configuration to database', 
          details: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    console.log('Successfully upserted twilio_config', { twilio_config_id: data.id });

    // Success response
    console.log('Returning success response', {
      phone_number: purchaseData.phone_number,
      twilio_sid: purchaseData.sid,
      clinic_id,
      twilio_config_id: data.id,
    });
    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS number assigned successfully',
        phone_number: purchaseData.phone_number,
        formatted_number: formatPhoneNumber(purchaseData.phone_number),
        twilio_sid: purchaseData.sid,
        clinic_id,
        twilio_config_id: data.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge Function Error', {
      message: error.message,
      stack: error.stack,
    });
    
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
  console.log('Formatting phone number', { phoneNumber });
  // Remove +1 and format as (XXX) XXX-XXXX
  const cleaned = phoneNumber.replace('+1', '')
  const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  console.log('Formatted phone number', { formatted });
  return formatted
}