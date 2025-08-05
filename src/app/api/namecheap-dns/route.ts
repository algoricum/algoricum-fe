// app/api/namecheap-dns/route.ts
import { NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Helper function to get existing DNS records using proxy
async function getNamecheapDNSRecords(sld: string, tld: string, apiUser: string, apiKey: string, username: string, clientIp: string) {
  const url = new URL('https://api.namecheap.com/xml.response')
  const params = {
    ApiUser: apiUser,
    ApiKey: apiKey,
    UserName: username,
    ClientIp: clientIp,
    Command: 'namecheap.domains.dns.getHosts',
    SLD: sld,
    TLD: tld
  }

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  console.log('Fetching DNS records via proxy', { sld, tld })

  const fetchOptions: any = {
    method: 'GET',
    timeout: 30000
  }

  // Use Fixie proxy if available
  const proxyUrl = process.env.FIXIE_PROXY_URL
  if (proxyUrl) {
    console.log('Using Fixie proxy for Namecheap API')
    const agent = new HttpsProxyAgent(proxyUrl)
    fetchOptions.agent = agent
  }

  const response = await fetch(url.toString(), fetchOptions)

  if (!response.ok) {
    throw new Error(`Namecheap API error: ${response.status} ${response.statusText}`)
  }

  const responseText = await response.text()
  console.log('DNS records response received', { responseLength: responseText.length })

  // Check for API errors
  if (responseText.includes('<Errors>')) {
    const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
    const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
    const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
    throw new Error(`Namecheap API Error ${errorNumber}: ${errorText}`)
  }

  // Parse records
  const records: any[] = []
  const hostRegex = /<host[^>]*HostId="(\d+)"[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*Address="([^"]*)"[^>]*MXPref="([^"]*)"[^>]*TTL="([^"]*)"[^>]*\/>/g
  let match

  while ((match = hostRegex.exec(responseText)) !== null) {
    const [, hostId, name, type, address, mxPref, ttl] = match
    records.push({
      hostId,
      name: name || '@',
      type,
      address,
      mxPref: mxPref || '',
      ttl: ttl || '1800'
    })
  }

  console.log('Parsed existing DNS records', { count: records.length })
  return records
}

// Helper function to set DNS records using proxy
async function setNamecheapDNSRecords(sld: string, tld: string, records: any[], apiUser: string, apiKey: string, username: string, clientIp: string) {
  const url = new URL('https://api.namecheap.com/xml.response')
  const params: any = {
    ApiUser: apiUser,
    ApiKey: apiKey,
    UserName: username,
    ClientIp: clientIp,
    Command: 'namecheap.domains.dns.setHosts',
    SLD: sld,
    TLD: tld
  }

  // Add each record as parameters
  records.forEach((record, index) => {
    const recordNum = index + 1
    params[`HostName${recordNum}`] = record.name
    params[`RecordType${recordNum}`] = record.type
    params[`Address${recordNum}`] = record.address
    if (record.type === 'MX' && record.mxPref) {
      params[`MXPref${recordNum}`] = record.mxPref
    }
    params[`TTL${recordNum}`] = record.ttl
  })

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  console.log('Setting DNS records via proxy', { recordCount: records.length })

  const fetchOptions: any = {
    method: 'GET',
    timeout: 30000
  }

  // Use Fixie proxy if available
  const proxyUrl = process.env.FIXIE_PROXY_URL
  if (proxyUrl) {
    console.log('Using Fixie proxy for Namecheap API')

    const agent = new HttpsProxyAgent(proxyUrl)

    console.log('Using Fixie proxy for Namecheap API', agent)


    fetchOptions.agent = agent
  }

  const response = await fetch(url.toString(), fetchOptions)

  if (!response.ok) {
    throw new Error(`Namecheap API error: ${response.status} ${response.statusText}`)
  }

  const responseText = await response.text()

  // Check for API errors
  if (responseText.includes('<Errors>')) {
    const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
    const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
    const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
    throw new Error(`Namecheap DNS Update Error ${errorNumber}: ${errorText}`)
  }

  return responseText
}

// Main DNS setup function
async function createNamecheapDNSRecords(domain: string, subdomain: string) {
  const startTime = Date.now()

  const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER
  const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY
  const NAMECHEAP_USERNAME = process.env.NAMECHEAP_USERNAME
  const NAMECHEAP_CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP

  console.log('Starting DNS setup with proxy', {
    domain,
    subdomain,
    hasApiUser: !!NAMECHEAP_API_USER,
    hasApiKey: !!NAMECHEAP_API_KEY,
    hasUsername: !!NAMECHEAP_USERNAME,
    hasClientIp: !!NAMECHEAP_CLIENT_IP,
    hasProxy: !!process.env.FIXIE_PROXY_URL
  })

  if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || !NAMECHEAP_CLIENT_IP) {
    console.warn('Namecheap API credentials incomplete')
    return { 
      automated: false, 
      error: 'Missing Namecheap credentials',
      missing: {
        apiUser: !NAMECHEAP_API_USER,
        apiKey: !NAMECHEAP_API_KEY,
        username: !NAMECHEAP_USERNAME,
        clientIp: !NAMECHEAP_CLIENT_IP
      }
    }
  }

  try {
    // Parse domain parts
    const domainParts = domain.split('.')
    if (domainParts.length !== 2) {
      throw new Error(`Invalid domain format: ${domain}. Expected format: domain.com`)
    }
    
    const sld = domainParts[0]
    const tld = domainParts[1]
    const subdomainHost = subdomain.replace(`.${domain}`, '')
    
    console.log('Parsed domain components', { domain, sld, tld, subdomain, subdomainHost })

    // Step 1: Get existing DNS records
    console.log('Fetching existing DNS records')
    const existingRecords = await getNamecheapDNSRecords(sld, tld, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, NAMECHEAP_CLIENT_IP)
    
    // Step 2: Filter out existing MX records for this subdomain
    const preservedRecords = existingRecords.filter(record => 
      !(record.name === subdomainHost && record.type === 'MX')
    )

    console.log('DNS records analysis', {
      totalExisting: existingRecords.length,
      toPreserve: preservedRecords.length,
      toReplace: existingRecords.length - preservedRecords.length
    })

    // Step 3: Add new MX and TXT records
    const newRecords = [
      ...preservedRecords,
      {
        name: subdomainHost,
        type: 'MX',
        address: 'mxa.mailgun.org',
        mxPref: '10',
        ttl: '300'
      },
      {
        name: subdomainHost,
        type: 'MX', 
        address: 'mxb.mailgun.org',
        mxPref: '10',
        ttl: '300'
      },
      {
        name: subdomainHost,
        type: 'TXT',
        address: 'v=spf1 include:mailgun.org ~all',
        mxPref: '',
        ttl: '300'
      }
    ]

    // Step 4: Update DNS records
    console.log('Updating DNS records')
    const updateResult = await setNamecheapDNSRecords(sld, tld, newRecords, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, NAMECHEAP_CLIENT_IP)

    console.log('DNS records updated successfully', {
      domain,
      subdomain,
      recordsSet: 3,
      totalDuration: Date.now() - startTime
    })

    return { 
      automated: true, 
      records: updateResult,
      recordsCreated: [
        { host: subdomainHost, type: 'MX', address: 'mxa.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'MX', address: 'mxb.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'TXT', address: 'v=spf1 include:mailgun.org ~all' }
      ],
      existingRecordsPreserved: preservedRecords.length,
      duration: Date.now() - startTime
    }

  } catch (error: any) {
    console.error('Namecheap DNS creation failed', error)
    return { 
      automated: false, 
      error: error.message, 
      details: error.stack,
      duration: Date.now() - startTime
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, domain, subdomain } = body

    console.log('Namecheap DNS API called', { action, domain, subdomain })

    if (action === 'setup-dns') {
      const result = await createNamecheapDNSRecords(domain, subdomain)
      return NextResponse.json(result)
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Supported: setup-dns' 
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Namecheap DNS API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}