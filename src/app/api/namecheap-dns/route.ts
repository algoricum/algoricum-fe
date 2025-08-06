// app/api/namecheap-dns/route.ts
import { NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Use fetch with proxy support (keeping your existing approach)
async function fetchWithProxy(url: string, options: any = {}) {
  const proxyUrl = process.env.FIXIE_PROXY_URL
  
  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl)
    return fetch(url, {
      ...options,
      agent
    })
  } else {
    return fetch(url, options)
  }
}

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

  console.log('Fetching DNS records via proxy', { sld, tld, url: url.toString() })

  try {
    const response = await fetchWithProxy(url.toString(), {
      method: 'GET'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Namecheap API HTTP Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Namecheap API HTTP error: ${response.status} ${response.statusText}`)
    }

    const responseText = await response.text()
    console.log('DNS records response received', { 
      responseLength: responseText.length,
      preview: responseText.substring(0, 200)
    })

    // Check for API errors in XML response
    if (responseText.includes('<Errors>')) {
      const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
      const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
      const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
      console.error('Namecheap API Error in Response:', { errorNumber, errorText, fullResponse: responseText })
      throw new Error(`Namecheap API Error ${errorNumber}: ${errorText}`)
    }

    // Check if response is successful
    if (!responseText.includes('<ApiResponse Status="OK"')) {
      console.error('Unexpected API response format:', responseText.substring(0, 500))
      throw new Error('Namecheap API returned unexpected response format')
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

    console.log('Parsed existing DNS records', { count: records.length, records })
    return records

  } catch (error: any) {
    console.error('Error fetching DNS records:', error)
    throw error
  }
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

  console.log('Setting DNS records via proxy', { 
    recordCount: records.length, 
    url: url.toString().replace(apiKey, '***'),  // Hide API key in logs
    records: records.map(r => ({ name: r.name, type: r.type, address: r.address }))
  })

  try {
    const response = await fetchWithProxy(url.toString(), {
      method: 'GET'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Namecheap setHosts HTTP Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Namecheap API HTTP error: ${response.status} ${response.statusText}`)
    }

    const responseText = await response.text()
    console.log('DNS records set response:', { 
      responseLength: responseText.length,
      preview: responseText.substring(0, 200)
    })

    // Check for API errors in XML response
    if (responseText.includes('<Errors>')) {
      const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</)
      const errorNumber = errorMatch ? errorMatch[1] : 'Unknown'
      const errorText = errorMatch ? errorMatch[2] : 'Unknown error'
      console.error('Namecheap setHosts API Error:', { errorNumber, errorText, fullResponse: responseText })
      throw new Error(`Namecheap DNS Update Error ${errorNumber}: ${errorText}`)
    }

    // Check if response is successful
    if (!responseText.includes('<ApiResponse Status="OK"')) {
      console.error('setHosts unexpected response format:', responseText.substring(0, 500))
      throw new Error('Namecheap setHosts API returned unexpected response format')
    }

    return responseText

  } catch (error: any) {
    console.error('Error setting DNS records:', error)
    throw error
  }
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
    hasProxy: !!process.env.FIXIE_PROXY_URL,
    clientIp: NAMECHEAP_CLIENT_IP
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
    
    // Step 2: Filter out existing records for this subdomain (MX, TXT, CNAME)
    const preservedRecords = existingRecords.filter(record => 
      !(
        // Remove existing MX and TXT records for the subdomain
        (record.name === subdomainHost && (record.type === 'MX' || record.type === 'TXT')) ||
        // Remove existing CNAME record for email tracking
        (record.name === `email.${subdomainHost}` && record.type === 'CNAME') ||
        // Remove existing DKIM TXT record
        (record.name === `pic._domainkey.${subdomainHost}` && record.type === 'TXT')
      )
    )

    console.log('DNS records analysis', {
      totalExisting: existingRecords.length,
      toPreserve: preservedRecords.length,
      toReplace: existingRecords.length - preservedRecords.length
    })

    // Step 3: Add new MX, TXT, and CNAME records for Mailgun
    const newRecords = [
      ...preservedRecords,
      // MX Records for receiving mail
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
      // SPF TXT Record
      {
        name: subdomainHost,
        type: 'TXT',
        address: 'v=spf1 include:mailgun.org ~all',
        mxPref: '',
        ttl: '300'
      },
      // CNAME Record for tracking opens/clicks/unsubscribes
      {
        name: `email.${subdomainHost}`,
        type: 'CNAME',
        address: 'mailgun.org',
        mxPref: '',
        ttl: '300'
      },
      // DKIM TXT Record for email authentication
      {
        name: `pic._domainkey.${subdomainHost}`,
        type: 'TXT',
        address: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDidgr20Tb07ylWT8uHIKczUo5ZH8YPGzSuux7qYmH26YIV+Evhva/zT8KL/K5fmflvWM5Sko9gjNBHZaV9oH5dNBsblmHbvuvZwNgDdNFJ+tXVBIqTITvnleBpgvxr0bO227zB7vvck/gmzHjCiGKMlmWtUpWnYY9FMROKhIOsHwIDAQAB',
        mxPref: '',
        ttl: '300'
      }
    ]

    // Log record details for debugging
    console.log('Records to be set:', newRecords.map(r => ({
      name: r.name,
      type: r.type,
      address: r.address.length > 50 ? `${r.address.substring(0, 50)}...` : r.address
    })))

    // Validate records count (Namecheap has limits)
    if (newRecords.length > 100) {
      throw new Error(`Too many DNS records (${newRecords.length}). Namecheap limit is 100 records per domain.`)
    }

    // Step 4: Update DNS records
    console.log('Updating DNS records', {
      totalRecords: newRecords.length,
      newMailgunRecords: [
        `${subdomainHost} MX mxa.mailgun.org`,
        `${subdomainHost} MX mxb.mailgun.org`, 
        `${subdomainHost} TXT SPF`,
        `email.${subdomainHost} CNAME mailgun.org`,
        `pic._domainkey.${subdomainHost} TXT DKIM`
      ]
    })
    const updateResult = await setNamecheapDNSRecords(sld, tld, newRecords, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, NAMECHEAP_CLIENT_IP)

    console.log('DNS records updated successfully', {
      domain,
      subdomain,
      recordsSet: 5, // 2 MX + 1 SPF TXT + 1 CNAME + 1 DKIM TXT
      totalDuration: Date.now() - startTime
    })

    return { 
      automated: true, 
      records: updateResult,
      recordsCreated: [
        { host: subdomainHost, type: 'MX', address: 'mxa.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'MX', address: 'mxb.mailgun.org', priority: 10 },
        { host: subdomainHost, type: 'TXT', address: 'v=spf1 include:mailgun.org ~all', note: 'SPF Record' },
        { host: `email.${subdomainHost}`, type: 'CNAME', address: 'mailgun.org', note: 'Tracking Record' },
        { host: `pic._domainkey.${subdomainHost}`, type: 'TXT', address: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDidgr20Tb07ylWT8uHIKczUo5ZH8YPGzSuux7qYmH26YIV+Evhva/zT8KL/K5fmflvWM5Sko9gjNBHZaV9oH5dNBsblmHbvuvZwNgDdNFJ+tXVBIqTITvnleBpgvxr0bO227zB7vvck/gmzHjCiGKMlmWtUpWnYY9FMROKhIOsHwIDAQAB', note: 'DKIM Record' }
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