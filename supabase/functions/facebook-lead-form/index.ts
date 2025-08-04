import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const facebookApiVersion = Deno.env.get('FACEBOOK_API_VERSION') || 'v18.0'
const facebookWebhookVerifyToken = Deno.env.get('FACEBOOK_WEBHOOK_VERIFY_TOKEN')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Route handling
    switch (true) {
      case path.includes('/fetch-facebook-lead-form-responses') && method === 'POST':
        return await fetchFacebookLeadFormResponses(req, supabaseAdmin)

      case path.includes('/facebook-webhook') && method === 'GET':
        return await verifyFacebookWebhook(req)

      case path.includes('/facebook-webhook') && method === 'POST':
        return await handleFacebookWebhook(req, supabaseAdmin)

      default:
        return new Response(
          JSON.stringify({ error: 'Route not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function verifyFacebookWebhook(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  // Verify the token matches what you expect
  if (mode === 'subscribe' && token === facebookWebhookVerifyToken) {
    console.log('Facebook webhook verified')
    return new Response(challenge, { status: 200 })
  }

  console.log('Facebook webhook verification failed')
  return new Response('Forbidden', { status: 403 })
}

async function handleFacebookWebhook(req: Request, supabaseAdmin: any) {
  try {
    const body = await req.json()
    
    // Process Facebook webhook payload
    if (body.object === 'page') {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              // Process lead generation event
              const leadgenId = change.value.leadgen_id
              const pageId = change.value.page_id
              const formId = change.value.form_id
              
              console.log(`Processing Facebook lead: ${leadgenId} from form: ${formId}`)
              
              // Find connection for this page and form
              const { data: connection, error: connectionError } = await supabaseAdmin
                .from('facebook_lead_form_connections')
                .select('*')
                .eq('facebook_page_id', pageId)
                .eq('lead_form_id', formId)
                .eq('sync_status', 'active')
                .single()

              if (connectionError) {
                console.error('Error finding Facebook connection:', connectionError)
                continue
              }

              if (connection) {
                await processFacebookLead(leadgenId, connection, supabaseAdmin)
              } else {
                console.log(`No active connection found for page: ${pageId}, form: ${formId}`)
              }
            }
          }
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Facebook webhook error:', error)
    return new Response('Error', { status: 500 })
  }
}

async function processFacebookLead(leadgenId: string, connection: any, supabaseAdmin: any) {
  try {
    // Fetch the lead data from Facebook Graph API
    const leadUrl = `https://graph.facebook.com/${facebookApiVersion}/${leadgenId}?access_token=${connection.page_access_token}`
    
    const response = await fetch(leadUrl)
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch Facebook lead ${leadgenId}:`, response.status, errorText)
      return
    }

    const leadData = await response.json()
    
    // Get lead source ID for Facebook Lead Forms
    const { data: leadSource, error: leadSourceError } = await supabaseAdmin
      .from('lead_source')
      .select('id')
      .eq('name', 'Facebook Lead Forms')
      .single()

    if (leadSourceError || !leadSource) {
      console.error('Facebook Lead Forms source not found:', leadSourceError)
      return
    }

    const formData: { [key: string]: any } = {}
    let firstName: string | null = null
    let lastName: string | null = null
    let email: string | null = null
    let phone: string | null = null

    // Process lead form field data
    if (leadData.field_data) {
      for (const field of leadData.field_data) {
        const fieldName = field.name || 'unknown'
        const fieldValue = Array.isArray(field.values) ? field.values[0] : field.values

        formData[fieldName] = fieldValue

        // Map Facebook field names to lead properties
        switch (fieldName.toLowerCase()) {
          case 'first_name':
            firstName = fieldValue
            break
          case 'last_name':
            lastName = fieldValue
            break
          case 'email':
            email = fieldValue
            break
          case 'phone_number':
          case 'phone':
            phone = fieldValue
            break
          case 'full_name':
            // Split full name if first/last not provided separately
            if (!firstName && !lastName && fieldValue) {
              const nameParts = fieldValue.split(' ')
              firstName = nameParts[0] || null
              lastName = nameParts.slice(1).join(' ') || null
            }
            break
        }
      }
    }

    // Skip if no email
    if (!email) {
      console.log(`Skipping Facebook lead without email: ${leadgenId}`)
      return
    }

    // Check for duplicate lead by email
    const { data: existingLead } = await supabaseAdmin
      .from('lead')
      .select('id')
      .eq('email', email)
      .eq('clinic_id', connection.clinic_id)
      .single()

    if (!existingLead) {
      const { error: leadError } = await supabaseAdmin
        .from('lead')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          status: 'New',
          source_id: leadSource.id,
          clinic_id: connection.clinic_id,
          form_data: formData,
          created_at: leadData.created_time || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (leadError) {
        console.error('Error creating Facebook lead:', leadError)
      } else {
        console.log(`Created lead from Facebook: ${email}`)
      }
    } else {
      console.log(`Facebook lead already exists: ${email}`)
    }

  } catch (error) {
    console.error('Error processing Facebook lead:', error)
  }
}

async function fetchFacebookLeadFormResponses(req: Request, supabaseAdmin: any) {
  const body = await req.json()
  const { clinic_id } = body

  if (!clinic_id) {
    return new Response(
      JSON.stringify({ error: 'clinic_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Fetch active Facebook Lead Form connections for the clinic
  const { data: connections, error: connError } = await supabaseAdmin
    .from('facebook_lead_form_connections')
    .select('*')
    .eq('clinic_id', clinic_id)
    .eq('sync_status', 'active')

  if (connError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch connections: ' + connError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  if (!connections || connections.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No active Facebook Lead Form connections found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Get lead source ID for Facebook Lead Forms
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from('lead_source')
    .select('id')
    .eq('name', 'Facebook Lead Forms')
    .single()

  if (leadSourceError || !leadSource) {
    return new Response(
      JSON.stringify({ error: 'Lead source not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  let totalProcessed = 0
  let totalCreated = 0
  const errors: string[] = []

  for (const connection of connections) {
    try {
      console.log(`Processing Facebook connection: ${connection.id}`)
      
      // Build the Facebook Graph API URL to fetch leads
      let leadsUrl = `https://graph.facebook.com/${facebookApiVersion}/${connection.lead_form_id}/leads?access_token=${connection.page_access_token}`
      
      // Add since parameter if we have a last_sync_at
      if (connection.last_sync_at) {
        const lastSyncTimestamp = Math.floor(new Date(connection.last_sync_at).getTime() / 1000)
        leadsUrl += `&since=${lastSyncTimestamp}`
      }

      // Add fields parameter to get field_data
      leadsUrl += `&fields=id,created_time,field_data`

      console.log(`Fetching leads from: ${leadsUrl.replace(connection.page_access_token, '[REDACTED]')}`)

      const response = await fetch(leadsUrl)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Facebook API error for connection ${connection.id}:`, errorText)
        errors.push(`Connection ${connection.id}: Facebook API error - ${response.status}`)
        
        await supabaseAdmin
          .from('facebook_lead_form_connections')
          .update({ 
            sync_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        continue
      }

      const responseData = await response.json()
      const leads = responseData.data || []

      console.log(`Found ${leads.length} leads for connection ${connection.id}`)

      if (leads.length === 0) {
        console.log(`No new Facebook leads found for connection ${connection.id}`)
        await supabaseAdmin
          .from('facebook_lead_form_connections')
          .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        continue
      }

      // Process each lead
      for (const leadData of leads) {
        try {
          const formData: { [key: string]: any } = {}
          let firstName: string | null = null
          let lastName: string | null = null
          let email: string | null = null
          let phone: string | null = null

          // Process lead form field data
          if (leadData.field_data) {
            for (const field of leadData.field_data) {
              const fieldName = field.name || 'unknown'
              const fieldValue = Array.isArray(field.values) ? field.values[0] : field.values

              formData[fieldName] = fieldValue

              // Map Facebook field names to lead properties
              switch (fieldName.toLowerCase()) {
                case 'first_name':
                  firstName = fieldValue
                  break
                case 'last_name':
                  lastName = fieldValue
                  break
                case 'email':
                  email = fieldValue
                  break
                case 'phone_number':
                case 'phone':
                  phone = fieldValue
                  break
                case 'full_name':
                  // Split full name if first/last not provided separately
                  if (!firstName && !lastName && fieldValue) {
                    const nameParts = fieldValue.split(' ')
                    firstName = nameParts[0] || null
                    lastName = nameParts.slice(1).join(' ') || null
                  }
                  break
              }
            }
          }

          // Skip if no email
          if (!email) {
            console.log(`Skipping Facebook lead without email: ${leadData.id}`)
            continue
          }

          // Check for duplicate lead by email
          const { data: existingLead } = await supabaseAdmin
            .from('lead')
            .select('id')
            .eq('email', email)
            .eq('clinic_id', clinic_id)
            .single()

          if (!existingLead) {
            const { error: leadError } = await supabaseAdmin
              .from('lead')
              .insert({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                status: 'New',
                source_id: leadSource.id,
                clinic_id,
                form_data: formData,
                created_at: leadData.created_time || new Date().toISOString(),
                updated_at: new Date().toISOString()
              })

            if (leadError) {
              console.error('Error creating Facebook lead:', leadError)
              errors.push(`Failed to create lead for ${email}: ${leadError.message}`)
            } else {
              totalCreated++
              console.log(`Created Facebook lead: ${email}`)
            }
          } else {
            console.log(`Facebook lead already exists for email: ${email}`)
          }

          totalProcessed++
        } catch (leadError) {
          console.error('Error processing individual Facebook lead:', leadError)
          errors.push(`Error processing lead ${leadData.id}: ${leadError.message}`)
        }
      }

      // Update last_sync_at with current timestamp
      await supabaseAdmin
        .from('facebook_lead_form_connections')
        .update({ 
          last_sync_at: new Date().toISOString(),
          sync_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)

      console.log(`Processed ${leads.length} Facebook leads for connection ${connection.id}`)

    } catch (error) {
      console.error('Error processing Facebook connection:', connection.id, error)
      errors.push(`Connection ${connection.id}: ${error.message}`)
      await supabaseAdmin
        .from('facebook_lead_form_connections')
        .update({ 
          sync_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    }
  }

  return new Response(
    JSON.stringify({ 
      message: 'Facebook Lead Form responses processing completed',
      summary: {
        total_processed: totalProcessed,
        leads_created: totalCreated,
        connections_processed: connections.length,
        errors: errors
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
  )
}