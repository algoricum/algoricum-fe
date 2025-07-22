import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface LeadRequest {
  name: string
  email: string
  phone_number: string
  clinic_id: string
  message: string
}

async function handleLeadCreation(request: Request): Promise<Response> {
  try {
    console.log('Processing lead creation request...')

    const body: LeadRequest = await request.json()
        console.log('Processing lead creation request...', body)

    const { name, email, phone_number, clinic_id, message } = body[0]

    // Validate required fields
    if (!name || !email || !clinic_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: 'name, email, and clinic_id are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid email format',
          details: 'Please provide a valid email address' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate clinic_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinic_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid clinic_id format',
          details: 'clinic_id must be a valid UUID' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Split name into firstname and lastname
    const [first_name, ...lastnameParts] = name.trim().split(' ')
    const last_name = lastnameParts.join(' ') || ''

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch source_id from lead_source where name = 'Zapier'
    const { data: sourceData, error: sourceError } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'Zapier')
      .single()

    if (sourceError || !sourceData) {
      console.error('Error fetching lead source:', sourceError)
      return new Response(
        JSON.stringify({ 
          error: 'Lead source not found',
          details: 'Could not find Zapier in lead_source table' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const source_id = sourceData.id

    // Insert lead into lead table
    const { data: lead, error: leadError } = await supabase
      .from('lead')
      .insert({
        first_name,
        last_name,
        email,
        phone: phone_number || null,
        status: 'new',
        clinic_id,
        source_id,
      })
      .select()
      .single()

    if (leadError) {
      console.error('Error inserting lead:', leadError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save lead',
          details: leadError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Lead saved successfully:', lead.id)

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Lead created successfully',
        lead: {
          id: lead.id,
          firstname: lead.firstname,
          lastname: lead.lastname,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          clinic_id: lead.clinic_id,
          source_id: lead.source_id,
          message // Include message in response for reference
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing lead:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only handle POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        details: 'Only POST requests are supported' 
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  return await handleLeadCreation(req)
})