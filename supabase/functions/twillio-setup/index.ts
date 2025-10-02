import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = deno.env.get("SUPABASE_URL");

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Log request initiation
    console.log("Starting twilio-setup edge function", {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers),
    });

    // Initialize Supabase client
    console.log("Initializing Supabase client", {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ? "set" : "not set",
      anonKey: Deno.env.get("SUPABASE_ANON_KEY") ? "set" : "not set",
    });
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    // Get and log request data
    const { clinic_id, phone_number, name, twilio_config_id } = await req.json();
    console.log("Received request payload", {
      clinic_id,
      phone_number,
      name,
      twilio_config_id,
    });

    if (!clinic_id || !phone_number || !name) {
      console.log("Validation failed: Missing required fields", {
        clinic_id: !!clinic_id,
        phone_number: !!phone_number,
        name: !!name,
      });
      return new Response(JSON.stringify({ error: "clinic_id, phone_number, and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if clinic already has an active Twilio configuration
    console.log("Checking for existing twilio_config record", { clinic_id, phone_number });
    const { data: existingRecord } = await supabaseClient
      .from("twilio_config")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("phone_number", phone_number)
      .neq("status", "failed") // Allow retry if status is failed
      .single();

    if (existingRecord && existingRecord.status === "active") {
      console.log("Existing active Twilio configuration found", {
        clinic_id,
        phone_number,
        twilio_phone_number: existingRecord.twilio_phone_number,
        status: existingRecord.status,
      });
      return new Response(
        JSON.stringify({
          error: "Clinic already has an active phone number assigned",
          existing_number: existingRecord.twilio_phone_number,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.log("No active twilio_config record found or status is failed, proceeding", {
      existingRecord: existingRecord ? { id: existingRecord.id, status: existingRecord.status } : null,
    });

    // Twilio credentials from environment
    console.log("Checking Twilio credentials");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    // A2P Messaging Service SID (OPTIONAL - for automatic A2P registration)
    // Set this to automatically register phone numbers with your A2P messaging service
    const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    // SMS Processor webhook URL with clinic_id parameter - Update this to your actual Supabase project URL
    const smsWebhookUrl = `${supabaseUrl}/functions/v1/sms-processor?clinic_id=${clinic_id}`;

    console.log("Twilio environment variables", {
      twilioAccountSid: twilioAccountSid ? "set" : "not set",
      twilioAuthToken: twilioAuthToken ? "set" : "not set",
      twilioMessagingServiceSid: twilioMessagingServiceSid ? "set" : "not set",
      smsWebhookUrl,
    });

    if (!twilioAccountSid || !twilioAuthToken) {
      console.log("Twilio credentials missing, updating twilio_config to failed if exists", { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create basic auth header for Twilio
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    console.log("Twilio auth header created");

    // Step 1: Search for available numbers in both US and Canada
    const countries = ["US", "CA"];
    const allAvailableNumbers = [];

    // Extract area code from phone_number if provided
    const areaCodeMatch = phone_number.match(/^\+1(\d{3})/);
    const areaCode = areaCodeMatch ? areaCodeMatch[1] : null;

    if (areaCode) {
      console.log("Area code extracted from phone_number", { areaCode });
    } else {
      console.log("No area code provided in phone_number, proceeding without area code filter");
    }

    // Search in both countries
    for (const country of countries) {
      let searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country}/Local.json?SmsEnabled=true&Limit=10`;

      if (areaCode) {
        searchUrl += `&AreaCode=${areaCode}`;
      }

      console.log(`Searching for available Twilio numbers in ${country}`, { searchUrl });

      try {
        const searchResponse = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const searchData = await searchResponse.json();
        console.log(`Twilio number search response for ${country}`, {
          status: searchResponse.status,
          ok: searchResponse.ok,
          availableNumbersCount: searchData.available_phone_numbers?.length || 0,
        });

        if (searchData.available_phone_numbers && searchData.available_phone_numbers.length > 0) {
          // Add country info to each number for tracking
          const numbersWithCountry = searchData.available_phone_numbers.map(num => ({
            ...num,
            country: country,
          }));
          allAvailableNumbers.push(...numbersWithCountry);
          console.log(`Added ${numbersWithCountry.length} numbers from ${country}`);
        }
      } catch (error) {
        console.log(`Error searching ${country} numbers:`, error.message);
        // Continue with other countries if one fails
      }
    }

    console.log("Total available numbers found", {
      total: allAvailableNumbers.length,
      byCountry: countries.map(country => ({
        country,
        count: allAvailableNumbers.filter(num => num.country === country).length,
      })),
    });

    if (allAvailableNumbers.length === 0) {
      console.log("No available phone numbers found in any country, updating twilio_config to failed if exists", { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(JSON.stringify({ error: "No available phone numbers found in US or Canada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prioritize numbers: if area code provided, prefer numbers from same area code
    let selectedNumber;
    if (areaCode) {
      // Try to find a number matching the area code first
      const matchingAreaCode = allAvailableNumbers.find(num => num.phone_number.includes(areaCode));
      selectedNumber = matchingAreaCode || allAvailableNumbers[0];
    } else {
      selectedNumber = allAvailableNumbers[0];
    }

    console.log("Selected Twilio phone number", {
      selectedNumber: selectedNumber.phone_number,
      country: selectedNumber.country,
      matchedAreaCode: areaCode && selectedNumber.phone_number.includes(areaCode),
    });

    // Step 2: Purchase the number with SMS processor webhook (including clinic_id)
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
    const purchaseBody = new URLSearchParams({
      PhoneNumber: selectedNumber.phone_number,
      SmsUrl: smsWebhookUrl, // Now includes clinic_id parameter
      SmsMethod: "POST",
      // Optional: Add status callback URL for delivery receipts (also with clinic_id)
      SmsStatusCallback: `${supabaseUrl}/functions/v1/sms-processor/status?clinic_id=${clinic_id}`,
    });
    console.log("Purchasing Twilio phone number", {
      purchaseUrl,
      phoneNumber: selectedNumber.phone_number,
      smsUrl: smsWebhookUrl,
    });

    const purchaseResponse = await fetch(purchaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: purchaseBody,
    });

    const purchaseData = await purchaseResponse.json();
    console.log("Twilio purchase response", {
      status: purchaseResponse.status,
      ok: purchaseResponse.ok,
      phone_number: purchaseData.phone_number,
      sid: purchaseData.sid,
      sms_url: purchaseData.sms_url, // Log to verify webhook was set correctly
    });

    if (!purchaseResponse.ok) {
      console.log("Failed to purchase phone number, updating twilio_config to failed if exists", {
        twilio_config_id,
        errorDetails: purchaseData,
      });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(
        JSON.stringify({
          error: "Failed to purchase phone number",
          details: purchaseData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Step 2.5: Register phone number with A2P messaging service if messaging service SID is provided
    let messagingServiceRegistrationSuccess = true;
    if (twilioMessagingServiceSid) {
      console.log("Registering phone number with A2P messaging service", {
        phoneNumber: purchaseData.phone_number,
        messagingServiceSid: twilioMessagingServiceSid,
      });

      const messagingServiceUrl = `https://messaging.twilio.com/v1/Services/${twilioMessagingServiceSid}/PhoneNumbers`;
      const messagingServiceBody = new URLSearchParams({
        PhoneNumberSid: purchaseData.sid,
      });

      try {
        const messagingServiceResponse = await fetch(messagingServiceUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: messagingServiceBody,
        });

        const messagingServiceData = await messagingServiceResponse.json();
        console.log("Messaging service registration response", {
          status: messagingServiceResponse.status,
          ok: messagingServiceResponse.ok,
          data: messagingServiceData,
        });

        if (!messagingServiceResponse.ok) {
          console.log("Warning: Failed to register phone number with messaging service", {
            error: messagingServiceData,
            phoneNumber: purchaseData.phone_number,
            messagingServiceSid: twilioMessagingServiceSid,
          });
          messagingServiceRegistrationSuccess = false;
        } else {
          console.log("Successfully registered phone number with messaging service", {
            phoneNumber: purchaseData.phone_number,
            messagingServiceSid: twilioMessagingServiceSid,
          });
        }
      } catch (error) {
        console.error("Error during messaging service registration", {
          error: error.message,
          phoneNumber: purchaseData.phone_number,
          messagingServiceSid: twilioMessagingServiceSid,
        });
        messagingServiceRegistrationSuccess = false;
      }
    } else {
      console.log("No messaging service SID provided, skipping A2P messaging service registration");
    }

    // Step 3: Update or insert into twilio_config
    const twilioConfigData = {
      clinic_id,
      phone_number: phone_number,
      twilio_account_sid: twilioAccountSid,
      twilio_auth_token: twilioAuthToken,
      twilio_phone_number: purchaseData.phone_number,
      messaging_service_sid: twilioMessagingServiceSid || null,
      status: "active",
    };
    console.log("Preparing to upsert twilio_config", { twilioConfigData, twilio_config_id });

    let upsertResult;
    if (twilio_config_id) {
      // Update existing record
      console.log("Updating existing twilio_config record", { twilio_config_id });
      upsertResult = await supabaseClient.from("twilio_config").update(twilioConfigData).eq("id", twilio_config_id).select().single();
    } else {
      // Insert new record
      console.log("Inserting new twilio_config record");
      upsertResult = await supabaseClient.from("twilio_config").insert(twilioConfigData).select().single();
    }

    const { data, error } = upsertResult;
    if (error) {
      console.error("Database save failed", {
        operation: twilio_config_id ? "update" : "insert",
        twilio_config_id,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      });
      return new Response(
        JSON.stringify({
          error: "Failed to save Twilio configuration to database",
          details: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.log("Successfully upserted twilio_config", { twilio_config_id: data.id });

    // Optionally: Verify webhook was set correctly by fetching the number details
    console.log("Verifying webhook configuration...");
    const verifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${purchaseData.sid}.json`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log("Webhook verification successful", {
        phone_number: verifyData.phone_number,
        sms_url: verifyData.sms_url,
        sms_method: verifyData.sms_method,
      });
    } else {
      console.log("Webhook verification failed", { status: verifyResponse.status });
    }

    // Success response
    console.log("Returning success response", {
      phone_number: purchaseData.phone_number,
      twilio_sid: purchaseData.sid,
      clinic_id,
      twilio_config_id: data.id,
      webhook_url: smsWebhookUrl,
      campaign_registered: campaignRegistrationSuccess,
    });

    const responseMessage =
      messagingServiceRegistrationSuccess && twilioMessagingServiceSid
        ? "SMS number assigned and registered with A2P messaging service successfully"
        : twilioMessagingServiceSid && !messagingServiceRegistrationSuccess
          ? "SMS number assigned successfully, but A2P messaging service registration failed"
          : "SMS number assigned successfully";

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        phone_number: purchaseData.phone_number,
        formatted_number: formatPhoneNumber(purchaseData.phone_number),
        twilio_sid: purchaseData.sid,
        clinic_id,
        twilio_config_id: data.id,
        webhook_url: smsWebhookUrl, // Include webhook URL in response for verification
        messaging_service_registered: messagingServiceRegistrationSuccess,
        messaging_service_sid: twilioMessagingServiceSid || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Edge Function Error", {
      message: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Helper function to format phone number
function formatPhoneNumber(phoneNumber: string): string {
  console.log("Formatting phone number", { phoneNumber });
  // Remove +1 and format as (XXX) XXX-XXXX
  const cleaned = phoneNumber.replace("+1", "");
  const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  console.log("Formatted phone number", { formatted });
  return formatted;
}
