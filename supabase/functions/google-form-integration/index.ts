import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { google } from 'https://esm.sh/googleapis@140.0.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!

interface SubmitFormRequest {
  form_id: string
  clinic_id: string
  respondent_email?: string
  responses: Array<{
    field_id: string
    value: any
    file_urls?: string[]
  }>
}

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
      case path.includes('/public/submit') && method === 'POST':
        return await submitFormResponse(req, supabaseAdmin)

      case path.includes('/fetch-google-form-responses') && method === 'POST':
        return await fetchGoogleFormResponses(req, supabaseAdmin)

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

async function submitFormResponse(req: Request, supabaseAdmin: any) {
  const body: SubmitFormRequest = await req.json()
  const { form_id, clinic_id, respondent_email, responses } = body

  // Get form and validate it's public and active
  const { data: form, error: formError } = await supabaseAdmin
    .from('forms')
    .select('*, form_fields (*)')
    .eq('id', form_id)
    .eq('is_public', true)
    .eq('is_active', true)
    .single()

  if (formError || !form) {
    return new Response(
      JSON.stringify({ error: 'Form not found or not accessible' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Get lead source ID for Google Forms
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from('lead_source')
    .select('id')
    .eq('name', 'Google Forms')
    .single()

  if (leadSourceError || !leadSource) {
    return new Response(
      JSON.stringify({ error: 'Lead source not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Create form response
  const { data: formResponse, error: responseError } = await supabaseAdmin
    .from('form_responses')
    .insert({
      form_id,
      clinic_id,
      respondent_email,
      respondent_ip: req.headers.get('x-forwarded-for') || 'unknown',
      is_complete: true,
      submitted_at: new Date().toISOString()
    })
    .select()
    .single()

  if (responseError) {
    return new Response(
      JSON.stringify({ error: responseError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Create field responses
  const fieldResponses = responses.map(response => ({
    form_response_id: formResponse.id,
    form_field_id: response.field_id,
    clinic_id,
    response_value: typeof response.value === 'string' ? response.value : JSON.stringify(response.value),
    file_urls: response.file_urls || null
  }))

  const { error: fieldResponsesError } = await supabaseAdmin
    .from('form_field_responses')
    .insert(fieldResponses)

  if (fieldResponsesError) {
    return new Response(
      JSON.stringify({ error: fieldResponsesError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Map form fields to lead data
  const formData: { [key: string]: any } = {}
  let firstName: string | null = null
  let lastName: string | null = null
  let email: string | null = respondent_email || null
  let phone: string | null = null

  for (const response of responses) {
    const field = form.form_fields.find((f: any) => f.id === response.field_id)
    if (field) {
      formData[field.title] = response.value
      if (field.title.toLowerCase().includes('first name')) {
        firstName = response.value
      } else if (field.title.toLowerCase().includes('last name')) {
        lastName = response.value
      } else if (field.title.toLowerCase().includes('email')) {
        email = response.value
      } else if (field.title.toLowerCase().includes('phone')) {
        phone = response.value
      }
    }
  }

  // Insert into lead table
  const { data: lead, error: leadError } = await supabaseAdmin
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (leadError) {
    // Rollback form response
    await supabaseAdmin.from('form_responses').delete().eq('id', formResponse.id)
    return new Response(
      JSON.stringify({ error: leadError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  return new Response(
    JSON.stringify({ 
      data: { form_response: formResponse, lead },
      message: 'Form submitted successfully' 
    }),
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
      .from('google_form_connections')
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
      .from('google_form_connections')
      .update({ sync_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    throw error
  }
}

async function fetchGoogleFormResponses(req: Request, supabaseAdmin: any) {
  const body = await req.json()
  const { clinic_id } = body

  if (!clinic_id) {
    return new Response(
      JSON.stringify({ error: 'clinic_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Fetch active Google Form connections for the clinic
  const { data: connections, error: connError } = await supabaseAdmin
    .from('google_form_connections')
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
      JSON.stringify({ error: 'No active Google Form connections found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  // Get lead source ID for Google Forms
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from('lead_source')
    .select('id')
    .eq('name', 'Google Forms')
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

  const forms = google.forms({ version: 'v1', auth: oauth2Client })
  let totalProcessed = 0
  let totalCreated = 0
  const errors: string[] = []

  for (const connection of connections) {
    try {
      let currentConnection = connection

      // Check and refresh token if expired
      if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
        console.log(`Refreshing token for connection ${connection.id}`)
        currentConnection = await refreshGoogleToken(oauth2Client, connection, supabaseAdmin)
      }

      oauth2Client.setCredentials({ access_token: currentConnection.access_token })

      // Fetch form responses (Google Forms API doesn't support filtering, so we fetch all)
      const { data: formResponses } = await forms.forms.responses.list({
        formId: currentConnection.google_form_id
      })

      if (!formResponses.responses || formResponses.responses.length === 0) {
        console.log(`No responses found for form ${currentConnection.google_form_id}`)
        await supabaseAdmin
          .from('google_form_connections')
          .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConnection.id)
        continue
      }

      // Filter responses based on last_sync_at (client-side filtering)
      let filteredResponses = formResponses.responses
      if (currentConnection.last_sync_at) {
        const lastSyncDate = new Date(currentConnection.last_sync_at)
        filteredResponses = formResponses.responses.filter(response => {
          if (!response.createTime) return false
          const responseDate = new Date(response.createTime)
          return responseDate > lastSyncDate
        })
      }

      if (filteredResponses.length === 0) {
        console.log(`No new responses since last sync for form ${currentConnection.google_form_id}`)
        await supabaseAdmin
          .from('google_form_connections')
          .update({ 
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConnection.id)
        continue
      }

      // Fetch form metadata to map response fields
      const { data: formMetadata } = await forms.forms.get({ 
        formId: currentConnection.google_form_id 
      })
      
      const fieldMap: { [key: string]: string } = {}
      if (formMetadata.items) {
        formMetadata.items.forEach(item => {
          if (item.questionItem?.question?.questionId) {
            fieldMap[item.questionItem.question.questionId] = item.title || item.questionItem.question.questionId
          }
        })
      }

      // Process each filtered response
      for (const response of filteredResponses) {
        try {
          const formData: { [key: string]: any } = {}
          let firstName: string | null = null
          let lastName: string | null = null
          let email: string | null = null
          let phone: string | null = null

          // Process answers
          if (response.answers) {
            Object.entries(response.answers).forEach(([questionId, answer]) => {
              const fieldTitle = fieldMap[questionId] || questionId
              let answerValue = ''
              
              if (answer.textAnswers?.answers) {
                answerValue = answer.textAnswers.answers.map(a => a.value || '').join(', ')
              } else if (answer.fileUploadAnswers?.answers) {
                answerValue = answer.fileUploadAnswers.answers.map(a => a.fileId || '').join(', ')
              }
              
              formData[fieldTitle] = answerValue

              // Extract common fields based on field title
              const lowerFieldTitle = fieldTitle.toLowerCase()
              if (lowerFieldTitle.includes('first name') || lowerFieldTitle.includes('firstname')) {
                firstName = answerValue
              } else if (lowerFieldTitle.includes('last name') || lowerFieldTitle.includes('lastname')) {
                lastName = answerValue
              } else if (lowerFieldTitle.includes('email')) {
                email = answerValue
              } else if (lowerFieldTitle.includes('phone')) {
                phone = answerValue
              }
            })
          }

          // Skip if no email (assuming email is required for lead)
          if (!email) {
            console.log(`Skipping response without email: ${response.responseId}`)
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
                created_at: response.createTime || new Date().toISOString(),
                updated_at: new Date().toISOString()
              })

            if (leadError) {
              console.error('Error creating lead:', leadError)
              errors.push(`Failed to create lead for ${email}: ${leadError.message}`)
            } else {
              totalCreated++
            }
          } else {
            console.log(`Lead already exists for email: ${email}`)
          }

          totalProcessed++
        } catch (responseError) {
          console.error('Error processing individual response:', responseError)
          errors.push(`Error processing response ${response.responseId}: ${responseError.message}`)
        }
      }

      // Update last_sync_at with the latest response timestamp
      const latestResponse = filteredResponses.reduce((latest, current) => {
        if (!latest.createTime) return current
        if (!current.createTime) return latest
        return new Date(current.createTime) > new Date(latest.createTime) ? current : latest
      }, filteredResponses[0])

      await supabaseAdmin
        .from('google_form_connections')
        .update({ 
          last_sync_at: latestResponse.createTime || new Date().toISOString(),
          sync_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConnection.id)

      console.log(`Processed ${filteredResponses.length} responses for form ${currentConnection.google_form_id}`)

    } catch (error) {
      console.error('Error processing connection:', connection.id, error)
      errors.push(`Connection ${connection.id}: ${error.message}`)
      await supabaseAdmin
        .from('google_form_connections')
        .update({ 
          sync_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
    }
  }

  return new Response(
    JSON.stringify({ 
      message: 'Google Form responses processing completed',
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