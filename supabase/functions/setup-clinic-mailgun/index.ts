import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Improved utility function to validate clinic slug
function validateClinicSlug(slug: string, logger: Logger): { valid: boolean; error?: string } {
  logger.debug('Validating clinic slug', { slug })

  // Check for empty or null
  if (!slug || slug.trim().length === 0) {
    return { valid: false, error: 'Clinic slug cannot be empty' }
  }

  // Check length (domain labels can be max 63 chars, but let's be more conservative)
  if (slug.length > 50) {
    return { valid: false, error: 'Clinic slug cannot exceed 50 characters' }
  }

  // Check for valid characters (alphanumeric and hyphens only, more restrictive)
  const validSlugRegex = /^[a-z0-9-]+$/
  if (!validSlugRegex.test(slug)) {
    return { valid: false, error: 'Clinic slug can only contain lowercase letters, numbers, and hyphens' }
  }

  // Cannot start or end with hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Clinic slug cannot start or end with a hyphen' }
  }

  // Cannot contain consecutive hyphens
  if (slug.includes('--')) {
    return { valid: false, error: 'Clinic slug cannot contain consecutive hyphens' }
  }

  // Additional validation for problematic patterns
  if (slug.includes('api') || slug.includes('www') || slug.includes('mail')) {
    return { valid: false, error: 'Clinic slug cannot contain reserved words (api, www, mail)' }
  }

  logger.success('Clinic slug validation passed', { slug })
  return { valid: true }
}

// Improved utility function to generate a slug from clinic name
function generateSlug(clinicName: string): string {
  let slug = clinicName
    .toLowerCase()
    .trim()
    // Remove possessive apostrophes and other special characters
    .replace(/[''`]/g, '')
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Ensure slug meets validation criteria
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/-+$/, ''); // Remove trailing hyphens after truncation
  }
  
  // If slug is empty after processing, generate a fallback
  if (!slug) {
    slug = 'clinic-' + Date.now().toString().slice(-6);
  }

  // Final cleanup
  slug = slug.replace(/^-+|-+$/g, ''); // Remove any remaining leading/trailing hyphens

  return slug || 'default-clinic';
}

// Enhanced logging utility
class Logger {
  private context: string
  private startTime: number

  constructor(context: string) {
    this.context = context
    this.startTime = Date.now()
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const elapsed = Date.now() - this.startTime
    const prefix = `[${timestamp}] [${level}] [${this.context}] [+${elapsed}ms]`
    
    if (data) {
      return `${prefix} ${message} | Data: ${JSON.stringify(data, null, 2)}`
    }
    return `${prefix} ${message}`
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage('INFO', message, data))
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage('WARN', message, data))
  }

  error(message: string, error?: any, data?: any) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...data
    } : data
    console.error(this.formatMessage('ERROR', message, errorData))
  }

  debug(message: string, data?: any) {
    console.log(this.formatMessage('DEBUG', message, data))
  }

  success(message: string, data?: any) {
    console.log(this.formatMessage('SUCCESS', `✅ ${message}`, data))
  }

  step(message: string, data?: any) {
    console.log(this.formatMessage('STEP', `🔄 ${message}`, data))
  }

  performance(operation: string, duration: number, data?: any) {
    console.log(this.formatMessage('PERF', `⏱️ ${operation} completed in ${duration}ms`, data))
  }
}

// DNS function that calls Next.js API route with proxy support
async function createNamecheapDNSRecords(domain: string, subdomain: string, logger: Logger) {
  const stepLogger = new Logger('NamecheapDNS');
  const stepStart = Date.now();

  // Get the Next.js API URL from environment
  const NEXTJS_API_URL = Deno.env.get('NEXTJS_API_URL') || Deno.env.get('VERCEL_URL')
  
  if (!NEXTJS_API_URL) {
    stepLogger.warn('NEXTJS_API_URL not configured, DNS setup will be manual')
    return { 
      automated: false, 
      error: 'NEXTJS_API_URL not configured for proxy support', 
      reason: 'No proxy available' 
    }
  }

  const nextjsApiUrl = NEXTJS_API_URL.startsWith('http') ? NEXTJS_API_URL : `https://${NEXTJS_API_URL}`
  const dnsApiEndpoint = `${nextjsApiUrl}/api/namecheap-dns`

  stepLogger.info('Starting DNS setup via Next.js proxy', {
    domain,
    subdomain,
    apiEndpoint: dnsApiEndpoint
  });

  try {
    const requestPayload = {
      action: 'setup-dns',
      domain,
      subdomain
    }

    stepLogger.debug('Calling Next.js DNS API', { payload: requestPayload })

    const response = await fetch(dnsApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(60000) // Longer timeout for DNS operations
    })

    stepLogger.performance('Next.js DNS API call', Date.now() - stepStart, {
      status: response.status,
      statusText: response.statusText
    })

    if (!response.ok) {
      console.log("--------------------------,", response)
      const errorText = await response.text()
      stepLogger.error('Next.js DNS API failed', { 
        status: response.status, 
        error: errorText 
      })
      return { 
        automated: false, 
        error: `DNS API failed (${response.status}): ${errorText}`,
        details: errorText
      }
    }

    const result = await response.json()
    
    if (result.automated) {
      stepLogger.success('DNS records updated successfully via proxy', {
        domain,
        subdomain,
        recordsCreated: result.recordsCreated?.length || 0,
        totalDuration: Date.now() - stepStart
      })
    } else {
      stepLogger.warn('DNS setup failed via proxy', {
        error: result.error,
        details: result.details
      })
    }

    return result

  } catch (error) {
    stepLogger.performance('Failed DNS setup via proxy', Date.now() - stepStart)
    stepLogger.error('DNS API call failed', error, {
      domain,
      subdomain,
      apiEndpoint: dnsApiEndpoint,
      duration: Date.now() - stepStart
    })
    return { 
      automated: false, 
      error: `DNS proxy call failed: ${error.message}`, 
      details: error.stack 
    }
  }
}

// Get DNS records needed for manual setup
function getRequiredDNSRecords(subdomain: string, logger: Logger) {
  const subdomainHost = subdomain.split('.')[0]
  const records = {
    mx_records: [
      { type: 'MX', host: subdomainHost, value: 'mxa.mailgun.org', priority: 10 },
      { type: 'MX', host: subdomainHost, value: 'mxb.mailgun.org', priority: 10 }
    ],
    txt_records: [
      { type: 'TXT', host: subdomainHost, value: 'v=spf1 include:mailgun.org ~all' }
    ]
  }

  logger.info('Generated manual DNS records', { subdomain, subdomainHost, records })
  return records
}

// Improved domain verification function
async function checkDomainVerification(domain: string, apiKey: string, logger: Logger) {
  const stepLogger = new Logger('DomainVerification')
  const stepStart = Date.now()

  stepLogger.step('Checking domain verification status', { domain })

  try {
    const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
      },
      signal: AbortSignal.timeout(30000)
    })

    stepLogger.performance('Mailgun API call', Date.now() - stepStart, {
      status: response.status,
      statusText: response.statusText,
      domain
    })

    if (!response.ok) {
      if (response.status === 404) {
        stepLogger.warn('Domain not found in Mailgun', { domain })
        return { verified: false, error: 'Domain not found in Mailgun', exists: false }
      }
      const errorText = await response.text()
      stepLogger.warn('Domain verification check failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        domain
      })
      return { verified: false, error: `HTTP ${response.status}: ${response.statusText}`, exists: false }
    }

    const data = await response.json()
    stepLogger.debug('Domain verification response', {
      domain,
      state: data.domain?.state,
      hasReceivingRecords: !!data.receiving_dns_records,
      hasSendingRecords: !!data.sending_dns_records,
    })

    const result = {
      verified: data.domain?.state === 'active',
      state: data.domain?.state,
      exists: true,
      receiving_records: data.receiving_dns_records,
      sending_records: data.sending_dns_records,
      domain_info: {
        name: data.domain?.name,
        state: data.domain?.state,
        wildcard: data.domain?.wildcard,
        spam_action: data.domain?.spam_action,
        created_at: data.domain?.created_at
      }
    }

    stepLogger.performance('Domain verification check', Date.now() - stepStart, result)
    
    if (result.verified) {
      stepLogger.success('Domain is verified and active', { domain, state: result.state })
    } else {
      stepLogger.warn('Domain is not yet verified', { domain, state: result.state })
    }

    return result

  } catch (error) {
    stepLogger.performance('Failed domain verification check', Date.now() - stepStart)
    stepLogger.error('Domain verification check error', error, { domain })
    return { verified: false, error: error.message, details: error.stack, exists: false }
  }
}

// Improved Mailgun domain creation with better error handling
async function createMailgunDomain(subdomain: string, apiKey: string, logger: Logger) {
  const stepLogger = new Logger('MailgunDomainCreation')
  const stepStart = Date.now()

  // Validate domain format before sending to Mailgun
  if (!subdomain || subdomain.length < 4 || subdomain.length > 253) {
    throw new Error(`Invalid domain format: ${subdomain}`)
  }

  // Check if domain name contains valid characters
  const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/
  if (!domainRegex.test(subdomain)) {
    throw new Error(`Invalid domain format: ${subdomain}. Domain must contain only lowercase letters, numbers, dots, and hyphens`)
  }

  const mailgunPayload = {
    name: subdomain,
    smtp_password: crypto.randomUUID().substring(0, 32), // Limit password length
    spam_action: 'disabled',
    wildcard: 'false',
    force_dkim_authority: 'true'
  }

  stepLogger.info('Creating Mailgun domain', {
    domain: subdomain,
    payload: { ...mailgunPayload, smtp_password: '[REDACTED]' }
  })

  // First, check if domain already exists
  const existingDomain = await checkDomainVerification(subdomain, apiKey, stepLogger)
  if (existingDomain.exists) {
    stepLogger.info('Domain already exists in Mailgun', { domain: subdomain, verified: existingDomain.verified })
    return existingDomain
  }

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    stepLogger.debug(`Mailgun creation attempt ${attempts}/${maxAttempts}`)

    try {
      const response = await fetch('https://api.mailgun.net/v3/domains', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(mailgunPayload),
        signal: AbortSignal.timeout(30000)
      })

      stepLogger.performance(`Mailgun API call attempt ${attempts}`, Date.now() - stepStart, {
        status: response.status,
        statusText: response.statusText,
        subdomain
      })

      if (response.ok) {
        const data = await response.json()
        stepLogger.success('Mailgun domain created successfully', {
          domain: data.domain?.name,
          state: data.domain?.state,
          attempt: attempts
        })
        return data
      }

      const responseText = await response.text()
      
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error(`Mailgun authentication failed. Please check your MAILGUN_API_KEY`)
      }
      
      if (response.status === 402) {
        throw new Error(`Mailgun payment required. Please verify your account and add payment method`)
      }
      
      if (response.status === 409 || responseText.includes('already exists')) {
        stepLogger.info('Domain already exists, fetching existing domain info')
        return await checkDomainVerification(subdomain, apiKey, stepLogger)
      }
      
      if (response.status === 429) {
        if (attempts < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000) // Exponential backoff, max 10s
          stepLogger.warn(`Rate limited, retrying in ${delay}ms`, { attempt: attempts })
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`Mailgun rate limit exceeded after ${maxAttempts} attempts`)
      }
      
      if (response.status >= 500 && attempts < maxAttempts) {
        const delay = Math.min(2000 * attempts, 10000) // Linear backoff for server errors
        stepLogger.warn(`Server error (${response.status}), retrying in ${delay}ms`, { 
          attempt: attempts, 
          error: responseText.substring(0, 200)
        })
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If we've exhausted retries or hit a non-retryable error
      throw new Error(`Mailgun domain creation failed (${response.status}): ${responseText}`)

    } catch (error) {
      if (attempts >= maxAttempts) {
        throw error
      }
      
      stepLogger.warn(`Attempt ${attempts} failed, retrying`, { error: error.message })
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
    }
  }

  throw new Error(`Failed to create Mailgun domain after ${maxAttempts} attempts`)
}

serve(async (req) => {
  const logger = new Logger('ClinicMailgunSetup')
  
  if (req.method === 'OPTIONS') {
    logger.info('CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  const requestStart = Date.now()
  let clinicId: string | undefined

  try {
    logger.info('🚀 Starting Mailgun + Namecheap setup function')
    
    // Environment variables validation
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
    const BASE_DOMAIN = Deno.env.get('BASE_DOMAIN') // Should be 'msgdesk.co'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const WEBHOOK_BASE_URL = Deno.env.get('WEBHOOK_BASE_URL')
    const NEXTJS_API_URL = Deno.env.get('NEXTJS_API_URL')

    const environmentCheck = {
      MAILGUN_API_KEY: !!MAILGUN_API_KEY,
      BASE_DOMAIN: !!BASE_DOMAIN,
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_BASE_URL: !!WEBHOOK_BASE_URL,
      NEXTJS_API_URL: !!NEXTJS_API_URL
    }

    logger.info('📋 Environment variables check', {
      ...environmentCheck,
      BASE_DOMAIN: BASE_DOMAIN,
      timestamp: new Date().toISOString()
    })

    // Validate required environment variables
    const missingRequired = []
    if (!MAILGUN_API_KEY) missingRequired.push('MAILGUN_API_KEY')
    if (!BASE_DOMAIN) missingRequired.push('BASE_DOMAIN')
    if (!SUPABASE_URL) missingRequired.push('SUPABASE_URL')
    if (!SUPABASE_SERVICE_ROLE_KEY) missingRequired.push('SUPABASE_SERVICE_ROLE_KEY')

    if (missingRequired.length > 0) {
      throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`)
    }

    // Validate BASE_DOMAIN format
    if (!BASE_DOMAIN.includes('.') || BASE_DOMAIN.startsWith('.') || BASE_DOMAIN.endsWith('.')) {
      throw new Error(`Invalid BASE_DOMAIN format: ${BASE_DOMAIN}. Expected format: domain.com`)
    }

    // Parse request body
    logger.step('Parsing request body')
    const requestBody = await req.json()
    const { clinicId: requestClinicId, action = 'setup', clinicName } = requestBody
    clinicId = requestClinicId

    logger.info('📝 Request details', {
      action,
      clinicId,
      clinicName,
      requestBody,
      method: req.method,
      url: req.url
    })

    if (!clinicId) {
      throw new Error('clinicId is required in request body')
    }

    // Initialize Supabase
    logger.step('Initializing Supabase client')
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    logger.success('Supabase client initialized')

    // Get clinic data
    logger.step('Fetching clinic data from database')
    const clinicFetchStart = Date.now()
    
    const { data: clinic, error: clinicError } = await supabase
      .from('clinic')
      .select('id, slug, name, domain, email, created_at, updated_at')
      .eq('id', clinicId)
      .single()

    logger.performance('Clinic data fetch', Date.now() - clinicFetchStart, {
      clinicFound: !!clinic,
      hasError: !!clinicError
    })

    if (clinicError || !clinic) {
      logger.error('❌ Clinic fetch failed', clinicError, {
        clinicId,
        query: 'clinic table lookup'
      })
      throw new Error(`Clinic not found: ${clinicError?.message || 'No clinic data returned'}`)
    }

    logger.success('Clinic data retrieved', {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      currentDomain: clinic.domain,
      currentEmail: clinic.email,
      createdAt: clinic.created_at
    })

    // Route to appropriate action
    if (action === 'setup') {
      return await handleSetupAction(clinic, BASE_DOMAIN, MAILGUN_API_KEY, WEBHOOK_BASE_URL, supabase, logger, requestStart, clinicName)
    } else if (action === 'verify') {
      return await handleVerifyAction(clinic, MAILGUN_API_KEY, supabase, logger, requestStart)
    } else if (action === 'delete') {
      return await handleDeleteAction(clinic, MAILGUN_API_KEY, supabase, logger, requestStart)
    } else {
      throw new Error(`Invalid action: ${action}. Supported actions: setup, verify, delete`)
    }

  } catch (error) {
    logger.performance('Function execution failed', Date.now() - requestStart)
    logger.error('💥 Function execution error', error, {
      clinicId,
      requestUrl: req.url,
      requestMethod: req.method,
      executionTime: Date.now() - requestStart
    })
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString(),
        clinicId,
        executionTime: Date.now() - requestStart
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Improved setup action handler
async function handleSetupAction(clinic: any, baseDomain: string, mailgunApiKey: string, webhookBaseUrl: string, supabase: any, logger: Logger, requestStart: number, clinicName?: string) {
  const setupLogger = new Logger('SetupAction')
  setupLogger.info('⚙️ Starting domain setup process', { clinicId: clinic.id, clinicName: clinic.name })

  // Use existing slug or generate a new one from clinicName
  let clinicSlug = clinic.slug
  if (!clinicSlug && clinicName) {
    setupLogger.info('No slug found in database, generating from clinicName', { clinicName })
    clinicSlug = generateSlug(clinicName)

    // Update the clinic record with the new slug
    const { error: slugUpdateError } = await supabase
      .from('clinic')
      .update({ slug: clinicSlug, updated_at: new Date().toISOString() })
      .eq('id', clinic.id)

    if (slugUpdateError) {
      setupLogger.error('Failed to update clinic slug', slugUpdateError, { clinicId: clinic.id, slug: clinicSlug })
      throw new Error(`Failed to update clinic slug: ${slugUpdateError.message}`)
    }
    setupLogger.success('Clinic slug updated in database', { clinicId: clinic.id, slug: clinicSlug })
  }

  if (!clinicSlug) {
    throw new Error('No clinic slug available and no clinic name provided to generate one')
  }

  // Validate clinic slug format
  const slugValidation = validateClinicSlug(clinicSlug, setupLogger)
  if (!slugValidation.valid) {
    // Try to fix the slug
    const fixedSlug = generateSlug(clinicSlug)
    const fixedValidation = validateClinicSlug(fixedSlug, setupLogger)
    
    if (fixedValidation.valid) {
      setupLogger.warn('Original slug invalid, using fixed version', { 
        original: clinicSlug, 
        fixed: fixedSlug, 
        originalError: slugValidation.error 
      })
      clinicSlug = fixedSlug
      
      // Update database with fixed slug
      await supabase
        .from('clinic')
        .update({ slug: clinicSlug, updated_at: new Date().toISOString() })
        .eq('id', clinic.id)
    } else {
      throw new Error(`Cannot create valid slug from "${clinicSlug}": ${slugValidation.error}`)
    }
  }
  
  // Generate domain and email
  const subdomain = `${clinicSlug}.${baseDomain}`
  const clinicEmail = `contact@${subdomain}`

  setupLogger.info('🌐 Generated clinic domain configuration', {
    clinicId: clinic.id,
    clinicSlug: clinicSlug,
    baseDomain,
    subdomain,
    clinicEmail,
    previousDomain: clinic.domain,
    previousEmail: clinic.email
  })

  // Step 1: Create/verify domain in Mailgun
  setupLogger.step('Creating domain in Mailgun')
  const mailgunData = await createMailgunDomain(subdomain, mailgunApiKey, setupLogger)

  // Step 2: Get domain verification status
  setupLogger.step('Checking domain verification status')
  const domainInfo = await checkDomainVerification(subdomain, mailgunApiKey, setupLogger)

  // Step 3: Get required DNS records
  setupLogger.step('Generating required DNS records')
  const requiredRecords = getRequiredDNSRecords(subdomain, setupLogger)

  // Step 4: Attempt automated DNS setup via Next.js proxy
  setupLogger.step('Attempting automated DNS setup via proxy')
  const dnsResult = await createNamecheapDNSRecords(baseDomain, subdomain, setupLogger)

  // Step 5: Set up email routing
  let routeCreated = false
  let routeInfo = null

  if (webhookBaseUrl) {
    setupLogger.step('Setting up email routing webhook')
    
    try {
      const webhookUrl = new URL(`${webhookBaseUrl}/webhooks/mailgun/${clinic.id}`)
      if (!webhookUrl.protocol.startsWith('https')) {
        setupLogger.warn('Webhook URL is not HTTPS, Mailgun may reject it', { webhookUrl: webhookUrl.toString() })
      }

      const routePayload = {
        priority: '1',
        description: `Route for ${subdomain} - ${clinic.name}`,
        expression: `match_recipient(".*@${subdomain}")`,
        action: `forward("${webhookBaseUrl}/webhooks/mailgun/${clinic.id}")`
      }

      setupLogger.debug('Creating email route', {
        webhookUrl: webhookUrl.toString(),
        expression: routePayload.expression,
        description: routePayload.description
      })

      const routeResponse = await fetch('https://api.mailgun.net/v3/routes', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(routePayload),
        signal: AbortSignal.timeout(30000)
      })

      if (routeResponse.ok) {
        const routeData = await routeResponse.json()
        routeCreated = true
        routeInfo = routeData.route
        setupLogger.success('Email route created successfully', {
          routeId: routeInfo?.id,
          expression: routeInfo?.expression,
          actions: routeInfo?.actions
        })
      } else {
        const routeError = await routeResponse.text()
        setupLogger.warn('Route creation failed', {
          status: routeResponse.status,
          error: routeError,
          payload: routePayload
        })
      }
    } catch (routeError) {
      setupLogger.error('Route creation exception', routeError, {
        webhookBaseUrl,
        clinicId: clinic.id
      })
    }
  } else {
    setupLogger.warn('WEBHOOK_BASE_URL not configured, skipping email route setup')
  }

  // Step 6: Update database
  setupLogger.step('Updating database records')
  const dbStart = Date.now()

  // Update clinic record
  const clinicUpdateData = {
    domain: subdomain,
    email: clinicEmail,
    slug: clinicSlug, // Ensure slug is saved
    updated_at: new Date().toISOString()
  }

  const { error: clinicUpdateError } = await supabase
    .from('clinic')
    .update(clinicUpdateData)
    .eq('id', clinic.id)

  if (clinicUpdateError) {
    setupLogger.error('Clinic update failed', clinicUpdateError, {
      clinicId: clinic.id,
      updateData: clinicUpdateData
    })
    throw new Error(`Failed to update clinic: ${clinicUpdateError.message}`)
  }

  setupLogger.success('Clinic record updated')

  // Create/update mailgun_settings
  const settingsData = {
    clinic_id: clinic.id,
    mailgun_domain: subdomain,
    sender_name: clinic.name,
    sender_email: clinicEmail,
    domain_verified: domainInfo.verified || false,
    status: 'active',
    route_id: routeInfo?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error: settingsError } = await supabase
    .from('mailgun_settings')
    .upsert(settingsData)

  if (settingsError) {
    setupLogger.error('Settings upsert failed', settingsError, {
      clinicId: clinic.id,
      settingsData
    })
  } else {
    setupLogger.success('Mailgun settings updated')
  }

  setupLogger.performance('Database updates', Date.now() - dbStart)

  // Prepare comprehensive response
  const result = {
    success: true,
    message: 'Mailgun domain setup completed successfully',
    data: {
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicSlug: clinicSlug,
      domain: subdomain,
      email: clinicEmail,
      domainVerified: domainInfo.verified,
      domainState: domainInfo.state,
      routeCreated,
      routeInfo,
      dnsAutomated: dnsResult.automated,
      dnsError: dnsResult.error,
      requiredDNSRecords: dnsResult.automated ? null : requiredRecords,
      verificationStatus: domainInfo,
      mailgunResponse: mailgunData,
      executionTime: Date.now() - requestStart,
      nextSteps: dnsResult.automated 
        ? [
            'Domain setup complete!',
            'DNS records have been automatically configured via proxy',
            'Email should work within 10-15 minutes after DNS propagation',
            `Test by sending email to: ${clinicEmail}`
          ]
        : [
            'DNS records need to be set manually in your DNS provider',
            'Add the MX and TXT records shown in requiredDNSRecords',
            'Domain verification will happen automatically after DNS propagation',
            'Use the verify action to check status after DNS changes'
          ]
    }
  }

  setupLogger.performance('Complete setup process', Date.now() - requestStart, {
    success: true,
    domainConfigured: subdomain,
    dnsAutomated: dnsResult.automated,
    routeCreated
  })

  setupLogger.success('🎉 Setup completed successfully', result.data)

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Verify action handler
async function handleVerifyAction(clinic: any, mailgunApiKey: string, supabase: any, logger: Logger, requestStart: number) {
  const verifyLogger = new Logger('VerifyAction')
  verifyLogger.info('🔍 Starting domain verification check', { clinicId: clinic.id })

  if (!clinic.domain) {
    throw new Error('No domain configured for this clinic. Run setup first.')
  }

  const verificationStatus = await checkDomainVerification(clinic.domain, mailgunApiKey, verifyLogger)
  
  // Update verification status in database if verified
  if (verificationStatus.verified) {
    verifyLogger.step('Updating verification status in database')
    const { error: updateError } = await supabase
      .from('mailgun_settings')
      .update({ 
        domain_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('clinic_id', clinic.id)

    if (updateError) {
      verifyLogger.error('Failed to update verification status', updateError)
    } else {
      verifyLogger.success('Verification status updated in database')
    }
  }

  const result = {
    success: true,
    message: verificationStatus.verified ? 'Domain is verified and active' : 'Domain verification pending',
    data: {
      clinicId: clinic.id,
      domain: clinic.domain,
      verified: verificationStatus.verified,
      status: verificationStatus.state,
      exists: verificationStatus.exists,
      details: verificationStatus,
      executionTime: Date.now() - requestStart
    }
  }

  verifyLogger.performance('Verification check complete', Date.now() - requestStart, result.data)

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Delete action handler
async function handleDeleteAction(clinic: any, mailgunApiKey: string, supabase: any, logger: Logger, requestStart: number) {
  const deleteLogger = new Logger('DeleteAction')
  deleteLogger.info('🗑️ Starting cleanup process', { clinicId: clinic.id, domain: clinic.domain })

  let mailgunDeleted = false
  let databaseCleaned = false

  if (clinic.domain) {
    // Delete from Mailgun
    deleteLogger.step('Deleting domain from Mailgun')
    const mailgunStart = Date.now()
    
    try {
      const deleteResponse = await fetch(
        `https://api.mailgun.net/v3/domains/${clinic.domain}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          },
          signal: AbortSignal.timeout(30000)
        }
      )

      deleteLogger.performance('Mailgun domain deletion', Date.now() - mailgunStart, {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        domain: clinic.domain
      })

      if (deleteResponse.ok) {
        mailgunDeleted = true
        deleteLogger.success('Domain deleted from Mailgun')
      } else {
        const errorText = await deleteResponse.text()
        deleteLogger.warn('Mailgun deletion failed', {
          status: deleteResponse.status,
          error: errorText,
          domain: clinic.domain
        })
      }
    } catch (error) {
      deleteLogger.error('Mailgun deletion exception', error, { domain: clinic.domain })
    }

    // Clean up database
    deleteLogger.step('Cleaning up database records')
    const dbStart = Date.now()

    try {
      // Delete mailgun settings
      const { error: settingsDeleteError } = await supabase
        .from('mailgun_settings')
        .delete()
        .eq('clinic_id', clinic.id)

      if (settingsDeleteError) {
        deleteLogger.error('Failed to delete mailgun_settings', settingsDeleteError)
      } else {
        deleteLogger.success('Mailgun settings deleted')
      }

      // Update clinic record
      const { error: clinicUpdateError } = await supabase
        .from('clinic')
        .update({ 
          domain: null, 
          email: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinic.id)

      if (clinicUpdateError) {
        deleteLogger.error('Failed to update clinic record', clinicUpdateError)
      } else {
        deleteLogger.success('Clinic record updated')
        databaseCleaned = true
      }

      deleteLogger.performance('Database cleanup', Date.now() - dbStart)

    } catch (error) {
      deleteLogger.error('Database cleanup exception', error, { clinicId: clinic.id })
    }
  } else {
    deleteLogger.info('No domain configured for clinic, skipping Mailgun deletion')
  }

  const result = {
    success: true,
    message: 'Cleanup completed',
    data: {
      clinicId: clinic.id,
      mailgunDeleted,
      databaseCleaned,
      executionTime: Date.now() - requestStart
    }
  }

  deleteLogger.performance('Complete cleanup process', Date.now() - requestStart, result.data)
  deleteLogger.success('✅ Cleanup completed', result.data)

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}