// supabase/functions/nurturing-followup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import shared logic from _shared folder
import { FOLLOW_UP_RULES, processAllLeads } from "../_shared/nurturing.ts";

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

// Process nurturing follow-ups for all clinics
async function processNurturingFollowups(supabase: any) {
  logInfo("=== Starting Nurturing Follow-ups Processing ===");

  try {
    logInfo(
      `Processing ${FOLLOWUP_RULES.length} follow-up rules:`,
      FOLLOWUP_RULES.map(r => r.name),
    );

    // Use the shared service to process all leads
    const result = await processAllLeads(supabase);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        summary: { sent: 0, skipped: 0, errors: 1 },
      };
    }

    logInfo(`Follow-ups processing completed`);

    return {
      success: true,
      summary: {
        sent: result.summary.sent,
        skipped: result.summary.skipped,
        errors: result.summary.errors,
        total: result.summary.sent + result.summary.skipped,
      },
      results: result.results,
      rulesProcessed: FOLLOWUP_RULES.map(r => r.name),
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logError("Error in processNurturingFollowups", error);
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Process all nurturing follow-ups
    logInfo("Starting nurturing follow-ups processing");
    const result = await processNurturingFollowups(supabase);

    logInfo("Nurturing follow-ups processing completed", {
      sent: result.summary?.sent || 0,
      skipped: result.summary?.skipped || 0,
      errors: result.summary?.errors || 0,
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
