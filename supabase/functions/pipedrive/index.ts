// supabase/functions/pipedrive/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() // Get the last part of the path
    
    // Route based on path and method
    if (path === 'oauth-init' && req.method === 'POST') {
      return await handleOAuthInit(req)
    } else if (path === 'oauth-callback' && req.method === 'GET') {
      return await handleOAuthCallback(req)
    } else if (path === 'leads' && req.method === 'GET') {
      return await handleGetLeads(req)
    } else {
      throw new Error('Invalid endpoint or method')
    }

  } catch (error) {
    console.error('Pipedrive function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})

// Handle OAuth initialization
async function handleOAuthInit(req: Request) {
  // Get JWT token from request
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    throw new Error('No authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  })

  // Get user from token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    throw new Error('Invalid user token')
  }

  // Get clinic_id from request body
  const { clinic_id } = await req.json()
  if (!clinic_id) {
    throw new Error('Missing clinic_id')
  }

  // Verify user owns the clinic
  const { data: clinic, error: clinicError } = await supabase
    .from('clinic')
    .select('id')
    .eq('id', clinic_id)
    .eq('owner_id', user.id)
    .single()

  if (clinicError || !clinic) {
    throw new Error('Clinic not found or unauthorized')
  }

  // Get Pipedrive credentials from environment
  const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')!
  const redirectUri = Deno.env.get('PIPEDRIVE_REDIRECT_URI')!

  // Build OAuth URL
  const oauthUrl = new URL('https://oauth.pipedrive.com/oauth/authorize')
  oauthUrl.searchParams.set('client_id', clientId)
  oauthUrl.searchParams.set('redirect_uri', redirectUri)
  oauthUrl.searchParams.set('response_type', 'code')
  oauthUrl.searchParams.set('state', clinic_id) // Pass clinic_id in state
  oauthUrl.searchParams.set('scope', 'deals:read leads:read')

  return new Response(
    JSON.stringify({ 
      success: true, 
      oauth_url: oauthUrl.toString() 
    }),
    {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    }
  )
}

// Handle OAuth callback
async function handleOAuthCallback(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // Contains clinic_id
  
  if (!code || !state) {
    throw new Error('Missing authorization code or state')
  }

  // Initialize Supabase client with service role key for callback
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get Pipedrive credentials from environment
  const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')!
  const clientSecret = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')!
  const redirectUri = Deno.env.get('PIPEDRIVE_REDIRECT_URI')!

  // Exchange code for access token
  const tokenResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for token')
  }

  const tokenData = await tokenResponse.json()
  
  // Calculate expiry time
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + (tokenData.expires_in * 1000))
    : null

  // Save integration to database
  const { data, error } = await supabase
    .from('pipedrive_integration')
    .upsert({
      clinic_id: state,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      api_domain: tokenData.api_domain,
      company_id: tokenData.company_id.toString(),
      user_id: tokenData.user_id.toString(),
      expires_at: expiresAt?.toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'clinic_id'
    })

  if (error) {
    console.error('Database error:', error)
    throw new Error('Failed to save integration')
  }

  // Redirect to success page
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
  return Response.redirect(`${frontendUrl}/integrations?pipedrive=success`)
}

// Handle getting leads
async function handleGetLeads(req: Request) {
  // Get JWT token from request
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    throw new Error('No authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  })

  // Get user from token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    throw new Error('Invalid user token')
  }

  // Get clinic_id from request
  const url = new URL(req.url)
  const clinicId = url.searchParams.get('clinic_id')
  
  if (!clinicId) {
    throw new Error('Missing clinic_id parameter')
  }

  // Verify user owns the clinic and get Pipedrive integration
  const { data: integration, error: integrationError } = await supabase
    .from('pipedrive_integration')
    .select(`
      *,
      clinic!inner(owner_id)
    `)
    .eq('clinic_id', clinicId)
    .eq('clinic.owner_id', user.id)
    .eq('is_active', true)
    .single()

  if (integrationError || !integration) {
    throw new Error('Pipedrive integration not found or unauthorized')
  }

  // Check if token is expired and refresh if needed
  let accessToken = integration.access_token
  if (integration.expires_at && new Date(integration.expires_at) <= new Date()) {
    // Token is expired, refresh it
    if (!integration.refresh_token) {
      throw new Error('Access token expired and no refresh token available')
    }

    const refreshResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        client_id: Deno.env.get('PIPEDRIVE_CLIENT_ID')!,
        client_secret: Deno.env.get('PIPEDRIVE_CLIENT_SECRET')!,
      }),
    })

    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh token')
    }

    const refreshData = await refreshResponse.json()
    accessToken = refreshData.access_token

    // Update token in database
    await supabase
      .from('pipedrive_integration')
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token || integration.refresh_token,
        expires_at: refreshData.expires_in 
          ? new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)
  }

  // Fetch leads from Pipedrive
  const leadsResponse = await fetch(
    `https://${integration.api_domain}/api/v1/leads?limit=100`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!leadsResponse.ok) {
    throw new Error(`Pipedrive API error: ${leadsResponse.status}`)
  }

  const leadsData = await leadsResponse.json()

  // Also fetch deals for additional context
  const dealsResponse = await fetch(
    `https://${integration.api_domain}/api/v1/deals?limit=100&status=open`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const dealsData = dealsResponse.ok ? await dealsResponse.json() : { data: [] }

  return new Response(
    JSON.stringify({
      success: true,
      leads: leadsData.data || [],
      deals: dealsData.data || [],
      total_leads: leadsData.additional_data?.pagination?.total || 0,
      total_deals: dealsData.additional_data?.pagination?.total || 0,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  )
}