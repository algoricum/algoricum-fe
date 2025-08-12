// supabase/functions/unsubscribe-lead/index.ts
// Simple one-click unsubscribe that marks lead as cold

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

  // Only handle GET requests for unsubscribe links
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const url = new URL(req.url);
    const leadId = url.searchParams.get('leadId');

    if (!leadId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid unsubscribe link - missing lead ID.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get lead info first
    const { data: lead, error: fetchError } = await supabaseClient
      .from('lead')
      .select('status')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Lead not found. You may have already been unsubscribed.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Check if already unsubscribed
    if (lead.status === 'Cold') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Already unsubscribed from emails.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Mark lead as cold
    const { error: updateError } = await supabaseClient
      .from('lead')
      .update({
        status: 'Cold',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'There was an error processing your request. Please try again.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully unsubscribed. You will not receive any more emails.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'There was an error processing your unsubscribe request. Please contact us directly.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});