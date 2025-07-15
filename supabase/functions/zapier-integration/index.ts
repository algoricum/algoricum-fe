// File: supabase/functions/zapier-connect/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ZapierConnectionRequest {
  userId: string
  zapierApiKey: string
  accountEmail: string
  webhookUrl?: string
  integrationGoals: string
  selectedTools: string[]
}

// Simple encryption function - replace with proper encryption in production
function encryptApiKey(apiKey: string): string {
  const salt = Deno.env.get('ENCRYPTION_SALT') || 'default-salt'
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey + salt)
  return btoa(String.fromCharCode(...new Uint8Array(data)))
}

async function validateZapierApiKey(apiKey: string): Promise<{ isValid: boolean; accountInfo?: any }> {
  try {
    console.log('Validating Zapier API key...')
    
    // Test the API key by making a request to Zapier's API
    const response = await fetch('https://api.zapier.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error('Zapier API validation failed:', response.status, response.statusText)
      return { isValid: false }
    }
    
    const accountInfo = await response.json()
    console.log('Zapier account info received:', { email: accountInfo.email, name: accountInfo.name })
    
    // Get Zaps count
    let zapCount = 0
    try {
      const zapsResponse = await fetch('https://api.zapier.com/v1/zaps', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      })
      
      if (zapsResponse.ok) {
        const zapsData = await zapsResponse.json()
        zapCount = zapsData.objects?.length || 0
      }
    } catch (error) {
      console.warn('Failed to get Zaps count:', error)
    }
    
    return {
      isValid: true,
      accountInfo: {
        email: accountInfo.email,
        name: accountInfo.name,
        zapCount,
        accountId: accountInfo.id
      }
    }
  } catch (error) {
    console.error('Error validating Zapier API key:', error)
    return { isValid: false }
  }
}

async function handleConnect(request: Request): Promise<Response> {
  try {
    console.log('Processing Zapier connection request...')
    
    const body: ZapierConnectionRequest = await request.json()
    const { userId, zapierApiKey, accountEmail, webhookUrl, integrationGoals, selectedTools } = body

    // Validate required fields
    if (!userId || !zapierApiKey || !accountEmail || !integrationGoals) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: 'userId, zapierApiKey, accountEmail, and integrationGoals are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate API key format
    if (zapierApiKey.length < 32 || zapierApiKey.length > 50) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API key format',
          details: 'Zapier API keys should be 32-50 characters long' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(accountEmail)) {
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

    console.log('Validating Zapier API key with Zapier API...')
    
    // Validate Zapier API key and get account info
    const validation = await validateZapierApiKey(zapierApiKey)
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Zapier API key', 
          details: 'Please check your API key and try again. Make sure it has the correct permissions.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('API key validated successfully. Saving to database...')

    // Create Supabase client with service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Encrypt the API key before storing
    const encryptedApiKey = encryptApiKey(zapierApiKey)

    // Upsert integration record (insert or update if exists)
    const { data: integration, error: dbError } = await supabase
      .from('zapier_integrations')
      .upsert({
        user_id: userId,
        account_email: accountEmail,
        zapier_api_key: encryptedApiKey,
        webhook_url: webhookUrl || null,
        integration_goals: integrationGoals,
        selected_tools: selectedTools || [],
        status: 'connected',
        connection_data: validation.accountInfo,
        last_sync_at: new Date().toISOString(),
        error_message: null // Clear any previous errors
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save integration', 
          details: 'Database error occurred while saving your integration' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Integration saved successfully:', integration.id)

    // Return success response with account info
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Zapier integration connected successfully',
        accountInfo: {
          email: validation.accountInfo?.email,
          name: validation.accountInfo?.name,
          zapCount: validation.accountInfo?.zapCount || 0,
          connectedApps: selectedTools?.length || 0
        },
        integrationId: integration.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Connection error:', error)
    
    // Return different error messages based on the error type
    let errorMessage = 'Failed to connect to Zapier'
    let errorDetails = 'An unexpected error occurred'
    
    if (error.message.includes('fetch')) {
      errorMessage = 'Network error'
      errorDetails = 'Failed to connect to Zapier API. Please check your internet connection.'
    } else if (error.message.includes('JSON')) {
      errorMessage = 'Invalid request format'
      errorDetails = 'The request data format is invalid'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
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

  // Only handle POST requests for connection
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        details: 'Only POST requests are supported for this endpoint' 
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    return await handleConnect(req)
  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: 'An unexpected error occurred while processing your request'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})