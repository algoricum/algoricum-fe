// supabase/functions/setup-clinic-mailgun/index.ts

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
    // Environment variables
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
    const MAILGUN_BASE_DOMAIN = Deno.env.get('MAILGUN_BASE_DOMAIN') // e.g., 'yourdomain.com'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const WEBHOOK_BASE_URL = Deno.env.get('WEBHOOK_BASE_URL') // e.g., 'https://yourapp.com'

    if (!MAILGUN_API_KEY || !MAILGUN_BASE_DOMAIN) {
      throw new Error('Missing Mailgun configuration')
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Parse request
    const { clinicId, action = 'setup' } = await req.json()

    if (!clinicId) {
      throw new Error('clinicId is required')
    }

    // Get clinic data
    const { data: clinic, error: clinicError } = await supabase
      .from('clinic')
      .select('id, slug, name, domain, email')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      throw new Error(`Clinic not found: ${clinicError?.message}`)
    }

    if (action === 'setup') {
      // Generate subdomain
      const subdomain = `${clinic.slug}.${MAILGUN_BASE_DOMAIN}`
      const clinicEmail = `contact@${subdomain}`

      console.log(`Setting up Mailgun for: ${clinic.name}`)
      console.log(`Domain: ${subdomain}`)

      // 1. Create Mailgun domain
      const mailgunResponse = await fetch('https://api.mailgun.net/v3/domains', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: subdomain,
          smtp_password: crypto.randomUUID(),
          spam_action: 'disabled',
          wildcard: 'false'
        })
      })

      if (!mailgunResponse.ok) {
        const errorText = await mailgunResponse.text()
        throw new Error(`Mailgun domain creation failed: ${errorText}`)
      }

      const mailgunData = await mailgunResponse.json()
      console.log('Mailgun domain created:', mailgunData)

      // 2. Set up webhook route (if webhook URL provided)
      let routeCreated = false
      if (WEBHOOK_BASE_URL) {
        try {
          const routeResponse = await fetch('https://api.mailgun.net/v3/routes', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              priority: '1',
              description: `Route for ${subdomain}`,
              expression: `match_recipient(".*@${subdomain}")`,
              action: `forward("${WEBHOOK_BASE_URL}/webhooks/mailgun/${clinicId}")`,
            })
          })

          if (routeResponse.ok) {
            routeCreated = true
            console.log('Email route created')
          }
        } catch (routeError) {
          console.log('Route creation failed, but continuing...')
        }
      }

      // 3. Update clinic table
      const { error: clinicUpdateError } = await supabase
        .from('clinic')
        .update({
          domain: subdomain,
          email: clinicEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinicId)

      if (clinicUpdateError) {
        throw new Error(`Failed to update clinic: ${clinicUpdateError.message}`)
      }

      // 4. Create mailgun_settings record
      const { error: settingsError } = await supabase
        .from('mailgun_settings')
        .upsert({
          clinic_id: clinicId,
          mailgun_domain: subdomain,
          sender_name: clinic.name,
          sender_email: clinicEmail,
          domain_verified: false,
          status: 'active'
        })

      if (settingsError) {
        console.log('Warning: Failed to create mailgun_settings:', settingsError.message)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Mailgun setup completed',
          data: {
            clinicId,
            clinicName: clinic.name,
            domain: subdomain,
            email: clinicEmail,
            routeCreated,
            mailgunDomain: mailgunData.domain
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Delete action
    if (action === 'delete') {
      if (clinic.domain) {
        // Delete from Mailgun
        const deleteResponse = await fetch(
          `https://api.mailgun.net/v3/domains/${clinic.domain}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
            },
          }
        )

        // Clean up database records
        await supabase.from('mailgun_settings').delete().eq('clinic_id', clinicId)
        await supabase
          .from('clinic')
          .update({ domain: null, email: null })
          .eq('id', clinicId)

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Mailgun domain deleted'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})