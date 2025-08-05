import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility function to validate clinic slug
function validateClinicSlug(slug: string, logger: Logger): { valid: boolean; error?: string } {
  logger.debug('Validating clinic slug', { slug })

  // Check for empty or null
  if (!slug || slug.trim().length === 0) {
    return { valid: false, error: 'Clinic slug cannot be empty' }
  }

  // Check length (domain labels can be max 63 chars)
  if (slug.length > 63) {
    return { valid: false, error: 'Clinic slug cannot exceed 63 characters' }
  }

  // Check for valid characters (alphanumeric and hyphens only)
  const validSlugRegex = /^[a-zA-Z0-9-]+$/
  if (!validSlugRegex.test(slug)) {
    return { valid: false, error: 'Clinic slug can only contain letters, numbers, and hyphens' }
  }

  // Cannot start or end with hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Clinic slug cannot start or end with a hyphen' }
  }

  // Cannot contain consecutive hyphens
  if (slug.includes('--')) {
    return { valid: false, error: 'Clinic slug cannot contain consecutive hyphens' }
  }

  logger.success('Clinic slug validation passed', { slug })
  return { valid: true }
}

// Utility function to generate a slug from clinic name
function generateSlug(clinicName: string): string {
  let slug = clinicName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .trim();

  // Ensure slug meets validation criteria
  if (slug.length > 63) {
    slug = slug.substring(0, 63);
  }
  if (slug.startsWith('-')) {
    slug = slug.substring(1);
  }
  if (slug.endsWith('-')) {
    slug = slug.substring(0, slug.length - 1);
  }
  return slug || 'default-clinic'; // Fallback if slug is empty after processing
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

// Namecheap API integration with enhanced logging
async function createNamecheapDNSRecords(domain: string, subdomain: string, logger: Logger) {
  const stepLogger = new Logger('NamecheapDNS')
  const stepStart = Date.now()

  const NAMECHEAP_API_USER = Deno.env.get('NAMECHEAP_API_USER')
  const NAMECHEAP_API_KEY = Deno.env.get('NAMECHEAP_API_KEY')
  const NAMECHEAP_USERNAME = Deno.env.get('NAMECHEAP_USERNAME')
  const NAMECHEAP_CLIENT_IP = Deno.env.get('NAMECHEAP_CLIENT_IP')

  stepLogger.info('Starting DNS setup', {
    domain,
    subdomain,
    hasApiUser: !!NAMECHEAP_API_USER,
    hasApiKey: !!NAMECHEAP_API_KEY,
    hasUsername: !!NAMECHEAP_USERNAME,
    hasClientIp: !!NAMECHEAP_CLIENT_IP
  })

  if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || !NAMECHEAP_CLIENT_IP) {
    stepLogger.warn('Namecheap API credentials incomplete, DNS setup will be manual', {
      missing: {
        apiUser: !NAMECHEAP_API_USER,
        apiKey: !NAMECHEAP_API_KEY,
        username: !NAMECHEAP_USERNAME,
        clientIp: !NAMECHEAP_CLIENT_IP
      }
    })
    return { automated: false, records: null, reason: 'Missing credentials' }
  }

  try {
    stepLogger.step('Fetching existing DNS records')
    
    // Parse domain parts
    const domainParts = domain.split('.')
    const sld = domainParts[0]
    const tld = domainParts[1]
    
    stepLogger.debug('Parsed domain', { domain, sld, tld, subdomain })

    // Get current DNS records
    const getRecordsUrl = new URL('https://api.namecheap.com/xml.response')
    const getRecordsParams = {
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_USERNAME,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.dns.getHosts',
      SLD: sld,
      TLD: tld
    }

    Object.entries(getRecordsParams).forEach(([key, value]) => {
      getRecordsUrl.searchParams.set(key, value)
    })

    stepLogger.debug('Fetching DNS records', { 
      url: getRecordsUrl.toString().replace(NAMECHEAP_API_KEY!, '[REDACTED]'),
      params: { ...getRecordsParams, ApiKey: '[REDACTED]' }
    })

    const getRecordsStart = Date.now()
    const getResponse = await fetch(getRecordsUrl.toString(), {
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    stepLogger.performance('DNS records fetch', Date.now() - getRecordsStart, {
      status: getResponse.status,
      statusText: getResponse.statusText
    })

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch DNS records: ${getResponse.status} ${getResponse.statusText}`)
    }

    const getResponseText = await getResponse.text()
    stepLogger.debug('DNS records response received', { 
      responseLength: getResponseText.length,
      containsError: getResponseText.includes('<Errors>'),
      responsePreview: getResponseText.substring(0, 200) + '...'
    })

    // Parse XML response to check for errors
    if (getResponseText.includes('<Errors>')) {
      const errorMatch = getResponseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
      const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
      const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
      throw new Error(`Namecheap API Error ${errorNumber}: ${errorText}`)
    }

    stepLogger.success('Current DNS records fetched successfully')

    // Prepare new DNS records
    const subdomainHost = subdomain.replace(`.${domain}`, '')
    stepLogger.info('Preparing to add MX records', {
      subdomainHost,
      mxRecords: [
        { host: subdomainHost, type: 'MX', address: 'mxa.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'MX', address: 'mxb.mailgun.org', priority: 10 }
      ]
    })

    // Parse existing DNS records to preserve them
    const existingRecords: any[] = []
    let recordCounter = 1
    
    // Extract existing records from XML response
    const hostRegex = /<host[^>]*HostId="(\d+)"[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*Address="([^"]*)"[^>]*MXPref="([^"]*)"[^>]*TTL="([^"]*)"[^>]*\/>/g
    let match
    
    while ((match = hostRegex.exec(getResponseText)) !== null) {
      const [, hostId, name, type, address, mxPref, ttl] = match
      // Skip records we're about to replace
      if (name !== subdomainHost || type !== 'MX') {
        existingRecords.push({
          name: name,
          type: type,
          address: address,
          mxPref: mxPref || '',
          ttl: ttl || '1800'
        })
      }
    }

    stepLogger.debug('Existing DNS records to preserve', { 
      count: existingRecords.length,
      records: existingRecords.slice(0, 5) // Log first 5 for brevity
    })

    // Set new DNS records (existing + new MX + SPF)
    const setRecordsUrl = new URL('https://api.namecheap.com/xml.response')
    const setRecordsParams: any = {
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_USERNAME,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.dns.setHosts',
      SLD: sld,
      TLD: tld
    }

    // Add existing records
    existingRecords.forEach(record => {
      setRecordsParams[`HostName${recordCounter}`] = record.name
      setRecordsParams[`RecordType${recordCounter}`] = record.type
      setRecordsParams[`Address${recordCounter}`] = record.address
      if (record.type === 'MX' && record.mxPref) {
        setRecordsParams[`MXPref${recordCounter}`] = record.mxPref
      }
      setRecordsParams[`TTL${recordCounter}`] = record.ttl
      recordCounter++
    })

    // Add new MX records
    setRecordsParams[`HostName${recordCounter}`] = subdomainHost
    setRecordsParams[`RecordType${recordCounter}`] = 'MX'
    setRecordsParams[`Address${recordCounter}`] = 'mxa.mailgun.org'
    setRecordsParams[`MXPref${recordCounter}`] = '10'
    setRecordsParams[`TTL${recordCounter}`] = '300'
    recordCounter++

    setRecordsParams[`HostName${recordCounter}`] = subdomainHost
    setRecordsParams[`RecordType${recordCounter}`] = 'MX'
    setRecordsParams[`Address${recordCounter}`] = 'mxb.mailgun.org'
    setRecordsParams[`MXPref${recordCounter}`] = '10'
    setRecordsParams[`TTL${recordCounter}`] = '300'
    recordCounter++

    // Add SPF TXT record
    setRecordsParams[`HostName${recordCounter}`] = subdomainHost
    setRecordsParams[`RecordType${recordCounter}`] = 'TXT'
    setRecordsParams[`Address${recordCounter}`] = 'v=spf1 include:mailgun.org ~all'
    setRecordsParams[`TTL${recordCounter}`] = '300'

    Object.entries(setRecordsParams).forEach(([key, value]) => {
      setRecordsUrl.searchParams.set(key, value)
    })

    stepLogger.step('Setting DNS records')
    stepLogger.debug('DNS update request', {
      url: setRecordsUrl.toString().replace(NAMECHEAP_API_KEY!, '[REDACTED]'),
      params: { ...setRecordsParams, ApiKey: '[REDACTED]' }
    })

    const setRecordsStart = Date.now()
    const setResponse = await fetch(setRecordsUrl.toString(), {
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    stepLogger.performance('DNS records update', Date.now() - setRecordsStart, {
      status: setResponse.status,
      statusText: setResponse.statusText
    })

    if (!setResponse.ok) {
      throw new Error(`Failed to set DNS records: ${setResponse.status} ${setResponse.statusText}`)
    }

    const setResponseText = await setResponse.text()
    stepLogger.debug('DNS update response received', {
      responseLength: setResponseText.length,
      containsError: setResponseText.includes('<Errors>'),
      responsePreview: setResponseText.substring(0, 200) + '...'
    })

    // Check for errors in set response
    if (setResponseText.includes('<Errors>')) {
      const errorMatch = setResponseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
      const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
      const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
      throw new Error(`Namecheap DNS Update Error ${errorNumber}: ${errorText}`)
    }

    stepLogger.performance('Complete DNS setup', Date.now() - stepStart)
    stepLogger.success('DNS records created successfully on Namecheap', {
      domain,
      subdomain,
      recordsSet: 3, // 2 MX + 1 TXT
      totalDuration: Date.now() - stepStart
    })

    return { 
      automated: true, 
      records: setResponseText,
      recordsCreated: [
        { host: subdomainHost, type: 'MX', address: 'mxa.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'MX', address: 'mxb.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'TXT', address: 'v=spf1 include:mailgun.org ~all' }
      ],
      existingRecordsPreserved: existingRecords.length
    }

  } catch (error) {
    stepLogger.performance('Failed DNS setup', Date.now() - stepStart)
    stepLogger.error('Namecheap DNS creation failed', error, {
      domain,
      subdomain,
      operation: 'DNS setup',
      duration: Date.now() - stepStart
    })
    return { automated: false, error: error.message, details: error.stack }
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

// Check domain verification status with enhanced logging
async function checkDomainVerification(domain: string, apiKey: string, logger: Logger) {
  const stepLogger = new Logger('DomainVerification')
  const stepStart = Date.now()

  stepLogger.step('Checking domain verification status', { domain })

  try {
    const verifyStart = Date.now()
    const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    stepLogger.performance('Mailgun API call', Date.now() - verifyStart, {
      status: response.status,
      statusText: response.statusText,
      domain
    })

    if (!response.ok) {
      stepLogger.warn('Domain verification check failed', {
        status: response.status,
        statusText: response.statusText,
        domain
      })
      return { verified: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    stepLogger.debug('Domain verification response', {
      domain,
      state: data.domain?.state,
      hasReceivingRecords: !!data.receiving_dns_records,
      hasSendingRecords: !!data.sending_dns_records,
      receivingRecordsCount: data.receiving_dns_records?.length || 0,
      sendingRecordsCount: data.sending_dns_records?.length || 0
    })

    const result = {
      verified: data.domain?.state === 'active',
      state: data.domain?.state,
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
    return { verified: false, error: error.message, details: error.stack }
  }
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

    const environmentCheck = {
      MAILGUN_API_KEY: !!MAILGUN_API_KEY,
      BASE_DOMAIN: !!BASE_DOMAIN,
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_BASE_URL: !!WEBHOOK_BASE_URL,
      NAMECHEAP_API_KEY: !!Deno.env.get('NAMECHEAP_API_KEY'),
      NAMECHEAP_API_USER: !!Deno.env.get('NAMECHEAP_API_USER'),
      NAMECHEAP_USERNAME: !!Deno.env.get('NAMECHEAP_USERNAME'),
      NAMECHEAP_CLIENT_IP: !!Deno.env.get('NAMECHEAP_CLIENT_IP')
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

    // Validate database tables exist
    logger.step('Validating database schema')
    try {
      // Test if clinic table exists and has required columns
      const { error: clinicTestError } = await supabase
        .from('clinic')
        .select('id, slug, name')
        .limit(1)

      if (clinicTestError) {
        throw new Error(`Clinic table validation failed: ${clinicTestError.message}`)
      }

      // Test if mailgun_settings table exists (or can be created)
      const { error: settingsTestError } = await supabase
        .from('mailgun_settings')
        .select('id')
        .limit(1)

      // If table doesn't exist, log warning but continue (upsert will handle it)
      if (settingsTestError && !settingsTestError.message.includes('does not exist')) {
        logger.warn('Mailgun settings table validation warning', { error: settingsTestError.message })
      }

      logger.success('Database schema validation passed')
    } catch (schemaError) {
      logger.error('Database schema validation failed', schemaError)
      throw new Error(`Database schema validation failed: ${schemaError.message}`)
    }

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

// Setup action handler
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

  // Validate clinic slug format
  const slugValidation = validateClinicSlug(clinicSlug, setupLogger)
  if (!slugValidation.valid) {
    throw new Error(`Invalid clinic slug "${clinicSlug}": ${slugValidation.error}`)
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
  const mailgunStart = Date.now()
  
  const mailgunPayload = {
    name: subdomain,
    smtp_password: crypto.randomUUID(),
    spam_action: 'disabled',
    wildcard: 'false',
    force_dkim_authority: 'true'
  }

  setupLogger.debug('Mailgun API request details', {
    endpoint: 'https://api.mailgun.net/v3/domains',
    method: 'POST',
    payload: { ...mailgunPayload, smtp_password: '[REDACTED]' }
  })

  const mailgunResponse = await fetch('https://api.mailgun.net/v3/domains', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(mailgunPayload),
    signal: AbortSignal.timeout(30000) // 30 second timeout
  })

  setupLogger.performance('Mailgun domain creation API call', Date.now() - mailgunStart, {
    status: mailgunResponse.status,
    statusText: mailgunResponse.statusText,
    subdomain
  })

  let mailgunData = null
  const responseText = await mailgunResponse.text()

  if (!mailgunResponse.ok) {
    setupLogger.warn('Mailgun domain creation failed', {
      status: mailgunResponse.status,
      statusText: mailgunResponse.statusText,
      responsePreview: responseText.substring(0, 300),
      subdomain
    })
    
    // Check if domain already exists
    if (responseText.includes('already exists') || responseText.includes('Domain already exists') || mailgunResponse.status === 409) {
      setupLogger.info('♻️ Domain already exists in Mailgun, proceeding with existing domain')
    } else if (mailgunResponse.status === 401) {
      throw new Error(`Mailgun authentication failed. Please check your MAILGUN_API_KEY: ${responseText}`)
    } else if (mailgunResponse.status === 402) {
      throw new Error(`Mailgun payment required. Please verify your account and add payment method: ${responseText}`)
    } else if (mailgunResponse.status === 429) {
      throw new Error(`Mailgun rate limit exceeded. Please try again later: ${responseText}`)
    } else {
      throw new Error(`Mailgun domain creation failed (${mailgunResponse.status}): ${responseText}`)
    }
  } else {
    try {
      mailgunData = JSON.parse(responseText)
      setupLogger.success('Mailgun domain created successfully', {
        domain: mailgunData.domain?.name,
        state: mailgunData.domain?.state,
        receivingRecords: mailgunData.receiving_dns_records?.length || 0,
        sendingRecords: mailgunData.sending_dns_records?.length || 0
      })
    } catch (parseError) {
      setupLogger.warn('Could not parse Mailgun response as JSON', {
        responsePreview: responseText.substring(0, 200),
        parseError: parseError.message
      })
    }
  }

  // Step 2: Get domain verification status
  setupLogger.step('Checking domain verification status')
  const domainInfo = await checkDomainVerification(subdomain, mailgunApiKey, setupLogger)

  // Step 3: Get required DNS records
  setupLogger.step('Generating required DNS records')
  const requiredRecords = getRequiredDNSRecords(subdomain, setupLogger)

  // Step 4: Attempt automated DNS setup
  setupLogger.step('Attempting automated DNS setup')
  const dnsResult = await createNamecheapDNSRecords(baseDomain, subdomain, setupLogger)

  // Step 5: Set up email routing
  let routeCreated = false
  let routeInfo = null

  if (webhookBaseUrl) {
    setupLogger.step('Setting up email routing webhook')
    
    // Validate webhook URL format
    try {
      const webhookUrl = new URL(`${webhookBaseUrl}/webhooks/mailgun/${clinic.id}`)
      if (!webhookUrl.protocol.startsWith('https')) {
        setupLogger.warn('Webhook URL is not HTTPS, Mailgun may reject it', { webhookUrl: webhookUrl.toString() })
      }
    } catch (urlError) {
      setupLogger.error('Invalid webhook URL format', urlError, { webhookBaseUrl })
      throw new Error(`Invalid WEBHOOK_BASE_URL format: ${webhookBaseUrl}`)
    }

    const routeStart = Date.now()
    
    try {
      const routePayload = {
        priority: '1',
        description: `Route for ${subdomain} - ${clinic.name}`,
        expression: `match_recipient(".*@${subdomain}")`,
        action: `forward("${webhookBaseUrl}/webhooks/mailgun/${clinic.id}")`
      }

      setupLogger.debug('Creating email route', {
        webhookUrl: `${webhookBaseUrl}/webhooks/mailgun/${clinic.id}`,
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
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      setupLogger.performance('Email route creation', Date.now() - routeStart, {
        status: routeResponse.status,
        statusText: routeResponse.statusText
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
    updated_at: new Date().toISOString()
  }

  setupLogger.debug('Updating clinic record', {
    clinicId: clinic.id,
    updateData: clinicUpdateData
  })

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

  setupLogger.debug('Upserting mailgun_settings', { settingsData })

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
            'DNS records have been automatically configured',
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
          signal: AbortSignal.timeout(30000) // 30 second timeout
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