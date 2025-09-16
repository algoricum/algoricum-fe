import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  FOLLOW_UP_RULES,
  processScheduledFollowUps
} from '../_shared/nurturing-demo.ts';

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

// Process nurturing follow-ups only for demo clinics
async function processNurturingFollowupsDemo(supabase: any) {
  logInfo('=== Starting Demo Nurturing Follow-ups Processing ===')
  
  try {
    logInfo(`Processing ${FOLLOWUP_RULES.length} follow-up rules:`, FOLLOWUP_RULES.map(r => r.name))
    
    // Get all clinics with their settings
    const { data: clinics, error: clinicError } = await supabase
      .from("clinic")
      .select(`
         id,
        name,
        openai_api_key,
        assistant_prompt,
        assistant_model,
        chatbot_name,
        mailgun_domain,
        mailgun_email,
        calendly_link,
        clinic_type,
        twilio_config!inner(
          twilio_account_sid,
          twilio_auth_token,
          twilio_phone_number,
          status
        ),
        assistants (
          *
        )
      `)
      .eq("twilio_config.status", "active");

    if (clinicError) {
      logError("Error fetching clinics", clinicError);
      return {
        success: false,
        error: 'Failed to fetch clinics',
        summary: { sent: 0, skipped: 0, errors: 1 }
      }
    }

    if (!clinics || clinics.length === 0) {
      logInfo("No clinics found");
      return {
        success: true,
        summary: { sent: 0, skipped: 0, errors: 0 },
        message: 'No clinics to process'
      }
    }

    logInfo(`Found ${clinics.length} clinics`);

    let totalSent = 0
    let totalSkipped = 0
    let totalErrors = 0
    let clinicsProcessed = 0
    let clinicsSkipped = 0

    // Filter clinics to only process demo clinics
    const demoClinicIds = []
    for (const clinic of clinics) {
      const roleCheck = await checkClinicRole(supabase, clinic.id)
      
      if (roleCheck.isAuthorized) {
        demoClinicIds.push(clinic.id)
        clinicsProcessed++
        logInfo(`Processing authorized demo clinic: ${clinic.name}`)
      } else {
        clinicsSkipped++
        logInfo(`Skipping clinic ${clinic.name} - no demo_user role (roles: ${roleCheck.roleType})`)
      }
    }

    if (demoClinicIds.length === 0) {
      logInfo('No demo clinics found to process')
      return {
        success: true,
        summary: { sent: 0, skipped: 0, errors: 0 },
        message: 'No demo clinics to process',
        clinicsProcessed: 0,
        clinicsSkipped: clinicsSkipped
      }
    }

    // Use the shared service to process all leads for demo clinics only
    const result = await processScheduledFollowUps(supabase)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        summary: { sent: 0, skipped: 0, errors: 1 },
        clinicsProcessed: 0,
        clinicsSkipped: clinicsSkipped
      }
    }

    logInfo(`Demo follow-ups processing completed`)
    logInfo(`Clinics processed: ${clinicsProcessed}, skipped: ${clinicsSkipped}`)

    return {
      success: true,
      summary: {
        sent: result.summary.sent,
        skipped: result.summary.skipped, 
        errors: result.summary.errors,
        total: result.summary.sent + result.summary.skipped,
        clinicsProcessed: clinicsProcessed,
        clinicsSkipped: clinicsSkipped,
      },
      results: result.results,
      rulesProcessed: FOLLOWUP_RULES.map(r => r.name),
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logError('Error in processNurturingFollowupsDemo', error)
    return {
      success: false,
      error: error.message,
      summary: { sent: 0, skipped: 0, errors: 1 }
    }
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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  logInfo('=== Demo Nurturing Follow-ups Function Called ===')
  logInfo(`Request method: ${req.method}`)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    logInfo("Supabase client created successfully");

    // Process demo nurturing follow-ups
    logInfo('Starting demo nurturing follow-ups processing')
    const result = await processNurturingFollowupsDemo(supabase)
    
    logInfo('Demo nurturing follow-ups processing completed', {
      sent: result.summary?.sent || 0,
      skipped: result.summary?.skipped || 0,
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
        summary: { sent: 0, skipped: 0, errors: 1 },
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
