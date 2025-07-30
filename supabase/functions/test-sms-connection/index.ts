// supabase/functions/test-sms-connection/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SMSTestRequest {
  twilio_account_sid: string
  twilio_auth_token: string
  twilio_phone_number: string
  clinic_id: string
  test_phone_number?: string // Optional: phone number to send test SMS to
}

interface SMSTestResult {
  success: boolean
  message: string
  details?: {
    account_status: string
    phone_number_status: string
    test_message_sent: boolean
    balance_info?: any
    account_info?: any
    phone_number_info?: any
    response_time?: number
  }
  troubleshooting?: {
    issues: Array<{
      issue: string
      solutions: string[]
    }>
    tips: string[]
  }
  error?: string
}

// Utility function to make Twilio API calls
async function twilioRequest(
  accountSid: string,
  authToken: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${endpoint}`
  
  const headers = {
    'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  const options: RequestInit = {
    method,
    headers
  }

  if (body && method !== 'GET') {
    options.body = new URLSearchParams(body).toString()
  }

  const response = await fetch(url, options)
  const data = await response.json()

  return {
    success: response.ok,
    status: response.status,
    data,
    response
  }
}

// Validate phone number format (E.164)
function validatePhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phoneNumber)
}

// Main SMS test function
async function testSMSConnection(request: SMSTestRequest): Promise<SMSTestResult> {
  const startTime = Date.now()
  
  try {
    const { twilio_account_sid, twilio_auth_token, twilio_phone_number, test_phone_number } = request

    // Input validation
    if (!twilio_account_sid || !twilio_auth_token || !twilio_phone_number) {
      return {
        success: false,
        message: "Missing required Twilio credentials",
        error: "Account SID, Auth Token, and Phone Number are all required"
      }
    }

    // Validate Account SID format
    if (!twilio_account_sid.match(/^AC[a-z0-9]{32}$/i)) {
      return {
        success: false,
        message: "Invalid Twilio Account SID format",
        error: "Account SID must start with 'AC' followed by 32 characters"
      }
    }

    // Validate phone number format
    if (!validatePhoneNumber(twilio_phone_number)) {
      return {
        success: false,
        message: "Invalid phone number format",
        error: "Phone number must be in E.164 format (e.g., +1234567890)"
      }
    }

    let accountInfo: any = null
    let phoneNumberInfo: any = null
    let testMessageSent = false
    let balanceInfo: any = null

    // Test 1: Verify account credentials and get account info
    console.log("Testing account credentials...")
    const accountTest = await twilioRequest(
      twilio_account_sid,
      twilio_auth_token,
      '.json'
    )

    if (!accountTest.success) {
      return {
        success: false,
        message: "Twilio account authentication failed",
        error: accountTest.data.message || `HTTP ${accountTest.status}`,
        troubleshooting: {
          issues: [
            {
              issue: "Authentication failed",
              solutions: [
                "Verify your Account SID starts with 'AC'",
                "Regenerate your Auth Token in Twilio Console",
                "Check for extra spaces in credentials",
                "Ensure your Twilio account is active"
              ]
            }
          ],
          tips: [
            "Find credentials at console.twilio.com",
            "Auth Token is case-sensitive",
            "Make sure your account has sufficient balance"
          ]
        }
      }
    }

    accountInfo = accountTest.data
    console.log("Account authentication successful")

    // Test 2: Get account balance
    try {
      const balanceTest = await twilioRequest(
        twilio_account_sid,
        twilio_auth_token,
        '/Balance.json'
      )
      if (balanceTest.success) {
        balanceInfo = balanceTest.data
      }
    } catch (error) {
      console.log("Balance check failed (non-critical):", error)
    }

    // Test 3: Verify phone number ownership
    console.log("Verifying phone number ownership...")
    const phoneTest = await twilioRequest(
      twilio_account_sid,
      twilio_auth_token,
      `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(twilio_phone_number)}`
    )

    if (!phoneTest.success) {
      return {
        success: false,
        message: "Failed to verify phone number ownership",
        error: phoneTest.data.message || "Phone number verification failed",
        troubleshooting: {
          issues: [
            {
              issue: "Phone number not found in account",
              solutions: [
                "Purchase a phone number in Twilio Console",
                "Verify the phone number format (+1234567890)",
                "Check if number was released or transferred",
                "Ensure you're using the correct Account SID"
              ]
            }
          ],
          tips: [
            "Buy numbers at console.twilio.com/phone-numbers",
            "Phone numbers must include country code",
            "Some numbers may have restrictions"
          ]
        }
      }
    }

    const phoneNumbers = phoneTest.data.incoming_phone_numbers || []
    const ownedNumber = phoneNumbers.find((num: any) => num.phone_number === twilio_phone_number)

    if (!ownedNumber) {
      return {
        success: false,
        message: "Phone number not found in your Twilio account",
        error: `${twilio_phone_number} is not owned by account ${twilio_account_sid}`,
        troubleshooting: {
          issues: [
            {
              issue: "Phone number ownership mismatch",
              solutions: [
                "Verify you're using the correct phone number",
                "Check if the number was purchased for this account",
                "Ensure proper E.164 formatting (+country_code)",
                "Buy the number if not already owned"
              ]
            }
          ],
          tips: [
            "List your numbers at console.twilio.com/phone-numbers",
            "Phone numbers are account-specific",
            "Trial accounts have limitations"
          ]
        }
      }
    }

    phoneNumberInfo = ownedNumber
    console.log("Phone number ownership verified")

    // Test 4: Send test SMS (optional - only if test number provided)
    if (test_phone_number && validatePhoneNumber(test_phone_number)) {
      console.log("Sending test SMS...")
      try {
        const testMessage = await twilioRequest(
          twilio_account_sid,
          twilio_auth_token,
          '/Messages.json',
          'POST',
          {
            From: twilio_phone_number,
            To: test_phone_number,
            Body: `Test message from your clinic chatbot! 🏥 SMS is working correctly. Time: ${new Date().toLocaleString()}`
          }
        )

        if (testMessage.success) {
          testMessageSent = true
          console.log("Test SMS sent successfully")
        } else {
          console.log("Test SMS failed:", testMessage.data)
        }
      } catch (error) {
        console.log("Test SMS error (non-critical):", error)
      }
    }

    const responseTime = Date.now() - startTime

    // Success response
    return {
      success: true,
      message: testMessageSent 
        ? "🎉 SMS configuration test successful! Test message sent."
        : "🎉 SMS configuration test successful! All credentials verified.",
      details: {
        account_status: accountInfo.status || 'active',
        phone_number_status: phoneNumberInfo.status || 'active',
        test_message_sent: testMessageSent,
        balance_info: balanceInfo ? {
          balance: balanceInfo.balance,
          currency: balanceInfo.currency
        } : null,
        account_info: {
          friendly_name: accountInfo.friendly_name,
          status: accountInfo.status,
          type: accountInfo.type
        },
        phone_number_info: {
          phone_number: phoneNumberInfo.phone_number,
          friendly_name: phoneNumberInfo.friendly_name,
          capabilities: phoneNumberInfo.capabilities
        },
        response_time: responseTime
      },
      troubleshooting: {
        issues: [],
        tips: [
          "SMS is ready for your clinic chatbot",
          "Configure webhooks for incoming messages",
          "Monitor usage in Twilio Console",
          "Consider setting up auto-replies"
        ]
      }
    }

  } catch (error: any) {
    console.error("SMS test error:", error)
    
    return {
      success: false,
      message: "SMS connection test failed",
      error: error.message || "Unknown error occurred",
      troubleshooting: {
        issues: [
          {
            issue: "Connection or API error",
            solutions: [
              "Check your internet connection",
              "Verify Twilio service status",
              "Try again in a few minutes",
              "Contact Twilio support if persistent"
            ]
          }
        ],
        tips: [
          "Check status.twilio.com for service issues",
          "Ensure your firewall allows HTTPS requests",
          "Verify your server can reach api.twilio.com"
        ]
      }
    }
  }
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const requestData: SMSTestRequest = await req.json()
    
    // Validate required fields
    if (!requestData.twilio_account_sid || !requestData.twilio_auth_token || 
        !requestData.twilio_phone_number || !requestData.clinic_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: twilio_account_sid, twilio_auth_token, twilio_phone_number, clinic_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Testing SMS configuration for clinic: ${requestData.clinic_id}`)

    // Run SMS test
    const result = await testSMSConnection(requestData)

    // Log result for debugging
    console.log('SMS test result:', {
      success: result.success,
      message: result.message,
      clinic_id: requestData.clinic_id
    })

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('SMS test function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})