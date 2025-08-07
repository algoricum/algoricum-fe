import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

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

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface InitiateOAuthRequest {
  clinic_id: string
  google_form_id?: string
  spreadsheet_id?: string
  user_id?: string
}

interface SelectSheetRequest {
  clinic_id: string
  connection_id: string
  spreadsheet_id: string
  sheet_id: string
  range?: string
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
    
    console.log('Debug - Path:', path, 'Method:', method)

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Enhanced route handling
    if ((method === 'GET' || method === 'POST') && (path === '/' || path === '/google-form-integration' || path.includes('/health'))) {
      return new Response(
        JSON.stringify({ 
          message: 'Google Integration API is running',
          timestamp: new Date().toISOString(),
          method_received: method,
          path_received: path,
          usage_instructions: {
            step1: 'Call POST /initiate-oauth to start OAuth flow',
            step2: 'User will be redirected to Google for authorization',
            step3: 'Google will redirect to /oauth/callback automatically',
            step4: 'Select a spreadsheet and sheet via /list-sheets and /select-sheet',
            step5: 'Data will be synced automatically after selection',
            step6: 'Use POST /sync-forms for manual sync later'
          },
          available_routes: [
            'POST /google-form-integration/initiate-oauth - Start OAuth flow',
            'GET /google-form-integration/oauth/callback - OAuth callback',
            'POST /google-form-integration/list-sheets - List available spreadsheets',
            'POST /google-form-integration/select-sheet - Select specific sheet',
            'POST /google-form-integration/sync-forms - Manually sync forms/sheets',
            'POST /google-form-integration/public/submit - Submit form data'
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // 1. Initiate OAuth Flow
    if (method === 'POST' && (path.includes('/initiate-oauth') || path.endsWith('/initiate-oauth'))) {
      return await initiateOAuthFlow(req, supabaseAdmin)
    }

    // 2. OAuth Callback
    if (method === 'GET' && (path.includes('/oauth/callback') || path.endsWith('/oauth/callback'))) {
      return await handleOAuthCallback(req, supabaseAdmin)
    }

    // 3. List Available Spreadsheets
    if (method === 'POST' && (path.includes('/list-sheets') || path.endsWith('/list-sheets'))) {
      return await listGoogleSpreadsheets(req, supabaseAdmin)
    }

    // 4. Select Specific Sheet
    if (method === 'POST' && (path.includes('/select-sheet') || path.endsWith('/select-sheet'))) {
      return await selectGoogleSheet(req, supabaseAdmin)
    }

    // 5. Manual sync
    if (method === 'POST' && (path.includes('/sync-forms') || path.endsWith('/sync-forms'))) {
      return await fetchGoogleFormResponses(req, supabaseAdmin)
    }

    // 6. Public form submission
    if (method === 'POST' && (path.includes('/public/submit') || path.endsWith('/public/submit'))) {
      return await submitFormResponse(req, supabaseAdmin)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Route not found',
        debug: { receivedPath: path, receivedMethod: method },
        availableRoutes: [
          'GET /google-form-integration (health check)',
          'POST /google-form-integration/initiate-oauth',
          'GET /google-form-integration/oauth/callback',
          'POST /google-form-integration/list-sheets',
          'POST /google-form-integration/select-sheet',
          'POST /google-form-integration/sync-forms',
          'POST /google-form-integration/public/submit'
        ]
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
})

// 1. INITIATE OAUTH FLOW
async function initiateOAuthFlow(req: Request, supabaseAdmin: any) {
  try {
    const body: InitiateOAuthRequest = await req.json()
    const { clinic_id, google_form_id, spreadsheet_id, user_id } = body

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Generate state parameter
    const state = btoa(JSON.stringify({ 
      clinic_id, 
      google_form_id,
      spreadsheet_id,
      user_id,
      timestamp: Date.now()
    }))

    // Build Google OAuth URL with Sheets and Forms scopes
    const scopes = [
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/forms.body.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ]

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', googleClientId)
    authUrl.searchParams.set('redirect_uri', googleRedirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    return new Response(
      JSON.stringify({ 
        message: 'OAuth flow initiated',
        auth_url: authUrl.toString(),
        instructions: 'Redirect user to auth_url to complete OAuth flow'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('Error initiating OAuth:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to initiate OAuth flow', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
}

// 2. OAUTH CALLBACK
async function handleOAuthCallback(req: Request, supabaseAdmin: any) {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return new Response(
        `<html><body><h1>OAuth Error</h1><p>Error: ${error}</p><p>Please try again.</p></body></html>`,
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
      )
    }

    if (!code || !state) {
      return new Response(
        '<html><body><h1>OAuth Error</h1><p>Missing authorization code or state parameter</p></body></html>',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
      )
    }

    // Decode state
    let stateData
    try {
      stateData = JSON.parse(atob(state))
    } catch (e) {
      return new Response(
        '<html><body><h1>OAuth Error</h1><p>Invalid state parameter</p></body></html>',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
      )
    }

    // Exchange authorization code for access token
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: googleRedirectUri
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response(
        '<html><body><h1>OAuth Error</h1><p>Failed to exchange authorization code for tokens</p></body></html>',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
      )
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json()

    // Store connection in database
    const connectionData = {
      clinic_id: stateData.clinic_id,
      google_form_id: stateData.google_form_id,
      spreadsheet_id: stateData.spreadsheet_id,
      user_id: stateData.user_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      sync_status: 'pending', // Pending until sheet is selected
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('google_form_connections')
      .upsert(connectionData, { 
        onConflict: 'clinic_id,google_form_id,spreadsheet_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (connectionError) {
      console.error('Database error:', connectionError)
      return new Response(
        '<html><body><h1>Database Error</h1><p>Failed to save connection</p></body></html>',
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
      )
    }

    // Redirect to sheet selection page or return connection ID
    return new Response(
      `<html><body>
        <h1>✅ OAuth Connection Successful!</h1>
        <p><strong>Connection established with Google</strong></p>
        <p>Connection ID: ${connection.id}</p>
        <p>Please select a spreadsheet and sheet using the /list-sheets endpoint.</p>
        <script>
          if (window.opener) {
            setTimeout(() => {
              window.close();
            }, 5000);
          }
        </script>
      </body></html>`,
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
    )

  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(
      `<html><body><h1>OAuth Error</h1><p>An unexpected error occurred: ${error.message}</p></body></html>`,
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html' }}
    )
  }
}

// 3. LIST GOOGLE SPREADSHEETS
async function listGoogleSpreadsheets(req: Request, supabaseAdmin: any) {
  try {
    const body = await req.json()
    const { clinic_id, connection_id } = body

    if (!clinic_id || !connection_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id and connection_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Fetch connection
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('google_form_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('clinic_id', clinic_id)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Refresh token if expired
    let currentConnection = connection
    if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
      currentConnection = await refreshGoogleToken(connection, supabaseAdmin)
    }

    // Fetch spreadsheets
    const spreadsheetsUrl = 'https://www.googleapis.com/drive/v3/files'
    const spreadsheetsResponse = await fetch(spreadsheetsUrl + '?q=mimeType="application/vnd.google-apps.spreadsheet"', {
      headers: {
        'Authorization': `Bearer ${currentConnection.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!spreadsheetsResponse.ok) {
      throw new Error(`Failed to fetch spreadsheets: ${spreadsheetsResponse.statusText}`)
    }

    const spreadsheetsData = await spreadsheetsResponse.json()
    const spreadsheets = await Promise.all(spreadsheetsData.files.map(async (file: any) => {
      const sheets = await getSpreadsheetSheets(file.id, currentConnection.access_token)
      return {
        spreadsheet_id: file.id,
        name: file.name,
        sheets: sheets.map((sheet: any) => ({
          sheet_id: sheet.properties.sheetId,
          title: sheet.properties.title
        }))
      }
    }))

    return new Response(
      JSON.stringify({
        message: 'Spreadsheets retrieved successfully',
        spreadsheets
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('Error listing spreadsheets:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list spreadsheets', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
}

// 4. SELECT GOOGLE SHEET
async function selectGoogleSheet(req: Request, supabaseAdmin: any) {
  try {
    const body: SelectSheetRequest = await req.json()
    const { clinic_id, connection_id, spreadsheet_id, sheet_id, range } = body

    if (!clinic_id || !connection_id || !spreadsheet_id || !sheet_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id, connection_id, spreadsheet_id, and sheet_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Update connection with selected sheet
    const { error: updateError } = await supabaseAdmin
      .from('google_form_connections')
      .update({
        spreadsheet_id,
        sheet_id,
        range: range || 'A1:Z1000',
        sync_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection_id)
      .eq('clinic_id', clinic_id)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update connection', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Trigger automatic sync
    const syncResult = await syncFormsForClinic(clinic_id, supabaseAdmin)

    return new Response(
      JSON.stringify({
        message: 'Sheet selected and sync initiated',
        sync_result: syncResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('Error selecting sheet:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to select sheet', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
}

// 5. FORM/SHEET SYNC LOGIC
async function syncFormsForClinic(clinic_id: string, supabaseAdmin: any) {
  const { data: leadSource, error: leadSourceError } = await supabaseAdmin
    .from('lead_source')
    .select('id')
    .eq('name', 'Google Forms')
    .single()

  if (leadSourceError || !leadSource) {
    throw new Error('Lead source "Google Forms" not found in database')
  }

  const { data: connections, error: connError } = await supabaseAdmin
    .from('google_form_connections')
    .select('*')
    .eq('clinic_id', clinic_id)
    .eq('sync_status', 'active')

  if (connError) {
    throw new Error(`Failed to fetch connections: ${connError.message}`)
  }

  if (!connections || connections.length === 0) {
    throw new Error('No active connections found')
  }

  let totalProcessed = 0
  let totalCreated = 0
  const errors: string[] = []

  for (const connection of connections) {
    try {
      let currentConnection = connection

      // Refresh token if expired
      if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
        console.log(`Refreshing token for connection ${connection.id}`)
        currentConnection = await refreshGoogleToken(connection, supabaseAdmin)
      }

      // Handle Google Forms
      if (currentConnection.google_form_id) {
        const syncResult = await syncSingleForm(currentConnection.google_form_id, currentConnection, leadSource.id, clinic_id, supabaseAdmin)
        totalProcessed += syncResult.processed
        totalCreated += syncResult.created
        errors.push(...syncResult.errors)
      }

      // Handle Google Sheets
      if (currentConnection.spreadsheet_id && currentConnection.sheet_id) {
        const syncResult = await syncSheetData(currentConnection, leadSource.id, clinic_id, supabaseAdmin)
        totalProcessed += syncResult.processed
        totalCreated += syncResult.created
        errors.push(...syncResult.errors)
      }

      // Update last sync timestamp
      await supabaseAdmin
        .from('google_form_connections')
        .update({ 
          last_sync_at: new Date().toISOString(),
          sync_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConnection.id)

    } catch (error) {
      console.error(`Error processing connection ${connection.id}:`, error)
      errors.push(`Connection ${connection.id}: ${error.message}`)
      await supabaseAdmin
        .from('google_form_connections')
        .update({ sync_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', connection.id)
    }
  }

  return {
    total_processed: totalProcessed,
    leads_created: totalCreated,
    connections_processed: connections.length,
    errors: errors
  }
}

async function fetchGoogleFormResponses(req: Request, supabaseAdmin: any) {
  try {
    const body = await req.json()
    const { clinic_id } = body

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    const result = await syncFormsForClinic(clinic_id, supabaseAdmin)

    return new Response(
      JSON.stringify({ 
        message: 'Google Form/Sheet sync completed',
        summary: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
}

// Helper function to sync Google Sheet data
async function syncSheetData(connection: any, leadSourceId: string, clinicId: string, supabaseAdmin: any) {
  let processed = 0
  let created = 0
  const errors: string[] = []

  try {
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${connection.sheet_id}!${connection.range || 'A1:Z1000'}`
    const sheetsResponse = await fetch(sheetsUrl, {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!sheetsResponse.ok) {
      throw new Error(`Failed to fetch sheet data: ${sheetsResponse.statusText}`)
    }

    const sheetData = await sheetsResponse.json()
    const values = sheetData.values || []

    if (values.length === 0) {
      return { processed: 0, created: 0, errors: [] }
    }

    // Assume first row contains headers
    const headers = values[0]
    const dataRows = values.slice(1)

    // Filter rows based on last_sync_at
    let filteredRows = dataRows
    if (connection.last_sync_at) {
      // Note: Google Sheets API doesn't provide timestamps, so filtering might need to be based on a stored index or other logic
    }

    // Process each row
    for (const row of filteredRows) {
      try {
        const result = await processSheetRow(row, headers, leadSourceId, clinicId, supabaseAdmin)
        if (result.created) created++
        processed++
      } catch (error) {
        errors.push(`Row processing error: ${error.message}`)
      }
    }

  } catch (error) {
    errors.push(`Sheet ${connection.spreadsheet_id}/${connection.sheet_id}: ${error.message}`)
  }

  return { processed, created, errors }
}

// Helper function to process individual sheet row
async function processSheetRow(row: any[], headers: string[], leadSourceId: string, clinicId: string, supabaseAdmin: any) {
  const formData: { [key: string]: any } = {}
  let firstName: string | null = null
  let lastName: string | null = null
  let email: string | null = null
  let phone: string | null = null

  headers.forEach((header, index) => {
    const value = row[index] || ''
    formData[header] = value

    const lowerHeader = header.toLowerCase()
    if (lowerHeader.includes('first name') || lowerHeader.includes('firstname')) {
      firstName = value
    } else if (lowerHeader.includes('last name') || lowerHeader.includes('lastname')) {
      lastName = value
    } else if (lowerHeader.includes('email')) {
      email = value
    } else if (lowerHeader.includes('phone')) {
      phone = value
    }
  })

  if (!email) {
    throw new Error('No email found in row')
  }

  const { data: existingLead } = await supabaseAdmin
    .from('lead')
    .select('id')
    .eq('email', email)
    .eq('clinic_id', clinicId)
    .single()

  if (existingLead) {
    return { created: false }
  }

  const { error: leadError } = await supabaseAdmin
    .from('lead')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      status: 'New',
      source_id: leadSourceId,
      clinic_id: clinicId,
      form_data: formData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (leadError) {
    throw new Error(`Failed to create lead: ${leadError.message}`)
  }

  return { created: true }
}

// Helper function to get sheets in a spreadsheet
async function getSpreadsheetSheets(spreadsheetId: string, accessToken: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${response.statusText}`)
  }

  const spreadsheetData = await response.json()
  return spreadsheetData.sheets || []
}

// Helper function to sync a single form
async function syncSingleForm(formId: string, connection: any, leadSourceId: string, clinicId: string, supabaseAdmin: any) {
  let processed = 0
  let created = 0
  const errors: string[] = []

  try {
    const responsesUrl = `https://forms.googleapis.com/v1/forms/${formId}/responses`
    const responsesResponse = await fetch(responsesUrl, {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!responsesResponse.ok) {
      throw new Error(`Failed to fetch responses: ${responsesResponse.statusText}`)
    }

    const formResponsesData = await responsesResponse.json()
    
    if (!formResponsesData.responses || formResponsesData.responses.length === 0) {
      return { processed: 0, created: 0, errors: [] }
    }

    let filteredResponses = formResponsesData.responses
    if (connection.last_sync_at) {
      const lastSyncDate = new Date(connection.last_sync_at)
      filteredResponses = formResponsesData.responses.filter((response: any) => {
        if (!response.createTime) return false
        const responseDate = new Date(response.createTime)
        return responseDate > lastSyncDate
      })
    }

    const formMetadata = await fetchGoogleFormMetadata(formId, connection.access_token)
    const fieldMap: { [key: string]: string } = {}
    
    if (formMetadata.items) {
      formMetadata.items.forEach((item: any) => {
        if (item.questionItem?.question?.questionId) {
          fieldMap[item.questionItem.question.questionId] = item.title || item.questionItem.question.questionId
        }
      })
    }

    for (const response of filteredResponses) {
      try {
        const result = await processFormResponse(response, fieldMap, leadSourceId, clinicId, supabaseAdmin)
        if (result.created) created++
        processed++
      } catch (error) {
        errors.push(`Response ${response.responseId}: ${error.message}`)
      }
    }

  } catch (error) {
    errors.push(`Form ${formId}: ${error.message}`)
  }

  return { processed, created, errors }
}

// Helper function to process individual form response
async function processFormResponse(response: any, fieldMap: any, leadSourceId: string, clinicId: string, supabaseAdmin: any) {
  const formData: { [key: string]: any } = {}
  let firstName: string | null = null
  let lastName: string | null = null
  let email: string | null = null
  let phone: string | null = null

  if (response.answers) {
    Object.entries(response.answers).forEach(([questionId, answer]: [string, any]) => {
      const fieldTitle = fieldMap[questionId] || questionId
      let answerValue = ''
      
      if (answer.textAnswers?.answers) {
        answerValue = answer.textAnswers.answers.map((a: any) => a.value || '').join(', ')
      } else if (answer.fileUploadAnswers?.answers) {
        answerValue = answer.fileUploadAnswers.answers.map((a: any) => a.fileId || '').join(', ')
      }
      
      formData[fieldTitle] = answerValue

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

  if (!email) {
    throw new Error('No email found in response')
  }

  const { data: existingLead } = await supabaseAdmin
    .from('lead')
    .select('id')
    .eq('email', email)
    .eq('clinic_id', clinicId)
    .single()

  if (existingLead) {
    return { created: false }
  }

  const { error: leadError } = await supabaseAdmin
    .from('lead')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      status: 'New',
      source_id: leadSourceId,
      clinic_id: clinicId,
      form_data: formData,
      created_at: response.createTime || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (leadError) {
    throw new Error(`Failed to create lead: ${leadError.message}`)
  }

  return { created: true }
}

// Helper function to refresh Google token
async function refreshGoogleToken(connection: any, supabaseAdmin: any) {
  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const tokenParams = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token'
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    })

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.statusText}`)
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json()
    
    const updatedToken = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('google_form_connections')
      .update(updatedToken)
      .eq('id', connection.id)

    if (updateError) {
      throw new Error('Failed to update token')
    }

    return { ...connection, ...updatedToken }
  } catch (error) {
    await supabaseAdmin
      .from('google_form_connections')
      .update({ sync_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    throw error
  }
}

// Helper function to fetch Google Form metadata
async function fetchGoogleFormMetadata(formId: string, accessToken: string) {
  const url = `https://forms.googleapis.com/v1/forms/${formId}`
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch form metadata: ${response.statusText}`)
  }

  return response.json()
}

// Helper function to submit form response
async function submitFormResponse(req: Request, supabaseAdmin: any) {
  const body: SubmitFormRequest = await req.json()
  const { form_id, clinic_id, respondent_email, responses } = body

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