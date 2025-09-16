// supabase/functions/pipedrive/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleOAuthCallback,
  initializeOAuth,
  syncAllLeads,
  syncLeadsForClinic
} from '../_shared/pipedrive-service.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const frontendUrl = Deno.env.get('FRONTEND_URL')

serve(async req => {
  console.log(`Function called: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    console.log("CORS preflight request handled");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '')
    const lastSegment = pathSegments[pathSegments.length - 1]
    
    console.log(`URL analysis:`, {
      fullPath: url.pathname,
      pathSegments,
      lastSegment,
      method: req.method
    })
    
    if (lastSegment === 'pipedrive' && req.method === 'POST') {
      console.log('Routing to OAuth initialization (direct POST)')
      return await handleOAuthInit(req)
    } else if (lastSegment === 'oauth-callback' && req.method === 'GET') {
      console.log('Routing to OAuth callback')
      return await handleOAuthCallbackRoute(req)
    } else if (lastSegment === 'sync-leads' && req.method === 'POST') {
      console.log('Routing to sync leads')
      return await handleSyncLeadsRoute(req)
    } else if (lastSegment === 'sync-all-leads' && req.method === 'POST') {
      console.log('Routing to sync all leads (cron)')
      return await handleSyncAllLeadsRoute(req)
    } else {
      console.error(`Invalid endpoint: ${lastSegment} with method: ${req.method}`)
      console.error(`Full URL: ${req.url}`)
      throw new Error(`Invalid endpoint: ${lastSegment} with method: ${req.method}`)
    }
  } catch (error) {
    console.error("Main function error:", {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
});

// Handle OAuth initialization
async function handleOAuthInit(req: Request) {
  console.log("Starting OAuth initialization");

  try {
    const authHeader = req.headers.get('authorization')
    
    if (!authHeader) {
      console.error('No authorization header found')
      throw new Error('No authorization header')
    }

    const requestBody = await req.json()
    const { clinic_id, redirectUrl } = requestBody
    
    if (!clinic_id) {
      console.error('Missing clinic_id in request body')
      throw new Error('Missing clinic_id')
    }

    console.log(`Processing OAuth init for clinic: ${clinic_id}`)

    const result = await initializeOAuth(authHeader, clinic_id, redirectUrl)

    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          authUrl: result.authUrl 
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    } else {
      throw new Error(result.error || 'OAuth initialization failed')
    }

  } catch (error) {
    console.error('OAuth init error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
}

// Handle OAuth callback
async function handleOAuthCallbackRoute(req: Request) {
  console.log('Starting OAuth callback handling')
  
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    console.log('Callback parameters:', {
      code: code ? `${code.substring(0, 10)}...` : 'Missing',
      state: state || 'Missing',
    })
    
    if (!code) {
      throw new Error('Missing authorization code')
    }

    const result = await handleOAuthCallback(code, state || undefined)

    if (result.success && result.redirectUrl) {
      console.log('Redirecting to:', result.redirectUrl)
      return Response.redirect(result.redirectUrl)
    } else {
      const errorUrl = `${frontendUrl}?pipedrive_status=error&error_message=${encodeURIComponent(result.error || 'Unknown error')}`
      console.log('Redirecting to error page:', errorUrl)
      return Response.redirect(errorUrl)
    }

  } catch (error) {
    console.error('OAuth callback error:', error)
    const errorUrl = `${frontendUrl}?pipedrive_status=error&error_message=${encodeURIComponent(error.message)}`
    console.log('Redirecting to error page:', errorUrl)
    return Response.redirect(errorUrl)
  }
}

// Handle syncing leads for a specific clinic
async function handleSyncLeadsRoute(req: Request) {
  console.log('Starting lead sync for specific clinic')
  
  try {
    const { clinic_id } = await req.json()
    if (!clinic_id) {
      throw new Error('Missing clinic_id')
    }

    console.log(`Processing sync for clinic: ${clinic_id}`)

    const result = await syncLeadsForClinic(clinic_id)

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          synced_count: result.synced_count,
          skipped_count: result.skipped_count,
          total_pipedrive_leads: result.total_fetched,
          total_persons: result.total_persons || 0,
          token_refreshed: result.token_refreshed || false
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    } else {
      throw new Error(result.error || 'Sync failed')
    }

  } catch (error) {
    console.error('Sync leads error:', error)
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
}

// Handle syncing all leads (cron job)
async function handleSyncAllLeadsRoute(_req: Request) {
  console.log('Starting cron sync for all clinics')
  
  try {
    const result = await syncAllLeads()

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          total_synced: result.total_synced,
          processed_integrations: result.results.length,
          results: result.results
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    } else {
      throw new Error(result.error || 'Cron sync failed')
    }

  } catch (error) {
    console.error('Cron sync error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
}
