// supabase/functions/pipedrive/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`🚀 Function called: ${req.method} ${req.url}`)
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() // Get the last part of the path
    
    console.log(`📍 Parsed path: ${path}, Method: ${req.method}`)
    
    // Route based on path and method
    if (path === 'oauth-init' && req.method === 'POST') {
      console.log('🔑 Routing to OAuth initialization')
      return await handleOAuthInit(req)
    } else if (path === 'oauth-callback' && req.method === 'GET') {
      console.log('🔄 Routing to OAuth callback')
      return await handleOAuthCallback(req)
    } else if (path === 'leads' && req.method === 'GET') {
      console.log('📊 Routing to get leads')
      return await handleGetLeads(req)
    } else {
      console.error(`❌ Invalid endpoint: ${path} with method: ${req.method}`)
      throw new Error('Invalid endpoint or method')
    }

  } catch (error) {
    console.error('💥 Main function error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    })
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
  console.log('🔑 Starting OAuth initialization')
  
  try {
    // Get JWT token from request
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ No authorization header found')
      throw new Error('No authorization header')
    }
    console.log('✅ Authorization header found')

    const token = authHeader.replace('Bearer ', '')
    console.log(`🎫 Token extracted (length: ${token.length})`)
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')
    const redirectUri = Deno.env.get('PIPEDRIVE_REDIRECT_URI')
    
    console.log('🔧 Environment variables check:', {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseKey ? '✅ Set' : '❌ Missing',
      clientId: clientId ? '✅ Set' : '❌ Missing',
      redirectUri: redirectUri ? '✅ Set' : '❌ Missing'
    })
    
    if (!supabaseUrl || !supabaseKey || !clientId || !redirectUri) {
      throw new Error('Missing required environment variables')
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })
    console.log('🗄️ Supabase client initialized')

    // Get user from token
    console.log('👤 Verifying user token...')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('❌ User token verification failed:', userError?.message)
      throw new Error('Invalid user token')
    }
    console.log(`✅ User verified: ${user.id}`)

    // Get clinic_id from request body
    console.log('📦 Parsing request body...')
    const requestBody = await req.json()
    console.log('📦 Request body:', requestBody)
    
    const { clinic_id } = requestBody
    if (!clinic_id) {
      console.error('❌ Missing clinic_id in request body')
      throw new Error('Missing clinic_id')
    }
    console.log(`🏥 Clinic ID: ${clinic_id}`)

    // Verify user owns the clinic
    console.log('🔍 Verifying clinic ownership...')
    const { data: clinic, error: clinicError } = await supabase
      .from('clinic')
      .select('id')
      .eq('id', clinic_id)
      .eq('owner_id', user.id)
      .single()

    if (clinicError) {
      console.error('❌ Clinic query error:', clinicError)
      throw new Error('Clinic not found or unauthorized')
    }
    
    if (!clinic) {
      console.error('❌ Clinic not found or user not authorized')
      throw new Error('Clinic not found or unauthorized')
    }
    console.log('✅ Clinic ownership verified')

    // Build OAuth URL
    console.log('🔗 Building OAuth URL...')
    const oauthUrl = new URL('https://oauth.pipedrive.com/oauth/authorize')
    oauthUrl.searchParams.set('client_id', clientId)
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('response_type', 'code')
    oauthUrl.searchParams.set('state', clinic_id)
    oauthUrl.searchParams.set('scope', 'deals:read leads:read')

    console.log('✅ OAuth URL built:', oauthUrl.toString())

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
  } catch (error) {
    console.error('💥 OAuth init error:', {
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

// Handle OAuth callback
async function handleOAuthCallback(req: Request) {
  console.log('🔄 Starting OAuth callback handling')
  
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // Contains clinic_id
    
    console.log('📥 Callback parameters:', {
      code: code ? `${code.substring(0, 10)}...` : 'Missing',
      state: state || 'Missing',
      fullUrl: req.url
    })
    
    if (!code || !state) {
      console.error('❌ Missing required callback parameters')
      throw new Error('Missing authorization code or state')
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')
    const clientSecret = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('PIPEDRIVE_REDIRECT_URI')
    const frontendUrl = Deno.env.get('FRONTEND_URL')
    
    console.log('🔧 Environment variables check:', {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseKey ? '✅ Set' : '❌ Missing',
      clientId: clientId ? '✅ Set' : '❌ Missing',
      clientSecret: clientSecret ? '✅ Set (hidden)' : '❌ Missing',
      redirectUri: redirectUri ? '✅ Set' : '❌ Missing',
      frontendUrl: frontendUrl ? '✅ Set' : '❌ Missing'
    })

    // Initialize Supabase client with service role key for callback
    const supabase = createClient(supabaseUrl!, supabaseKey!)
    console.log('🗄️ Supabase client initialized with service role')

    // Exchange code for access token
    console.log('🔄 Exchanging authorization code for access token...')
    const tokenResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
      }),
    })

    console.log(`📨 Token exchange response status: ${tokenResponse.status}`)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      })
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      apiDomain: tokenData.api_domain,
      companyId: tokenData.company_id,
      userId: tokenData.user_id,
      expiresIn: tokenData.expires_in
    })
    
    // Calculate expiry time
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000))
      : null
    
    console.log('⏰ Token expiry calculated:', expiresAt?.toISOString() || 'No expiry')

    // Save integration to database
    console.log('💾 Saving integration to database...')
    const integrationData = {
      clinic_id: state,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      api_domain: tokenData.api_domain,
      company_id: tokenData.company_id.toString(),
      user_id: tokenData.user_id.toString(),
      expires_at: expiresAt?.toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    
    console.log('💾 Integration data to save:', {
      clinic_id: integrationData.clinic_id,
      api_domain: integrationData.api_domain,
      company_id: integrationData.company_id,
      user_id: integrationData.user_id,
      expires_at: integrationData.expires_at,
      hasAccessToken: !!integrationData.access_token,
      hasRefreshToken: !!integrationData.refresh_token
    })

    const { data, error } = await supabase
      .from('pipedrive_integration')
      .upsert(integrationData, {
        onConflict: 'clinic_id'
      })

    if (error) {
      console.error('❌ Database save error:', error)
      throw new Error('Failed to save integration')
    }
    
    console.log('✅ Integration saved to database:', data)

    // Redirect to success page
    const successUrl = `${frontendUrl || 'http://localhost:3000'}/integrations?pipedrive=success`
    console.log('🔀 Redirecting to:', successUrl)
    
    return Response.redirect(successUrl)
  } catch (error) {
    console.error('💥 OAuth callback error:', {
      message: error.message,
      stack: error.stack
    })
    
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
    const errorUrl = `${frontendUrl}/integrations?pipedrive=error&message=${encodeURIComponent(error.message)}`
    console.log('🔀 Redirecting to error page:', errorUrl)
    
    return Response.redirect(errorUrl)
  }
}

// Handle getting leads
async function handleGetLeads(req: Request) {
  console.log('📊 Starting get leads handler')
  
  try {
    // Get JWT token from request
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ No authorization header found')
      throw new Error('No authorization header')
    }
    console.log('✅ Authorization header found')

    const token = authHeader.replace('Bearer ', '')
    console.log(`🎫 Token extracted (length: ${token.length})`)
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')
    const clientSecret = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')
    
    console.log('🔧 Environment variables check:', {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseKey ? '✅ Set' : '❌ Missing',
      clientId: clientId ? '✅ Set' : '❌ Missing',
      clientSecret: clientSecret ? '✅ Set (hidden)' : '❌ Missing'
    })
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseKey!, {
      global: { headers: { Authorization: authHeader } }
    })
    console.log('🗄️ Supabase client initialized')

    // Get user from token
    console.log('👤 Verifying user token...')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      console.error('❌ User token verification failed:', userError?.message)
      throw new Error('Invalid user token')
    }
    console.log(`✅ User verified: ${user.id}`)

    // Get clinic_id from request
    const url = new URL(req.url)
    const clinicId = url.searchParams.get('clinic_id')
    
    console.log('🏥 Clinic ID from URL:', clinicId)
    
    if (!clinicId) {
      console.error('❌ Missing clinic_id parameter')
      throw new Error('Missing clinic_id parameter')
    }

    // Verify user owns the clinic and get Pipedrive integration
    console.log('🔍 Fetching Pipedrive integration...')
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

    if (integrationError) {
      console.error('❌ Integration query error:', integrationError)
      throw new Error('Pipedrive integration not found or unauthorized')
    }
    
    if (!integration) {
      console.error('❌ No integration found for clinic')
      throw new Error('Pipedrive integration not found or unauthorized')
    }
    
    console.log('✅ Integration found:', {
      id: integration.id,
      clinic_id: integration.clinic_id,
      api_domain: integration.api_domain,
      company_id: integration.company_id,
      expires_at: integration.expires_at,
      hasAccessToken: !!integration.access_token,
      hasRefreshToken: !!integration.refresh_token
    })

    // Check if token is expired and refresh if needed
    let accessToken = integration.access_token
    const tokenExpired = integration.expires_at && new Date(integration.expires_at) <= new Date()
    
    console.log('⏰ Token expiry check:', {
      expires_at: integration.expires_at,
      current_time: new Date().toISOString(),
      is_expired: tokenExpired
    })
    
    if (tokenExpired) {
      console.log('🔄 Token expired, refreshing...')
      
      if (!integration.refresh_token) {
        console.error('❌ No refresh token available')
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
          client_id: clientId!,
          client_secret: clientSecret!,
        }),
      })

      console.log(`📨 Token refresh response status: ${refreshResponse.status}`)

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('❌ Token refresh failed:', {
          status: refreshResponse.status,
          error: errorText
        })
        throw new Error('Failed to refresh token')
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token
      
      console.log('✅ Token refreshed successfully')

      // Update token in database
      console.log('💾 Updating refreshed token in database...')
      const updateResult = await supabase
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
      
      if (updateResult.error) {
        console.error('❌ Token update failed:', updateResult.error)
      } else {
        console.log('✅ Token updated in database')
      }
    }

    // Fetch leads from Pipedrive
    console.log('📊 Fetching leads from Pipedrive...')
    const leadsUrl = `https://${integration.api_domain}/api/v1/leads?limit=100`
    console.log('🔗 Leads API URL:', leadsUrl)
    
    const leadsResponse = await fetch(leadsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`📨 Leads API response status: ${leadsResponse.status}`)

    if (!leadsResponse.ok) {
      const errorText = await leadsResponse.text()
      console.error('❌ Pipedrive leads API error:', {
        status: leadsResponse.status,
        error: errorText
      })
      throw new Error(`Pipedrive API error: ${leadsResponse.status}`)
    }

    const leadsData = await leadsResponse.json()
    console.log('✅ Leads fetched:', {
      count: leadsData.data?.length || 0,
      total: leadsData.additional_data?.pagination?.total || 0
    })

    // Also fetch deals for additional context
    console.log('💼 Fetching deals from Pipedrive...')
    const dealsUrl = `https://${integration.api_domain}/api/v1/deals?limit=100&status=open`
    console.log('🔗 Deals API URL:', dealsUrl)
    
    const dealsResponse = await fetch(dealsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`📨 Deals API response status: ${dealsResponse.status}`)
    
    let dealsData = { data: [] }
    if (dealsResponse.ok) {
      dealsData = await dealsResponse.json()
      console.log('✅ Deals fetched:', {
        count: dealsData.data?.length || 0,
        total: dealsData.additional_data?.pagination?.total || 0
      })
    } else {
      console.log('⚠️ Deals fetch failed, continuing without deals data')
    }

    const responseData = {
      success: true,
      leads: leadsData.data || [],
      deals: dealsData.data || [],
      total_leads: leadsData.additional_data?.pagination?.total || 0,
      total_deals: dealsData.additional_data?.pagination?.total || 0,
    }
    
    console.log('✅ Response prepared:', {
      leads_count: responseData.leads.length,
      deals_count: responseData.deals.length,
      total_leads: responseData.total_leads,
      total_deals: responseData.total_deals
    })

    return new Response(
      JSON.stringify(responseData),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('💥 Get leads error:', {
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}