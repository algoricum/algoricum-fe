import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { google } from 'https://esm.sh/googleapis@140.0.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!
const googleAdsDeveloperToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Initialize Supabase clients
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Route handling
    switch (true) {
      case path.includes('/fetch-google-lead-form-responses') && method === 'POST':
        return await fetchGoogleLeadFormResponses(req, supabaseAdmin)

      case path.includes('/oauth/callback'):
        return await handleOAuthCallback(req, supabase)

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

async function handleOAuthCallback(req: Request, supabase: any) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  
  if (!code) {
    return new Response(
      JSON.stringify({ error: 'No authorization code provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  
  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  return new Response(
    JSON.stringify({ data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
  )
}

async function refreshGoogleToken(oauth2Client: any, connection: any, supabaseAdmin: any) {
  try {
    oauth2Client.setCredentials({ refresh_token: connection.refresh_token })
    const { credentials } = await oauth2Client.refreshAccessToken()
    
    const updatedToken = {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || connection.refresh_token,
      token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('google_lead_form_connections')
      .update(updatedToken)
      .eq('id', connection.id)

    if (updateError) {
      console.error('Token update error:', updateError)
      throw new Error('Failed to update token')
    }

    return {
      ...connection,
      ...updatedToken
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    await supabaseAdmin
      .from('google_lead_form_connections')
      .update({ sync_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    throw error
  }
}

async function fetchGoogleLeadFormResponses(req: Request, supabaseAdmin: any) {
  const body = await req.json()
  const { clinic_id } = body

  if (!clinic_id) {
    return new Response(
      JSON.stringify({ error: 'clinic_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  if (!googleAdsDeveloperToken) {
    return new Response(
      JSON.stringify({ error: 'Google Ads Developer Token not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Fetch active Google Lead Form connections for the clinic
  const { data: connections, error: connError } = await supabaseAdmin
    .from('google_lead_form_connections')
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
      JSON.stringify({ error: 'No active Google Lead Form connections found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Get lead source ID for Google Lead Forms
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from('lead_source')
    .select('id')
    .eq('name', 'Google Lead Forms')
    .single()

  if (leadSourceError || !leadSource) {
    return new Response(
      JSON.stringify({ error: 'Lead source not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectUri
  )

  let totalProcessed = 0
  let totalCreated = 0
  const errors: string[] = []

  for (const connection of connections) {
    try {
      console.log(`Processing Google Lead Form connection: ${connection.id}`)
      let currentConnection = connection

      // Check and refresh token if expired
      if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
        console.log(`Refreshing token for lead form connection ${connection.id}`)
        currentConnection = await refreshGoogleToken(oauth2Client, connection, supabaseAdmin)
      }

      oauth2Client.setCredentials({ access_token: currentConnection.access_token })

      // Build date filter for lead form submissions
      let dateFilter = ''
      if (currentConnection.last_sync_at) {
        const lastSyncDate = new Date(currentConnection.last_sync_at)
        const filterDate = lastSyncDate.toISOString().split('T')[0] // YYYY-MM-DD format
        dateFilter = `submissions.submission_date_time >= '${filterDate}'`
      }

      // Use Google Ads API to fetch lead form submissions
      const googleAdsUrl = `https://googleads.googleapis.com/v14/customers/${currentConnection.google_customer_id}/googleAdsService:search`
      
      const query = `
        SELECT 
          lead_form_submission_data.id,
          lead_form_submission_data.asset_id,
          lead_form_submission_data.submission_date_time,
          lead_form_submission_data.lead_form_submission_fields
        FROM lead_form_submission_data 
        WHERE lead_form_submission_data.asset_id = '${currentConnection.lead_form_id}'
        ${dateFilter ? `AND ${dateFilter}` : ''}
        ORDER BY lead_form_submission_data.submission_date_time DESC
      `

      console.log(`Querying Google Ads API for customer: ${currentConnection.google_customer_id}`)

      const response = await fetch(googleAdsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentConnection.access_token}`,
          'developer-token': googleAdsDeveloperToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Google Ads API error for connection ${connection.id}:`, errorText)
        errors.push(`Connection ${connection.id}: Google Ads API error - ${response.status}`)
        
        await supabaseAdmin
          .from('google_lead_form_connections')
          .update({ 
            sync_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        continue
      }

      const responseData = await response.json()
      const submissions = responseData.results || []

      console.log(`Found ${submissions.length} lead form submissions for connection ${connection.id}`)

      if (submissions.length === 0) {
        console.log(`No new lead form submissions found for connection ${connection.id}`)
        await supabaseAdmin
          .from('google_lead_form_connections')
          .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        continue
      }

      // Process each submission
      for (const submission of submissions) {
        try {
          const submissionData = submission.leadFormSubmissionData
          if (!submissionData) continue

          const formData: { [key: string]: any } = {}
          let firstName: string | null = null
          let lastName: string | null = null
          let email: string | null = null
          let phone: string | null = null

          // Process lead form fields
          if (submissionData.leadFormSubmissionFields) {
            for (const field of submissionData.leadFormSubmissionFields) {
              const fieldType = field.fieldType || 'UNKNOWN'
              const fieldValue = field.fieldValue || ''
              
              formData[fieldType] = fieldValue

              // Map common field types to lead properties
              switch (fieldType.toUpperCase()) {
                case 'FIRST_NAME':
                  firstName = fieldValue
                  break
                case 'LAST_NAME':
                  lastName = fieldValue
                  break
                case 'EMAIL':
                  email = fieldValue
                  break
                case 'PHONE_NUMBER':
                  phone = fieldValue
                  break
                case 'FULL_NAME':
                  // Split full name if first/last not provided separately
                  if (!firstName && !lastName) {
                    const nameParts = fieldValue.split(' ')
                    firstName = nameParts[0] || null
                    lastName = nameParts.slice(1).join(' ') || null
                  }
                  break
              }
            }
          }

          // Skip if no email (assuming email is required for lead)
          if (!email) {
            console.log(`Skipping lead form submission without email: ${submissionData.id}`)
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
            const submissionDateTime = submissionData.submissionDateTime || new Date().toISOString()
            
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
                created_at: submissionDateTime,
                updated_at: new Date().toISOString()
              })

            if (leadError) {
              console.error('Error creating lead from lead form:', leadError)
              errors.push(`Failed to create lead for ${email}: ${leadError.message}`)
            } else {
              totalCreated++
              console.log(`Created Google Lead Form lead: ${email}`)
            }
          } else {
            console.log(`Lead already exists for email: ${email}`)
          }

          totalProcessed++
        } catch (submissionError) {
          console.error('Error processing individual lead form submission:', submissionError)
          errors.push(`Error processing submission ${submission.leadFormSubmissionData?.id}: ${submissionError.message}`)
        }
      }

      // Update last_sync_at with current timestamp
      await supabaseAdmin
        .from('google_lead_form_connections')
        .update({ 
          last_sync_at: new Date().toISOString(),
          sync_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConnection.id)

      console.log(`Processed ${submissions.length} lead form submissions for connection ${connection.id}`)

    } catch (error) {
      console.error('Error processing lead form connection:', connection.id, error)
      errors.push(`Connection ${connection.id}: ${error.message}`)
      await supabaseAdmin
        .from('google_lead_form_connections')
        .update({ 
          sync_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    }
  }

  return new Response(
    JSON.stringify({ 
      message: 'Google Lead Form responses processing completed',
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