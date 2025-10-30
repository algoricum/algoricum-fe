// app/api/namecheap-dns/route.ts
import { HttpsProxyAgent } from "https-proxy-agent";
import { NextResponse } from "next/server";

// Type definitions
interface MailgunDnsRecord {
  is_active: boolean;
  cached: any[];
  name: string;
  record_type: string;
  valid: string;
  value: string;
  priority?: string;
}

interface MailgunDnsRecords {
  sending_dns_records: MailgunDnsRecord[];
  receiving_dns_records?: MailgunDnsRecord[];
}

// Use fetch with proxy support (Fixed for Vercel/Node.js)
async function fetchWithProxy(url: string, options: any = {}) {
  const proxyUrl = process.env.FIXIE_PROXY_URL;

  if (proxyUrl) {
    try {
      // Option 1: Try undici first (best for Node.js 18+)
      const { request } = await import("undici");
      const { ProxyAgent } = await import("undici");

      const dispatcher = new ProxyAgent(proxyUrl);

      const response = await request(url, {
        ...options,
        dispatcher,
      });

      // Convert undici response to fetch-like response
      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        statusText: response.headers["status-text"] || "",
        text: async () => {
          const chunks = [];
          for await (const chunk of response.body) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks).toString();
        },
        headers: {
          get: (name: string) => response.headers[name.toLowerCase()],
        },
      };
    } catch (undiciError: any) {
      console.warn("Undici proxy failed, trying node-fetch:", undiciError.message);

      // Option 2: Fallback to node-fetch
      try {
        const fetch = (await import("node-fetch")).default;
        const agent = new HttpsProxyAgent(proxyUrl);

        return fetch(url, {
          ...options,
          agent,
        });
      } catch (nodeFetchError: any) {
        console.warn("node-fetch proxy failed, using axios:", nodeFetchError.message);

        // Option 3: Fallback to axios with proxy
        const axios = (await import("axios")).default;
        const proxyConfig = new URL(proxyUrl);

        const axiosResponse = await axios({
          url,
          method: options.method || "GET",
          proxy: {
            protocol: proxyConfig.protocol.replace(":", ""),
            host: proxyConfig.hostname,
            port: parseInt(proxyConfig.port),
            auth:
              proxyConfig.username && proxyConfig.password
                ? {
                    username: proxyConfig.username,
                    password: proxyConfig.password,
                  }
                : undefined,
          },
          timeout: 30000,
        });

        // Convert axios response to fetch-like
        return {
          ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          text: async () => axiosResponse.data,
          headers: {
            get: (name: string) => axiosResponse.headers[name.toLowerCase()],
          },
        };
      }
    }
  } else {
    // No proxy configured, use regular fetch
    return fetch(url, options);
  }
}

// Helper function to get existing DNS records using proxy
async function getNamecheapDNSRecords(sld: string, tld: string, apiUser: string, apiKey: string, username: string, clientIp: string) {
  const url = new URL("https://api.namecheap.com/xml.response");
  const params = {
    ApiUser: apiUser,
    ApiKey: apiKey,
    UserName: username,
    ClientIp: clientIp,
    Command: "namecheap.domains.dns.getHosts",
    SLD: sld,
    TLD: tld,
  };

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetchWithProxy(url.toString(), {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Namecheap API HTTP Error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Namecheap API HTTP error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();

    // Check for API errors in XML response
    if (responseText.includes("<Errors>")) {
      const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</);
      const errorNumber = errorMatch ? errorMatch[1] : "Unknown";
      const errorText = errorMatch ? errorMatch[2] : "Unknown error";
      console.error("Namecheap API Error in Response:", { errorNumber, errorText, fullResponse: responseText });
      throw new Error(`Namecheap API Error ${errorNumber}: ${errorText}`);
    }

    // Check if response is successful
    if (!responseText.includes('<ApiResponse Status="OK"')) {
      console.error("Unexpected API response format:", responseText.substring(0, 500));
      throw new Error("Namecheap API returned unexpected response format");
    }

    // Parse records
    const records: any[] = [];
    const hostRegex =
      /<host[^>]*HostId="(\d+)"[^>]*Name="([^"]*)"[^>]*Type="([^"]*)"[^>]*Address="([^"]*)"[^>]*MXPref="([^"]*)"[^>]*TTL="([^"]*)"[^>]*\/>/g;
    let match;

    while ((match = hostRegex.exec(responseText)) !== null) {
      const [, hostId, name, type, address, mxPref, ttl] = match;
      records.push({
        hostId,
        name: name || "@",
        type,
        address,
        mxPref: mxPref || "",
        ttl: ttl || "1800",
      });
    }

    return records;
  } catch (error: any) {
    console.error("Error fetching DNS records:", error);
    throw error;
  }
}

// Helper function to set DNS records using proxy
async function setNamecheapDNSRecords(
  sld: string,
  tld: string,
  records: any[],
  apiUser: string,
  apiKey: string,
  username: string,
  clientIp: string,
) {
  const url = new URL("https://api.namecheap.com/xml.response");
  const params: any = {
    ApiUser: apiUser,
    ApiKey: apiKey,
    UserName: username,
    ClientIp: clientIp,
    Command: "namecheap.domains.dns.setHosts",
    SLD: sld,
    TLD: tld,
  };

  // Add each record as parameters
  records.forEach((record, index) => {
    const recordNum = index + 1;
    params[`HostName${recordNum}`] = record.name;
    params[`RecordType${recordNum}`] = record.type;
    params[`Address${recordNum}`] = record.address;
    if (record.type === "MX" && record.mxPref) {
      params[`MXPref${recordNum}`] = record.mxPref;
    }
    params[`TTL${recordNum}`] = record.ttl;
  });

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  try {
    const response = await fetchWithProxy(url.toString(), {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Namecheap setHosts HTTP Error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Namecheap API HTTP error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();

    // Check for API errors in XML response
    if (responseText.includes("<Errors>")) {
      const errorMatch = responseText.match(/<Error Number="(\d+)"[^>]*>([^<]+)</);
      const errorNumber = errorMatch ? errorMatch[1] : "Unknown";
      const errorText = errorMatch ? errorMatch[2] : "Unknown error";
      console.error("Namecheap setHosts API Error:", { errorNumber, errorText, fullResponse: responseText });
      throw new Error(`Namecheap DNS Update Error ${errorNumber}: ${errorText}`);
    }

    // Check if response is successful
    if (!responseText.includes('<ApiResponse Status="OK"')) {
      console.error("setHosts unexpected response format:", responseText.substring(0, 500));
      throw new Error("Namecheap setHosts API returned unexpected response format");
    }

    return responseText;
  } catch (error: any) {
    console.error("Error setting DNS records:", error);
    throw error;
  }
}

// Helper function to fetch DMARC record from Mailgun or create default
async function getDmarcRecord(domain: string, subdomain: string, mailgunDnsRecords: MailgunDnsRecords) {
  // Check if DMARC record exists in Mailgun DNS records
  const allRecords = [...(mailgunDnsRecords.sending_dns_records || []), ...(mailgunDnsRecords.receiving_dns_records || [])];

  const existingDmarc = allRecords.find(record => record.record_type === "TXT" && record.name.includes("_dmarc"));

  if (existingDmarc) {
    // Clean up the host name (remove domain if present)
    let dmarcHost = existingDmarc.name;
    if (dmarcHost.includes(domain)) {
      dmarcHost = dmarcHost.replace(`.${domain}`, "");
    }

    return {
      name: dmarcHost,
      type: "TXT",
      address: existingDmarc.value,
      mxPref: "",
      ttl: "300",
      source: "mailgun",
    };
  }

  // Extract subdomain host for DMARC
  const subdomainHost = subdomain.replace(`.${domain}`, "");

  // Create a basic DMARC policy
  // p=quarantine: quarantine emails that fail authentication
  // rua= for aggregate reports (optional - you can modify this)
  // ruf= for forensic reports (optional - you can modify this)
  // pct=100: apply policy to 100% of emails
  const dmarcValue = `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${subdomain}; ruf=mailto:dmarc-failures@${subdomain}; pct=100; adkim=s; aspf=s;`;

  return {
    name: `_dmarc.${subdomainHost}`,
    type: "TXT",
    address: dmarcValue,
    mxPref: "",
    ttl: "300",
    source: "generated",
  };
}

// Helper function to execute Namecheap API calls with IP fallback
async function executeWithIpFallback<T>(operation: (_clientIp: string) => Promise<T>, operationName: string): Promise<T> {
  const ip1 = process.env.NAMECHEAP_CLIENT_IP1;
  const ip2 = process.env.NAMECHEAP_CLIENT_IP2;

  // Try with first IP
  if (ip1) {
    try {
      return await operation(ip1);
    } catch (error: any) {
      // Check if it's an IP mismatch error
      if (error.message.includes("Invalid request IP") && ip2) {
        try {
          return await operation(ip2);
        } catch (ip2Error: any) {
          console.error(`${operationName}: Both IPs failed. IP1 error: ${error.message}, IP2 error: ${ip2Error.message}`);
          throw ip2Error;
        }
      } else {
        // Non-IP related error, don't retry
        throw error;
      }
    }
  } else if (ip2) {
    // Only IP2 available
    return await operation(ip2);
  } else {
    throw new Error("No Namecheap Client IPs configured");
  }
}

// Main DNS setup function - handles dynamic DKIM records from Mailgun + DMARC
async function createNamecheapDNSRecords(domain: string, subdomain: string, mailgunDnsRecords: MailgunDnsRecords) {
  const startTime = Date.now();

  const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER;
  const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY;
  const NAMECHEAP_USERNAME = process.env.NAMECHEAP_USERNAME;
  const NAMECHEAP_CLIENT_IP1 = process.env.NAMECHEAP_CLIENT_IP1;
  const NAMECHEAP_CLIENT_IP2 = process.env.NAMECHEAP_CLIENT_IP2;

  if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || (!NAMECHEAP_CLIENT_IP1 && !NAMECHEAP_CLIENT_IP2)) {
    console.warn("Namecheap API credentials incomplete");
    return {
      automated: false,
      error: "Missing Namecheap credentials",
      missing: {
        apiUser: !NAMECHEAP_API_USER,
        apiKey: !NAMECHEAP_API_KEY,
        username: !NAMECHEAP_USERNAME,
        clientIp: !NAMECHEAP_CLIENT_IP1 && !NAMECHEAP_CLIENT_IP2,
      },
    };
  }

  try {
    // Parse domain parts
    const domainParts = domain.split(".");
    if (domainParts.length !== 2) {
      throw new Error(`Invalid domain format: ${domain}. Expected format: domain.com`);
    }

    const sld = domainParts[0];
    const tld = domainParts[1];
    const subdomainHost = subdomain.replace(`.${domain}`, "");

    // Extract DKIM records from Mailgun DNS records (handling ANY selector: mx, pic, mailo, etc.)
    const dkimRecords =
      mailgunDnsRecords.sending_dns_records?.filter(
        (record: MailgunDnsRecord) => record.record_type === "TXT" && record.name.includes("_domainkey"),
      ) || [];

    if (dkimRecords.length === 0) {
      console.warn("No DKIM records found in Mailgun DNS data!");
    } else {
      console.log(`Successfully found ${dkimRecords.length} DKIM record(s) - will add them all to DNS`);
    }

    // Get DMARC record
    const dmarcRecord = await getDmarcRecord(domain, subdomain, mailgunDnsRecords);

    // Step 1: Get existing DNS records with IP fallback
    const existingRecords = await executeWithIpFallback(
      clientIp => getNamecheapDNSRecords(sld, tld, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, clientIp),
      "getNamecheapDNSRecords",
    );

    // Step 2: Filter out existing records for this subdomain (MX, TXT, CNAME)
    const preservedRecords = existingRecords.filter(record => {
      // Remove existing MX and SPF TXT records for the subdomain
      if (record.name === subdomainHost && (record.type === "MX" || record.type === "TXT")) {
        return false;
      }

      // Remove existing CNAME record for email tracking
      if (record.name === `email.${subdomainHost}` && record.type === "CNAME") {
        return false;
      }

      // Remove any existing DKIM TXT records (any selector: mx, pic, etc.)
      if (record.type === "TXT" && record.name.includes("_domainkey") && record.name.includes(subdomainHost)) {
        return false;
      }

      // Remove existing DMARC record for this subdomain
      if (record.type === "TXT" && record.name === dmarcRecord.name) {
        return false;
      }

      return true;
    });

    // Step 3: Build new DNS records
    const newRecords = [
      ...preservedRecords,
      // MX Records for receiving mail
      {
        name: subdomainHost,
        type: "MX",
        address: "mxa.mailgun.org",
        mxPref: "10",
        ttl: "300",
      },
      {
        name: subdomainHost,
        type: "MX",
        address: "mxb.mailgun.org",
        mxPref: "10",
        ttl: "300",
      },
      // SPF TXT Record
      {
        name: subdomainHost,
        type: "TXT",
        address: "v=spf1 include:mailgun.org ~all",
        mxPref: "",
        ttl: "300",
      },
      // DMARC TXT Record
      dmarcRecord,
      // CNAME Record for tracking opens/clicks/unsubscribes
      {
        name: `email.${subdomainHost}`,
        type: "CNAME",
        address: "mailgun.org",
        mxPref: "",
        ttl: "300",
      },
    ];

    // Add all DKIM TXT Records (handles mx._domainkey, pic._domainkey, mailo._domainkey, etc.)
    dkimRecords.forEach((dkimRecord: MailgunDnsRecord) => {
      let dkimHost = dkimRecord.name;
      // Remove ".msgdesk.co" from the host
      dkimHost = dkimHost.replace(".msgdesk.co", "");

      newRecords.push({
        name: dkimHost,
        type: "TXT",
        address: dkimRecord.value,
        mxPref: "",
        ttl: "300",
      });
    });

    // Validate records count (Namecheap has limits)
    if (newRecords.length > 100) {
      throw new Error(`Too many DNS records (${newRecords.length}). Namecheap limit is 100 records per domain.`);
    }

    // Step 4: Update DNS records
    const mailgunRecordsSummary = [
      `${subdomainHost} MX mxa.mailgun.org`,
      `${subdomainHost} MX mxb.mailgun.org`,
      `${subdomainHost} TXT SPF`,
      `${dmarcRecord.name} TXT DMARC`,
      `email.${subdomainHost} CNAME mailgun.org`,
      ...dkimRecords.map((r: MailgunDnsRecord) => `${r.name.replace(`.${subdomain}`, "")} TXT DKIM`),
    ];

    console.log("Updating DNS records", {
      totalRecords: newRecords.length,
      newMailgunRecords: mailgunRecordsSummary,
    });

    const updateResult = await executeWithIpFallback(
      clientIp => setNamecheapDNSRecords(sld, tld, newRecords, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, clientIp),
      "setNamecheapDNSRecords",
    );

    // Build response with all created records
    const recordsCreated = [
      { host: subdomainHost, type: "MX", address: "mxa.mailgun.org", priority: 10 },
      { host: subdomainHost, type: "MX", address: "mxb.mailgun.org", priority: 10 },
      { host: subdomainHost, type: "TXT", address: "v=spf1 include:mailgun.org ~all", note: "SPF Record" },
      {
        host: dmarcRecord.name,
        type: "TXT",
        address: dmarcRecord.address,
        note: `DMARC Record (${dmarcRecord.source})`,
      },
      { host: `email.${subdomainHost}`, type: "CNAME", address: "mailgun.org", note: "Tracking Record" },
      ...dkimRecords.map((dkim: MailgunDnsRecord) => ({
        host: dkim.name,
        type: "TXT",
        address: dkim.value,
        note: "DKIM Record",
      })),
    ];

    return {
      automated: true,
      records: updateResult,
      recordsCreated,
      existingRecordsPreserved: preservedRecords.length,
      dkimRecordsAdded: dkimRecords.length,
      dmarcRecord: {
        added: true,
        source: dmarcRecord.source,
        value: dmarcRecord.address,
      },
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error("Namecheap DNS creation failed", error);
    return {
      automated: false,
      error: error.message,
      details: error.stack,
      duration: Date.now() - startTime,
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, domain, subdomain, mailgunDnsRecords } = body;

    if (action === "setup-dns") {
      if (!mailgunDnsRecords || !mailgunDnsRecords.sending_dns_records) {
        return NextResponse.json(
          {
            error: "Missing Mailgun DNS records information",
            expectedFormat: {
              mailgunDnsRecords: {
                sending_dns_records: [{ record_type: "TXT", name: "mx._domainkey.domain.com", value: "k=rsa; p=..." }],
                receiving_dns_records: [{ record_type: "TXT", name: "_dmarc.domain.com", value: "v=DMARC1; p=quarantine; ..." }],
              },
            },
          },
          { status: 400 },
        );
      }

      const result = await createNamecheapDNSRecords(domain, subdomain, mailgunDnsRecords);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        {
          error: "Invalid action. Supported: setup-dns",
        },
        { status: 400 },
      );
    }
  } catch (error: any) {
    console.error("Namecheap DNS API error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
