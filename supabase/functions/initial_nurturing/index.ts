// supabase/functions/initial_nurturing/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import shared logic from _shared folder
import { processAllLeads, getClinicType } from "../_shared/nurturing-service.ts";
import { getFollowUpRulesForClinic } from "../_shared/followUpRulesService.ts";
import { createLogger } from "../_shared/logger.ts";

// Create logger with INITIAL prefix
const { info: logInfo, error: logError } = createLogger("INITIAL");

// Process initial nurturing contacts
async function processNurturingInitial(supabase: any) {
  logInfo("=== Starting Initial Nurturing Processing ===");

  try {
    // Get all clinics to process their individual initial rules
    const { data: clinics, error: clinicError } = await supabase.from("clinic").select("id, name");

    if (clinicError) {
      logError("Failed to fetch clinics", clinicError);
      return {
        success: false,
        error: "Failed to fetch clinics",
        summary: { sent: 0, skipped: 0, errors: 1 },
      };
    }

    if (!clinics || clinics.length === 0) {
      logInfo("No clinics found");
      return {
        success: true,
        results: [],
        summary: { sent: 0, skipped: 0, errors: 0 },
      };
    }

    const allResults: any[] = [];
    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each clinic with their appropriate initial rule
    for (const clinic of clinics) {
      try {
        // Get clinic type to determine correct initial rule
        const clinicType = await getClinicType(supabase, clinic.id);
        const clinicRules = await getFollowUpRulesForClinic(clinic.id, supabase);

        // Determine initial rule based on clinic type
        let initialRule;
        let communicationType;

        if (clinicType.isDemo && !clinicType.isPaid) {
          // Demo + Free: Start with first email rule
          initialRule = clinicRules.find(rule => rule.communicationType === "email");
          communicationType = "email";
          logInfo(`Clinic ${clinic.name} (demo + free): Using email initial rule`);
        } else {
          // Demo + Paid or Production: Start with SMS rule
          initialRule = clinicRules.find(rule => rule.name === "sms_5min_initial");
          communicationType = "sms";
          logInfo(`Clinic ${clinic.name} (${clinicType.isDemo ? "demo + paid" : "production"}): Using SMS initial rule`);
        }

        if (!initialRule) {
          logError(`No initial rule found for clinic ${clinic.name}`);
          totalErrors++;
          continue;
        }

        logInfo(`Processing clinic ${clinic.name} with rule: ${initialRule.name}`);

        // Process this clinic with their specific initial rule
        const result = await processAllLeads(supabase, communicationType, [initialRule], [clinic.id]);

        if (result.success) {
          allResults.push(...(result.results || []));
          totalSent += result.summary?.sent || 0;
          totalSkipped += result.summary?.skipped || 0;
          totalErrors += result.summary?.errors || 0;
        } else {
          logError(`Failed processing clinic ${clinic.name}:`, result.error);
          totalErrors++;
        }
      } catch (clinicError) {
        logError(`Error processing clinic ${clinic.id}:`, clinicError);
        totalErrors++;
      }
    }

    logInfo(`Initial nurturing processing completed`);

    return {
      success: true,
      summary: {
        sent: totalSent,
        skipped: totalSkipped,
        errors: totalErrors,
        total: totalSent + totalSkipped,
      },
      results: allResults,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logError("Error in processNurturingInitial", error);
    return {
      success: false,
      error: error.message,
      summary: { sent: 0, skipped: 0, errors: 1 },
    };
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

  logInfo("=== Initial Nurturing Function Called ===");
  logInfo(`Request method: ${req.method}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    logInfo("Supabase client created successfully");

    // Process initial nurturing
    logInfo("Starting initial nurturing processing");
    const result = await processNurturingInitial(supabase);

    logInfo("Initial nurturing processing completed", {
      sent: result.summary?.sent || 0,
      skipped: result.summary?.skipped || 0,
      errors: result.summary?.errors || 0,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    logInfo("Initial contact processing completed", {
      processed: result.processed,
      errors: result.errors,
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
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
