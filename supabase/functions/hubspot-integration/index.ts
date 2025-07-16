// supabase/functions/hubspot-integration/index.ts
// Simplified function that works with Supabase auth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')

    // Initialize Supabase (use service role for database operations)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle OAuth callback (GET request with 'code' parameter)
    if (req.method === 'GET' && url.searchParams.get('code')) {
      return await handleCallback(req, supabase)
    }

    // Handle disconnect (DELETE method)
    if (req.method === 'DELETE') {
      return await handleDisconnect(req, supabase)
    }

    // Handle connect (POST method)
    if (req.method === 'POST') {
      return await handleConnect(req, supabase)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleConnect(req: Request, supabase: any) {
  try {
    const { userId, redirectUrl } = await req.json()

    if (!userId || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or redirectUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get HubSpot configuration from environment variables
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID')
    const redirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI')

    console.log('Environment check:', { 
      hasClientId: !!clientId, 
      hasRedirectUri: !!redirectUri,
      clientId: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
      redirectUri 
    })

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ 
          error: 'HubSpot configuration missing',
          details: 'Please set HUBSPOT_CLIENT_ID and HUBSPOT_REDIRECT_URI environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update connection status (ignore errors for now)
    try {
      await supabase
        .from('hubspot_connections')
        .upsert({
          user_id: userId,
          connection_status: 'connecting',
          error_message: null,
        })
    } catch (dbError) {
      console.warn('Database update failed:', dbError)
    }

    // Create OAuth state
    const state = btoa(JSON.stringify({ 
      userId, 
      redirectUrl,
      timestamp: Date.now()
    }))

    // Build authorization URL
    const scopes = [
      'contacts',
      'content', 
      'reports',
      'automation',
      'forms',
      'crm.objects.deals.read',
      'crm.objects.deals.write'
    ].join(' ')

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    console.log('Generated auth URL:', authUrl.toString())

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        debug: {
          clientId: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
          redirectUri,
          state: state.substring(0, 20) + '...'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Connect error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create auth URL',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleCallback(req: Request, supabase: any) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  console.log('Callback received:', { hasCode: !!code, hasState: !!state, error })

  if (error) {
    return new Response(
      `<html><body>
        <h1>Connection Failed</h1>
        <p>Error: ${error}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'hubspot_error', error: '${error}' }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code || !state) {
    return new Response(
      `<html><body>
        <h1>Invalid Callback</h1>
        <p>Missing code or state</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'hubspot_error', error: 'Invalid callback' }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  try {
    // Decode state
    const stateData = JSON.parse(atob(state))
    const { userId } = stateData

    // Get environment variables
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID')!
    const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET')!
    const redirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI')!

    console.log('Token exchange starting...')

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
    })

    const tokens = await tokenResponse.json()
    console.log('Token response:', { ok: tokenResponse.ok, hasAccessToken: !!tokens.access_token })

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`)
    }

    // Get basic account info
    const accountRes = await fetch('https://api.hubapi.com/account-info/v3/details', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    })
    const accountData = await accountRes.json()

    // Get contacts and deals count
    const [contactsRes, dealsRes] = await Promise.all([
      fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }),
      fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=1', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      })
    ])

    const [contactsData, dealsData] = await Promise.all([
      contactsRes.json(),
      dealsRes.json()
    ])

    // Save to database
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))
    const accountName = accountData.companyName || `Hub ${accountData.portalId}`
    
    try {
      await supabase
        .from('hubspot_connections')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          account_name: accountName,
          contact_count: contactsData.total || 0,
          deal_count: dealsData.total || 0,
          hub_id: accountData.portalId?.toString(),
          connection_status: 'connected',
          last_sync_at: new Date().toISOString(),
          error_message: null,
        })
      console.log('Database save successful')
    } catch (dbError) {
      console.error('Database save failed:', dbError)
    }

    const accountInfo = {
      accountName,
      contactCount: contactsData.total || 0,
      dealCount: dealsData.total || 0,
    }

    return new Response(
      `<html><body>
        <div style="text-align: center; padding: 50px; font-family: Arial;">
          <h1>✅ Successfully Connected!</h1>
          <p>Connected to <strong>${accountInfo.accountName}</strong></p>
          <p>${accountInfo.contactCount} contacts • ${accountInfo.dealCount} deals</p>
          <p>This window will close automatically...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'hubspot_success',
              accountInfo: ${JSON.stringify(accountInfo)}
            }, '*');
          }
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error('Callback error:', error)
    return new Response(
      `<html><body>
        <div style="text-align: center; padding: 50px; font-family: Arial;">
          <h1>❌ Connection Error</h1>
          <p>Something went wrong: ${error.message}</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'hubspot_error', error: 'Connection failed' }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}

async function handleDisconnect(req: Request, supabase: any) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single()

    // Revoke HubSpot token if it exists
    if (connection?.refresh_token) {
      try {
        await fetch(`https://api.hubapi.com/oauth/v1/refresh-tokens/${connection.refresh_token}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${connection.access_token}` },
        })
      } catch (error) {
        console.warn('Token revocation failed:', error)
      }
    }

    // Update database
    await supabase
      .from('hubspot_connections')
      .update({
        connection_status: 'disconnected',
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        error_message: null,
      })
      .eq('user_id', userId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Successfully disconnected from HubSpot' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Disconnect error:', error)
    return new Response(
      JSON.stringify({ error: 'Disconnect failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}