import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");

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

    // Step 1: Get existing Twilio numbers from account and find ones without webhooks
    console.log("Fetching existing Twilio phone numbers from account");
    const existingNumbersUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;

    const existingResponse = await fetch(existingNumbersUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    const existingData = await existingResponse.json();
    console.log("Existing Twilio numbers response", {
      status: existingResponse.status,
      ok: existingResponse.ok,
      totalNumbers: existingData.incoming_phone_numbers?.length || 0,
    });

    if (!existingResponse.ok || !existingData.incoming_phone_numbers) {
      console.log("Failed to fetch existing phone numbers, updating twilio_config to failed if exists", { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(JSON.stringify({ error: "Failed to fetch existing phone numbers from Twilio account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter numbers that don't have webhooks assigned
    const numbersWithoutWebhooks = existingData.incoming_phone_numbers.filter(num => !num.sms_url || num.sms_url === "");

    console.log("Numbers without webhooks found", {
      totalNumbers: existingData.incoming_phone_numbers.length,
      numbersWithoutWebhooks: numbersWithoutWebhooks.length,
      availableNumbers: numbersWithoutWebhooks.map(num => ({
        phoneNumber: num.phone_number,
        sid: num.sid,
        smsUrl: num.sms_url || "none",
      })),
    });

    if (numbersWithoutWebhooks.length === 0) {
      console.log("No numbers without webhooks found, updating twilio_config to failed if exists", { twilio_config_id });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(JSON.stringify({ error: "No available phone numbers without webhooks found in Twilio account" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract area code from the input phone number (first 3 digits after country code)
    const inputAreaCode = phone_number.replace(/\D/g, "").slice(-10, -7); // Get area code from 10-digit number

    console.log("Looking for numbers with matching area code", {
      inputPhoneNumber: phone_number,
      inputAreaCode: inputAreaCode,
      availableNumbers: numbersWithoutWebhooks.length,
    });

    // First, try to find a number with the same area code
    let selectedNumber = numbersWithoutWebhooks.find(num => {
      const numAreaCode = num.phone_number.replace(/\D/g, "").slice(-10, -7);
      return numAreaCode === inputAreaCode;
    });

    // If no matching area code found, use the first available number
    if (!selectedNumber) {
      selectedNumber = numbersWithoutWebhooks[0];
      console.log("No matching area code found, using first available number", {
        selectedNumber: selectedNumber.phone_number,
        selectedAreaCode: selectedNumber.phone_number.replace(/\D/g, "").slice(-10, -7),
        requestedAreaCode: inputAreaCode,
      });
    }

    // Step 2: Update the existing number with SMS processor webhook (including clinic_id)
    const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${selectedNumber.sid}.json`;
    const updateBody = new URLSearchParams({
      SmsUrl: smsWebhookUrl, // Now includes clinic_id parameter
      SmsMethod: "POST",
      // Optional: Add status callback URL for delivery receipts (also with clinic_id)
      SmsStatusCallback: `${supabaseUrl}/functions/v1/sms-processor/status?clinic_id=${clinic_id}`,
    });
    const updateResponse = await fetch(updateUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: updateBody,
    });

    const updateData = await updateResponse.json();
    console.log("Twilio update response", {
      status: updateResponse.status,
      ok: updateResponse.ok,
      phone_number: updateData.phone_number,
      sid: updateData.sid,
      sms_url: updateData.sms_url, // Log to verify webhook was set correctly
    });

    if (!updateResponse.ok) {
      console.log("Failed to update phone number webhook, updating twilio_config to failed if exists", {
        twilio_config_id,
        errorDetails: updateData,
      });
      if (twilio_config_id) {
        await supabaseClient.from("twilio_config").update({ status: "failed" }).eq("id", twilio_config_id);
      }
      return new Response(
        JSON.stringify({
          error: "Failed to update phone number webhook",
          details: updateData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use updateData instead of purchaseData for the rest of the function
    const assignedNumberData = updateData;

    // Step 2.5: Register phone number with A2P messaging service if messaging service SID is provided
    let messagingServiceRegistrationSuccess = true;
    let alreadyInCampaign = false;

    if (twilioMessagingServiceSid) {
      // First check if number is already in the messaging service

      const checkServiceUrl = `https://messaging.twilio.com/v1/Services/${twilioMessagingServiceSid}/PhoneNumbers`;

      try {
        const checkResponse = await fetch(checkServiceUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
        });

        if (checkResponse.ok) {
          const existingNumbers = await checkResponse.json();
          const isAlreadyRegistered = existingNumbers.phone_numbers?.some(num => num.sid === assignedNumberData.sid);

          if (isAlreadyRegistered) {
            alreadyInCampaign = true;
            messagingServiceRegistrationSuccess = true;
          } else {
            // Number not in campaign, proceed with registration

            const messagingServiceUrl = `https://messaging.twilio.com/v1/Services/${twilioMessagingServiceSid}/PhoneNumbers`;
            const messagingServiceBody = new URLSearchParams({
              PhoneNumberSid: assignedNumberData.sid,
            });

            const messagingServiceResponse = await fetch(messagingServiceUrl, {
              method: "POST",
              headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: messagingServiceBody,
            });

            if (!messagingServiceResponse.ok) {
              console.error("Warning: Failed to register phone number with messaging service");
              messagingServiceRegistrationSuccess = false;
            }
          }
        } else {
          // Proceed with registration attempt anyway
          const messagingServiceUrl = `https://messaging.twilio.com/v1/Services/${twilioMessagingServiceSid}/PhoneNumbers`;
          const messagingServiceBody = new URLSearchParams({
            PhoneNumberSid: assignedNumberData.sid,
          });

          const messagingServiceResponse = await fetch(messagingServiceUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: messagingServiceBody,
          });

          const messagingServiceData = await messagingServiceResponse.json();

          if (!messagingServiceResponse.ok) {
            // Check if error is because number is already registered
            if (messagingServiceData.code === 21710 || messagingServiceData.message?.includes("already")) {
              alreadyInCampaign = true;
              messagingServiceRegistrationSuccess = true;
            } else {
              console.error("Warning: Failed to register phone number with messaging service");
              messagingServiceRegistrationSuccess = false;
            }
          }
        }
      } catch {
        console.error("Error during messaging service check/registration");
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
      twilio_phone_number: assignedNumberData.phone_number,
      status: "active",
    };

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
    const verifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${assignedNumberData.sid}.json`;
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
      phone_number: assignedNumberData.phone_number,
      twilio_sid: assignedNumberData.sid,
      clinic_id,
      twilio_config_id: data.id,
      webhook_url: smsWebhookUrl,
      messaging_service_registered: messagingServiceRegistrationSuccess,
    });

    const responseMessage = twilioMessagingServiceSid
      ? alreadyInCampaign
        ? "Existing SMS number webhook assigned successfully (number was already in A2P messaging service)"
        : messagingServiceRegistrationSuccess
          ? "Existing SMS number webhook assigned and registered with A2P messaging service successfully"
          : "Existing SMS number webhook assigned successfully, but A2P messaging service registration failed"
      : "Existing SMS number webhook assigned successfully";

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        phone_number: assignedNumberData.phone_number,
        formatted_number: formatPhoneNumber(assignedNumberData.phone_number),
        twilio_sid: assignedNumberData.sid,
        clinic_id,
        twilio_config_id: data.id,
        webhook_url: smsWebhookUrl, // Include webhook URL in response for verification
        messaging_service_registered: messagingServiceRegistrationSuccess,
        messaging_service_sid: twilioMessagingServiceSid || null,
        assigned_from_existing: true, // Indicate this was assigned from existing numbers
        already_in_campaign: alreadyInCampaign, // Indicate if number was already in campaign
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
  // Remove +1 and format as (XXX) XXX-XXXX
  const cleaned = phoneNumber.replace("+1", "");
  const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return formatted;
}
