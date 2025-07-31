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
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '')
    const lastSegment = pathSegments[pathSegments.length - 1]
    const secondLastSegment = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : null
    
    console.log(`📍 URL analysis:`, {
      fullPath: url.pathname,
      pathSegments,
      lastSegment,
      secondLastSegment,
      method: req.method
    })
    
    // Route based on path and method
    if (lastSegment === 'pipedrive' && req.method === 'POST') {
      console.log('🔑 Routing to OAuth initialization (direct POST)')
      return await handleOAuthInit(req)
    } else if (lastSegment === 'oauth-callback' && req.method === 'GET') {
      console.log('🔄 Routing to OAuth callback')
      return await handleOAuthCallback(req)
    } else if (lastSegment === 'leads' && req.method === 'GET') {
      console.log('📊 Routing to get leads')
      return await handleGetLeads(req)
    } else if (lastSegment === 'sync-leads' && req.method === 'POST') {
      console.log('💾 Routing to sync leads')
      return await handleSyncLeads(req)
    } else if (lastSegment === 'webhook' && req.method === 'POST') {
      console.log('🔔 Routing to webhook handler')
      return await handleWebhook(req)
    } else {
      console.error(`❌ Invalid endpoint: ${lastSegment} with method: ${req.method}`)
      console.error(`Full URL: ${req.url}`)
      throw new Error(`Invalid endpoint: ${lastSegment} with method: ${req.method}`)
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
    oauthUrl.searchParams.set('scope', 'deals:read leads:read persons:read')

    console.log('✅ OAuth URL built:', oauthUrl.toString())

    return new Response(
      JSON.stringify({ 
        success: true, 
        authUrl: oauthUrl.toString() 
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

    // Get account info and redirect with success
    const accountInfo = await getAccountInfo(tokenData.access_token, tokenData.api_domain)
    
    const successUrl = `${frontendUrl || 'http://localhost:3000'}?pipedrive_status=success&account_name=${encodeURIComponent(accountInfo.accountName)}&contact_count=${accountInfo.contactCount}&deal_count=${accountInfo.dealCount}`
    console.log('🔀 Redirecting to:', successUrl)
    
    return Response.redirect(successUrl)
  } catch (error) {
    console.error('💥 OAuth callback error:', {
      message: error.message,
      stack: error.stack
    })
    
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000'
    const errorUrl = `${frontendUrl}?pipedrive_status=error&error_message=${encodeURIComponent(error.message)}`
    console.log('🔀 Redirecting to error page:', errorUrl)
    
    return Response.redirect(errorUrl)
  }
}

// Get account information
async function getAccountInfo(accessToken: string, apiDomain: string) {
  try {
    console.log('📊 Fetching account information...')
    
    // Get persons (contacts) count
    const personsResponse = await fetch(`https://${apiDomain}/api/v1/persons?limit=1`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    let contactCount = 0
    if (personsResponse.ok) {
      const personsData = await personsResponse.json()
      contactCount = personsData.additional_data?.pagination?.total || 0
    }
    
    // Get deals count
    const dealsResponse = await fetch(`https://${apiDomain}/api/v1/deals?limit=1`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    let dealCount = 0
    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json()
      dealCount = dealsData.additional_data?.pagination?.total || 0
    }
    
    return {
      accountName: 'Pipedrive Account',
      contactCount,
      dealCount
    }
  } catch (error) {
    console.error('⚠️ Error fetching account info:', error)
    return {
      accountName: 'Pipedrive Account',
      contactCount: 0,
      dealCount: 0
    }
  }
}

// Handle syncing leads from Pipedrive to our database
async function handleSyncLeads(req: Request) {
  console.log('💾 Starting lead sync')
  
  try {
    // Get JWT token from request
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ No authorization header found')
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

    // Get Pipedrive integration
    const { data: integration, error: integrationError } = await supabase
      .from('pipedrive_integration')
      .select(`
        *,
        clinic!inner(owner_id)
      `)
      .eq('clinic_id', clinic_id)
      .eq('clinic.owner_id', user.id)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('Pipedrive integration not found or unauthorized')
    }

    // Get or create lead source for Pipedrive
    const { data: leadSource, error: sourceError } = await supabase
      .from('lead_source')
      .select('id')
      .eq('name', 'Pipedrive')
      .eq('clinic_id', clinic_id)
      .single()

    let sourceId = leadSource?.id

    if (!sourceId) {
      const { data: newSource, error: createSourceError } = await supabase
        .from('lead_source')
        .insert({
          name: 'Pipedrive',
          clinic_id: clinic_id,
          is_active: true
        })
        .select('id')
        .single()

      if (createSourceError) {
        throw new Error('Failed to create lead source')
      }
      sourceId = newSource.id
    }

    // Fetch leads from Pipedrive
    const leadsUrl = `https://${integration.api_domain}/api/v1/leads?limit=500`
    const leadsResponse = await fetch(leadsUrl, {
      headers: { 'Authorization': `Bearer ${integration.access_token}` }
    })

    if (!leadsResponse.ok) {
      throw new Error(`Pipedrive API error: ${leadsResponse.status}`)
    }

    const leadsData = await leadsResponse.json()
    const pipedriveLeads = leadsData.data || []

    console.log(`📊 Found ${pipedriveLeads.length} leads in Pipedrive`)

    // Also fetch persons for additional contact info
    const personsUrl = `https://${integration.api_domain}/api/v1/persons?limit=500`
    const personsResponse = await fetch(personsUrl, {
      headers: { 'Authorization': `Bearer ${integration.access_token}` }
    })

    let personsData = { data: [] }
    if (personsResponse.ok) {
      personsData = await personsResponse.json()
    }

    // Create a map of person_id to person data
    const personsMap = new Map()
    if (personsData.data) {
      personsData.data.forEach((person: any) => {
        personsMap.set(person.id, person)
      })
    }

    // Transform and save leads
    const leadsToInsert = []
    
    for (const pipedriveData of pipedriveLeads) {
      // Get person info if available
      const person = personsMap.get(pipedriveData.person_id)
      
      const leadData = {
        first_name: person?.name?.split(' ')[0] || pipedriveData.title?.split(' ')[0] || null,
        last_name: person?.name?.split(' ').slice(1).join(' ') || pipedriveData.title?.split(' ').slice(1).join(' ') || null,
        email: person?.email?.[0]?.value || pipedriveData.email || null,
        phone: person?.phone?.[0]?.value || pipedriveData.phone || null,
        status: 'New' as const,
        source_id: sourceId,
        clinic_id: clinic_id,
        notes: pipedriveData.notes || null,
        interest_level: 'medium' as const,
        urgency: 'curious' as const,
        form_data: {
          pipedrive_id: pipedriveData.id,
          pipedrive_title: pipedriveData.title,
          pipedrive_value: pipedriveData.value,
          pipedrive_currency: pipedriveData.currency,
          pipedrive_person_id: pipedriveData.person_id,
          pipedrive_organization_id: pipedriveData.organization_id,
          created_time: pipedriveData.add_time,
          updated_time: pipedriveData.update_time
        }
      }

      // Only add if we have at least email or phone
      if (leadData.email || leadData.phone) {
        leadsToInsert.push(leadData)
      }
    }

    console.log(`💾 Preparing to insert ${leadsToInsert.length} leads`)

    if (leadsToInsert.length > 0) {
      // Use upsert to avoid duplicates based on email/phone
      const { data: insertedLeads, error: insertError } = await supabase
        .from('lead')
        .upsert(leadsToInsert, {
          onConflict: 'email',
          ignoreDuplicates: true
        })
        .select('id')

      if (insertError) {
        console.error('❌ Insert error:', insertError)
        throw new Error('Failed to save leads to database')
      }

      console.log(`✅ Successfully synced ${insertedLeads?.length || leadsToInsert.length} leads`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: leadsToInsert.length,
        total_pipedrive_leads: pipedriveLeads.length
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('💥 Sync leads error:', error)
    throw error
  }
}

// Handle getting leads (for API access)
async function handleGetLeads(req: Request) {
  console.log('📊 Starting get leads handler')
  
  try {
    // Get JWT token from request
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const clientId = Deno.env.get('PIPEDRIVE_CLIENT_ID')!
    const clientSecret = Deno.env.get('PIPEDRIVE_CLIENT_SECRET')!
    
    // Initialize Supabase client
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

    // Get Pipedrive integration with token refresh logic
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
    const tokenExpired = integration.expires_at && new Date(integration.expires_at) <= new Date()
    
    if (tokenExpired && integration.refresh_token) {
      console.log('🔄 Token expired, refreshing...')
      
      const refreshResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (refreshResponse.ok) {
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
          })
          .eq('id', integration.id)
      }
    }

    // Fetch leads from Pipedrive
    const leadsUrl = `https://${integration.api_domain}/api/v1/leads?limit=100`
    const leadsResponse = await fetch(leadsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!leadsResponse.ok) {
      throw new Error(`Pipedrive API error: ${leadsResponse.status}`)
    }

    const leadsData = await leadsResponse.json()

    // Also fetch deals
    const dealsUrl = `https://${integration.api_domain}/api/v1/deals?limit=100&status=open`
    const dealsResponse = await fetch(dealsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    let dealsData = { data: [] }
    if (dealsResponse.ok) {
      dealsData = await dealsResponse.json()
    }

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
  } catch (error) {
    console.error('💥 Get leads error:', error)
    throw error
  }
}

// Handle webhook from Pipedrive
async function handleWebhook(req: Request) {
  console.log('🔔 Starting webhook handling')
  
  try {
    const webhookData = await req.json()
    console.log('📥 Webhook received:', {
      event: webhookData.event,
      object: webhookData.object,
      company_id: webhookData.meta?.company_id
    })

    // You can add webhook handling logic here
    // For example, sync specific lead updates, new deals, etc.
    
    return new Response(
      JSON.stringify({ success: true, received: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('💥 Webhook error:', error)
    throw error
  }
}