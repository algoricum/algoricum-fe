import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { determineFollowUpsForLead, FOLLOW_UP_RULES, generateIntelligentResponse, sendEmail, sendSMS } from "../_shared/nurturing-demo.ts";

interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  status: string;
  source_id: string;
  clinic_id: string;
  notes?: string;
  interest_level: string;
  urgency: string;
  created_at: string;
  updated_at: string;
}

interface ProcessingResult {
  leadId: string;
  action: "sent" | "skipped" | "error";
  reason: string;
  followUpType: string;
  communicationType: "sms" | "email";
  error?: string;
}

// Enhanced logging function
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] FOLLOWUPS: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] FOLLOWUPS ERROR: ${message}`, error);
}

// Get all follow-up rules except initial_contact
const FOLLOWUP_RULES = FOLLOW_UP_RULES.filter(rule => rule.name !== "sms_5min_initial");

// Check if clinic has demo_user role
async function checkClinicRole(supabase: any, clinicId: string): Promise<{ isAuthorized: boolean; roleType?: string }> {
  try {
    logInfo(`Checking role for clinic: ${clinicId}`);

    // Check if any user associated with this clinic has demo_user role
    const { data: userClinics, error: userClinicError } = await supabase
      .from("user_clinic")
      .select(
        `
        user_id,
        role_id,
        is_active,
        role!inner(
          type
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    if (userClinicError) {
      logError("Error fetching clinic roles", userClinicError);
      return { isAuthorized: false };
    }

    if (!userClinics || userClinics.length === 0) {
      logInfo(`No active users found for clinic: ${clinicId}`);
      return { isAuthorized: false };
    }

    // Check if any user has demo_user role
    const demoUser = userClinics.find(uc => uc.role?.type === "demo_user");

    if (demoUser) {
      logInfo(`Clinic ${clinicId} has demo_user role through user ${demoUser.user_id}`);
      return {
        isAuthorized: true,
        roleType: "demo_user",
      };
    }

    // Log all roles found for debugging
    const roleTypes = userClinics.map(uc => uc.role?.type).filter(Boolean);
    logInfo(`Clinic ${clinicId} roles found: ${roleTypes.join(", ")} - NOT AUTHORIZED`);

    return {
      isAuthorized: false,
      roleType: roleTypes.join(", ") || "unknown",
    };
  } catch (error: any) {
    logError("Error in checkClinicRole", error);
    return { isAuthorized: false };
  }
}

// Process all follow-ups except initial contact for all demo clinics
async function processNurturingFollowups(supabase: any) {
  logInfo("=== Starting Nurturing Follow-ups Processing ===");

  try {
    logInfo(
      `Processing ${FOLLOWUP_RULES.length} follow-up rules:`,
      FOLLOWUP_RULES.map(r => r.name),
    );

    // Get all clinics with their SMS settings only (email settings fetched by shared function)
    const { data: clinics, error: clinicError } = await supabase.from("clinic").select(`
        id,
        name,
        openai_api_key,
        assistant_prompt,
        assistant_model,
        chatbot_name,
        calendly_link,
        twilio_config(
          twilio_account_sid,
          twilio_auth_token,
          twilio_phone_number,
          status
        )
      `);

    if (clinicError) {
      logError("Error fetching clinics", clinicError);
      return {
        success: false,
        error: "Failed to fetch clinics",
        summary: { sms: 0, email: 0, errors: 1 },
      };
    }

    if (!clinics || clinics.length === 0) {
      logInfo("No clinics found");
      return {
        success: true,
        summary: { sms: 0, email: 0, errors: 0 },
        message: "No clinics to process",
      };
    }

    logInfo(`Found ${clinics.length} clinics`);

    let smsProcessed = 0;
    let emailProcessed = 0;
    let totalErrors = 0;
    let clinicsProcessed = 0;
    let clinicsSkipped = 0;
    const allResults: ProcessingResult[] = [];

    // Process each clinic
    for (const clinic of clinics) {
      try {
        logInfo(`Checking access for clinic: ${clinic.name} (${clinic.id})`);

        // Check if clinic has demo_user role
        const roleCheck = await checkClinicRole(supabase, clinic.id);

        if (!roleCheck.isAuthorized) {
          logInfo(`Skipping clinic ${clinic.name} - no demo_user role (roles: ${roleCheck.roleType})`);
          clinicsSkipped++;
          continue;
        }

        logInfo(`Processing authorized clinic: ${clinic.name}`);
        clinicsProcessed++;

        // Check SMS capabilities
        const hasSMS = clinic.twilio_config && clinic.twilio_config.length > 0 && clinic.twilio_config[0]?.status === "active";

        logInfo(`Clinic ${clinic.name} SMS capability: ${hasSMS}`);

        // Get all leads for this clinic
        const { data: leads, error: leadsError } = await supabase
          .from("lead")
          .select("*")
          .eq("clinic_id", clinic.id)
          .or("phone.not.is.null,email.not.is.null"); // Has either phone or email

        if (leadsError) {
          logError(`Error fetching leads for clinic ${clinic.id}`, leadsError);
          totalErrors++;
          continue;
        }

        if (!leads || leads.length === 0) {
          logInfo(`No leads found for clinic ${clinic.name}`);
          continue;
        }

        logInfo(`Found ${leads.length} leads for clinic ${clinic.name}`);

        // Process each lead
        for (const lead of leads) {
          try {
            // Determine which follow-ups this lead should receive
            const applicableRules = await determineFollowUpsForLead(lead, supabase);

            // Filter out initial contact rule (handled by other function)
            const followupRules = applicableRules.filter(rule => rule.name !== "sms_5min_initial");

            if (followupRules.length === 0) {
              continue; // No follow-ups needed for this lead
            }

            logInfo(`Lead ${lead.id} has ${followupRules.length} applicable follow-up rules`);

            // Process each applicable follow-up rule
            for (const rule of followupRules) {
              try {
                // Check if clinic supports SMS (for SMS rules)
                if (rule.communicationType === "sms" && !hasSMS) {
                  allResults.push({
                    leadId: lead.id,
                    action: "skipped",
                    reason: "Clinic does not have SMS configured",
                    followUpType: rule.name,
                    communicationType: rule.communicationType,
                  });
                  continue;
                }

                // Check if lead has required contact info
                const hasContactInfo =
                  (rule.communicationType === "sms" && lead.phone) || (rule.communicationType === "email" && lead.email);

                if (!hasContactInfo) {
                  allResults.push({
                    leadId: lead.id,
                    action: "skipped",
                    reason: `Lead missing ${rule.communicationType} contact info`,
                    followUpType: rule.name,
                    communicationType: rule.communicationType,
                  });
                  continue;
                }

                // Get or create thread
                const threadId = await getOrCreateThread(lead, supabase);
                if (!threadId) {
                  allResults.push({
                    leadId: lead.id,
                    action: "error",
                    reason: "Failed to get or create thread",
                    followUpType: rule.name,
                    communicationType: rule.communicationType,
                  });
                  totalErrors++;
                  continue;
                }

                // Get conversation history
                const conversationHistory = await getConversationHistory(threadId, supabase);

                // Generate message content
                const messageContent = await generateIntelligentResponse(
                  lead,
                  clinic,
                  conversationHistory,
                  rule.communicationType === "email",
                );

                // Send the message
                let sendResult: { success: boolean; error?: string };

                if (rule.communicationType === "sms") {
                  sendResult = await sendSMS(
                    lead.phone,
                    messageContent as string,
                    lead.clinic_id,
                    supabase,
                    clinic.twilio_config[0], // Pass SMS settings
                  );
                } else {
                  const emailContent = messageContent as { subject: string; body: string };
                  // Let shared function fetch email settings automatically
                  sendResult = await sendEmail(
                    lead.email!,
                    emailContent.subject,
                    emailContent.body,
                    lead.clinic_id,
                    supabase,
                    // No email settings parameter - let the shared function handle it
                  );
                }

                if (sendResult.success) {
                  // Save message to conversation history
                  await saveMessageToHistory(threadId, messageContent, rule.name, supabase);

                  if (rule.communicationType === "sms") {
                    smsProcessed++;
                  } else {
                    emailProcessed++;
                  }

                  allResults.push({
                    leadId: lead.id,
                    action: "sent",
                    reason: `Successfully sent ${rule.name}`,
                    followUpType: rule.name,
                    communicationType: rule.communicationType,
                  });

                  logInfo(`Successfully sent ${rule.name} (${rule.communicationType}) to lead ${lead.id}`);
                } else {
                  totalErrors++;
                  allResults.push({
                    leadId: lead.id,
                    action: "error",
                    reason: `Failed to send ${rule.name}`,
                    followUpType: rule.name,
                    communicationType: rule.communicationType,
                    error: sendResult.error,
                  });

                  logError(`Failed to send ${rule.name} to lead ${lead.id}`, sendResult.error);
                }
              } catch (error: any) {
                logError(`Error processing rule ${rule.name} for lead ${lead.id}`, error);
                totalErrors++;
                allResults.push({
                  leadId: lead.id,
                  action: "error",
                  reason: `Exception while processing ${rule.name}`,
                  followUpType: rule.name,
                  communicationType: rule.communicationType,
                  error: error.message,
                });
              }
            }
          } catch (error: any) {
            logError(`Error processing lead ${lead.id}`, error);
            totalErrors++;
          }
        }
      } catch (error: any) {
        logError(`Error processing clinic ${clinic.id}`, error);
        totalErrors++;
      }
    }

    logInfo(`Follow-ups processing completed: ${smsProcessed} SMS, ${emailProcessed} emails, ${totalErrors} errors`);
    logInfo(`Clinics processed: ${clinicsProcessed}, skipped: ${clinicsSkipped}`);

    return {
      success: true,
      summary: {
        sms: smsProcessed,
        email: emailProcessed,
        errors: totalErrors,
        total: smsProcessed + emailProcessed,
        clinicsProcessed: clinicsProcessed,
        clinicsSkipped: clinicsSkipped,
      },
      results: allResults,
      rulesProcessed: FOLLOWUP_RULES.map(r => r.name),
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logError("Error in processNurturingFollowups", error);
    return {
      success: false,
      error: error.message,
      summary: { sms: 0, email: 0, errors: 1 },
    };
  }
}

// Helper functions
async function getOrCreateThread(lead: Lead, supabase: any): Promise<string | null> {
  try {
    // Try to get existing thread
    const { data: existingThread } = await supabase
      .from("threads")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("clinic_id", lead.clinic_id)
      .single();

    if (existingThread) {
      return existingThread.id;
    }

    // Create new thread
    const { data: newThread, error: threadError } = await supabase
      .from("threads")
      .insert({
        lead_id: lead.id,
        clinic_id: lead.clinic_id,
        status: "new",
      })
      .select("id")
      .single();

    if (threadError) {
      logError(`Error creating thread for lead ${lead.id}`, threadError);
      return null;
    }

    return newThread.id;
  } catch (error) {
    logError(`Error in getOrCreateThread for lead ${lead.id}`, error);
    return null;
  }
}

async function getConversationHistory(threadId: string, supabase: any) {
  try {
    const { data: conversations, error } = await supabase
      .from("conversation")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      logError(`Error fetching conversation history for thread ${threadId}`, error);
      return [];
    }

    return conversations || [];
  } catch (error) {
    logError(`Error in getConversationHistory for thread ${threadId}`, error);
    return [];
  }
}

async function saveMessageToHistory(
  threadId: string,
  messageContent: string | { subject: string; body: string },
  followUpType: string,
  supabase: any,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    let messageText = "";

    if (typeof messageContent === "string") {
      messageText = `${followUpType.toUpperCase()}: ${messageContent}`;
    } else {
      messageText = `${followUpType.toUpperCase()} EMAIL - Subject: ${messageContent.subject}\n\n${messageContent.body}`;
    }

    await supabase.from("conversation").insert({
      thread_id: threadId,
      message: messageText,
      timestamp: now,
      is_from_user: false,
      sender_type: "assistant",
    });
  } catch (error) {
    logError(`Error saving message to history for thread ${threadId}`, error);
  }
}

// Main Edge Function
serve(async req => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  logInfo("=== Nurturing Follow-ups Function Called ===");
  logInfo(`Request method: ${req.method}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    logInfo("Supabase client created successfully");

    // Process all nurturing follow-ups (only for demo clinics)
    logInfo("Starting nurturing follow-ups processing");
    const result = await processNurturingFollowups(supabase);

    logInfo("Nurturing follow-ups processing completed", {
      sms: result.summary?.sms || 0,
      email: result.summary?.email || 0,
      errors: result.summary?.errors || 0,
      clinicsProcessed: result.summary?.clinicsProcessed || 0,
      clinicsSkipped: result.summary?.clinicsSkipped || 0,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logError("Function error", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        summary: { sms: 0, email: 0, errors: 1 },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
