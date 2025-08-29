import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers),
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Only handle GET requests for unsubscribe links
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const leadId = url.searchParams.get('lead_id');

    if (!leadId) {
      const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
      redirectUrl.searchParams.set('message', 'Invalid unsubscribe link - missing lead ID.');
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
      });
    }

    // Get lead info including email
    const { data: lead, error: fetchError } = await supabaseClient
      .from('lead')
      .select('status, email')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
      redirectUrl.searchParams.set('message', 'Lead not found. You may have already been unsubscribed.');
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
      });
    }

    // Check if already unsubscribed
    if (lead.status === 'Cold') {
      const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
      redirectUrl.searchParams.set('message', 'Already unsubscribed from emails.');
      redirectUrl.searchParams.set('email', lead.email || '');
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
      });
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
      const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
      redirectUrl.searchParams.set('message', 'There was an error processing your request. Please try again.');
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
      });
    }

    // Redirect to frontend with success message
    const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
    redirectUrl.searchParams.set('message', 'You have been successfully unsubscribed from our mailing list.');
    redirectUrl.searchParams.set('email', lead.email || '');
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    const redirectUrl = new URL(`${Deno.env.get('FRONTEND_URL') || 'https://yourdomain.com'}/unsubscribe-lead`);
    redirectUrl.searchParams.set('message', 'There was an error processing your unsubscribe request. Please contact us directly.');
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': redirectUrl.toString() },
    });
  }
});