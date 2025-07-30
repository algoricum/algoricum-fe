// supabase/functions/setup-clinic-mailgun/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Namecheap API integration
async function createNamecheapDNSRecords(domain: string, subdomain: string) {
  const NAMECHEAP_API_USER = Deno.env.get('NAMECHEAP_API_USER')
  const NAMECHEAP_API_KEY = Deno.env.get('NAMECHEAP_API_KEY')
  const NAMECHEAP_USERNAME = Deno.env.get('NAMECHEAP_USERNAME')
  const NAMECHEAP_CLIENT_IP = Deno.env.get('NAMECHEAP_CLIENT_IP')

  if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY) {
    console.log('⚠️ Namecheap API credentials not found, DNS setup will be manual')
    return { automated: false, records: null }
  }

  try {
    console.log(`🌐 Creating DNS records for ${subdomain} on Namecheap...`)

    // Get current DNS records
    const getRecordsUrl = new URL('https://api.namecheap.com/xml.response')
    getRecordsUrl.searchParams.set('ApiUser', NAMECHEAP_API_USER)
    getRecordsUrl.searchParams.set('ApiKey', NAMECHEAP_API_KEY)
    getRecordsUrl.searchParams.set('UserName', NAMECHEAP_USERNAME!)
    getRecordsUrl.searchParams.set('ClientIp', NAMECHEAP_CLIENT_IP!)
    getRecordsUrl.searchParams.set('Command', 'namecheap.domains.dns.getHosts')
    getRecordsUrl.searchParams.set('SLD', domain.split('.')[0])
    getRecordsUrl.searchParams.set('TLD', domain.split('.')[1])

    const getResponse = await fetch(getRecordsUrl.toString())
    const getResponseText = await getResponse.text()
    
    console.log('📋 Current DNS records fetched')

    // Add MX records for subdomain
    const setRecordsUrl = new URL('https://api.namecheap.com/xml.response')
    setRecordsUrl.searchParams.set('ApiUser', NAMECHEAP_API_USER)
    setRecordsUrl.searchParams.set('ApiKey', NAMECHEAP_API_KEY)
    setRecordsUrl.searchParams.set('UserName', NAMECHEAP_USERNAME!)
    setRecordsUrl.searchParams.set('ClientIp', NAMECHEAP_CLIENT_IP!)
    setRecordsUrl.searchParams.set('Command', 'namecheap.domains.dns.setHosts')
    setRecordsUrl.searchParams.set('SLD', domain.split('.')[0])
    setRecordsUrl.searchParams.set('TLD', domain.split('.')[1])
    
    // Add Mailgun MX records
    setRecordsUrl.searchParams.set('HostName1', subdomain.replace(`.${domain}`, ''))
    setRecordsUrl.searchParams.set('RecordType1', 'MX')
    setRecordsUrl.searchParams.set('Address1', 'mxa.mailgun.org')
    setRecordsUrl.searchParams.set('MXPref1', '10')

    setRecordsUrl.searchParams.set('HostName2', subdomain.replace(`.${domain}`, ''))
    setRecordsUrl.searchParams.set('RecordType2', 'MX')
    setRecordsUrl.searchParams.set('Address2', 'mxb.mailgun.org')
    setRecordsUrl.searchParams.set('MXPref2', '10')

    const setResponse = await fetch(setRecordsUrl.toString())
    const setResponseText = await setResponse.text()

    console.log('✅ DNS records created on Namecheap')
    return { automated: true, records: setResponseText }

  } catch (error) {
    console.error('❌ Namecheap DNS creation failed:', error)
    return { automated: false, error: error.message }
  }
}

// Get DNS records needed for manual setup
function getRequiredDNSRecords(subdomain: string) {
  return {
    mx_records: [
      { type: 'MX', host: subdomain, value: 'mxa.mailgun.org', priority: 10 },
      { type: 'MX', host: subdomain, value: 'mxb.mailgun.org', priority: 10 }
    ],
    txt_records: [
      { type: 'TXT', host: subdomain, value: 'v=spf1 include:mailgun.org ~all' }
    ]
  }
}

// Check domain verification status
async function checkDomainVerification(domain: string, apiKey: string) {
  try {
    const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
      },
    })

    if (!response.ok) {
      return { verified: false, error: 'Domain not found' }
    }

    const data = await response.json()
    return {
      verified: data.domain?.state === 'active',
      state: data.domain?.state,
      receiving_records: data.receiving_dns_records,
      sending_records: data.sending_dns_records
    }
  } catch (error) {
    return { verified: false, error: error.message }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting Mailgun + Namecheap setup...')
    
    // Environment variables
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
    const BASE_DOMAIN = Deno.env.get('BASE_DOMAIN') // e.g., 'yourdomain.com'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const WEBHOOK_BASE_URL = Deno.env.get('WEBHOOK_BASE_URL')

    console.log('📋 Environment check:')
    console.log(`- MAILGUN_API_KEY: ${MAILGUN_API_KEY ? '✅ Set' : '❌ Missing'}`)
    console.log(`- BASE_DOMAIN: ${BASE_DOMAIN || '❌ Missing'}`)
    console.log(`- Namecheap API: ${Deno.env.get('NAMECHEAP_API_KEY') ? '✅ Set' : '⚠️ Manual DNS'}`)

    if (!MAILGUN_API_KEY || !BASE_DOMAIN) {
      throw new Error('Missing required configuration: MAILGUN_API_KEY and BASE_DOMAIN')
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Parse request
    const { clinicId, action = 'setup' } = await req.json()
    console.log(`📝 Request: action=${action}, clinicId=${clinicId}`)

    if (!clinicId) {
      throw new Error('clinicId is required')
    }

    // Get clinic data
    console.log('🏥 Fetching clinic data...')
    const { data: clinic, error: clinicError } = await supabase
      .from('clinic')
      .select('id, slug, name, domain, email')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      console.error('❌ Clinic fetch error:', clinicError)
      throw new Error(`Clinic not found: ${clinicError?.message}`)
    }

    console.log('✅ Clinic found:', { 
      id: clinic.id, 
      name: clinic.name, 
      slug: clinic.slug 
    })

    if (action === 'setup') {
      console.log('⚙️ Starting domain setup process...')
      
      // Generate subdomain
      const subdomain = `${clinic.slug}.${BASE_DOMAIN}`
      const clinicEmail = `contact@${subdomain}`

      console.log(`🌐 Target subdomain: ${subdomain}`)
      console.log(`📧 Target email: ${clinicEmail}`)

      // Step 1: Create domain in Mailgun
      console.log('🔨 Creating domain in Mailgun...')
      
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
          wildcard: 'false',
          force_dkim_authority: 'true'
        })
      })

      console.log(`📡 Mailgun API response status: ${mailgunResponse.status}`)

      if (!mailgunResponse.ok) {
        const errorText = await mailgunResponse.text()
        console.error('❌ Mailgun domain creation failed:', errorText)
        
        // Check if domain already exists
        if (errorText.includes('already exists')) {
          console.log('♻️ Domain already exists in Mailgun, proceeding...')
        } else {
          throw new Error(`Mailgun domain creation failed: ${errorText}`)
        }
      }

      const mailgunData = await mailgunResponse.json()
      console.log('✅ Mailgun domain created/verified')

      // Step 2: Get DNS records that need to be set
      console.log('📋 Getting required DNS records...')
      const domainInfo = await checkDomainVerification(subdomain, MAILGUN_API_KEY)
      const requiredRecords = getRequiredDNSRecords(subdomain)

      // Step 3: Attempt automated DNS setup (if Namecheap API is configured)
      console.log('🌐 Setting up DNS records...')
      const dnsResult = await createNamecheapDNSRecords(BASE_DOMAIN, subdomain)

      // Step 4: Set up email routing
      let routeCreated = false
      if (WEBHOOK_BASE_URL) {
        console.log('🔗 Setting up email routing...')
        try {
          const routeResponse = await fetch('https://api.mailgun.net/v3/routes', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              priority: '1',
              description: `Route for ${subdomain} - ${clinic.name}`,
              expression: `match_recipient(".*@${subdomain}")`,
              action: `forward("${WEBHOOK_BASE_URL}/webhooks/mailgun/${clinicId}")`
            })
          })

          if (routeResponse.ok) {
            routeCreated = true
            console.log('✅ Email route created')
          } else {
            const routeError = await routeResponse.text()
            console.error('⚠️ Route creation failed:', routeError)
          }
        } catch (routeError) {
          console.error('⚠️ Route creation error:', routeError)
        }
      }

      // Step 5: Update database
      console.log('💾 Updating database...')
      
      // Update clinic
      const { error: clinicUpdateError } = await supabase
        .from('clinic')
        .update({
          domain: subdomain,
          email: clinicEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinicId)

      if (clinicUpdateError) {
        console.error('❌ Clinic update error:', clinicUpdateError)
        throw new Error(`Failed to update clinic: ${clinicUpdateError.message}`)
      }

      // Create/update mailgun_settings
      const { error: settingsError } = await supabase
        .from('mailgun_settings')
        .upsert({
          clinic_id: clinicId,
          mailgun_domain: subdomain,
          sender_name: clinic.name,
          sender_email: clinicEmail,
          domain_verified: domainInfo.verified || false,
          status: 'active'
        })

      if (settingsError) {
        console.error('⚠️ Settings update failed:', settingsError.message)
      } else {
        console.log('✅ Database updated')
      }

      // Prepare response
      const result = {
        success: true,
        message: 'Mailgun domain setup completed',
        data: {
          clinicId,
          clinicName: clinic.name,
          domain: subdomain,
          email: clinicEmail,
          domainVerified: domainInfo.verified,
          routeCreated,
          dnsAutomated: dnsResult.automated,
          requiredDNSRecords: dnsResult.automated ? null : requiredRecords,
          verificationStatus: domainInfo,
          nextSteps: dnsResult.automated 
            ? ['Domain setup complete! Email should work within 10 minutes.']
            : [
                'DNS records need to be set manually in Namecheap',
                'Add the MX and TXT records shown in requiredDNSRecords',
                'Domain verification will happen automatically after DNS propagation'
              ]
        }
      }

      console.log('🎉 Setup completed:', result.data)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Verification check action
    if (action === 'verify') {
      console.log('🔍 Checking domain verification status...')
      
      if (!clinic.domain) {
        throw new Error('No domain configured for this clinic')
      }

      const verificationStatus = await checkDomainVerification(clinic.domain, MAILGUN_API_KEY)
      
      // Update verification status in database
      if (verificationStatus.verified) {
        await supabase
          .from('mailgun_settings')
          .update({ domain_verified: true })
          .eq('clinic_id', clinicId)
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          domain: clinic.domain,
          verified: verificationStatus.verified,
          status: verificationStatus.state,
          details: verificationStatus
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Delete action
    if (action === 'delete') {
      console.log('🗑️ Starting cleanup...')
      
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

        console.log(`📡 Delete response: ${deleteResponse.status}`)

        // Clean up database
        await supabase.from('mailgun_settings').delete().eq('clinic_id', clinicId)
        await supabase
          .from('clinic')
          .update({ domain: null, email: null })
          .eq('id', clinicId)

        console.log('✅ Cleanup completed')
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Domain deleted and records cleaned'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error(`Invalid action: ${action}`)

  } catch (error) {
    console.error('💥 Function error:', error)
    console.error('Stack trace:', error.stack)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})