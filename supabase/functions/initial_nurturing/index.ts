// supabase/functions/initial_nurturing/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import shared logic from _shared folder
import { FOLLOW_UP_RULES, processAllLeads } from "../_shared/nurturing.ts";

// Enhanced logging function
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INITIAL: ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] INITIAL ERROR: ${message}`, error);
}

// Get only initial contact rule
const INITIAL_RULE = FOLLOW_UP_RULES.find(rule => rule.name === "sms_5min_initial");

// Process initial nurturing contacts
async function processNurturingInitial(supabase: any) {
  logInfo("=== Starting Initial Nurturing Processing ===");

  try {
    if (!INITIAL_RULE) {
      logError("SMS initial contact rule not found in FOLLOW_UP_RULES");
      return {
        success: false,
        error: "SMS initial contact rule not configured",
        summary: { sent: 0, skipped: 0, errors: 1 },
      };
    }

    logInfo(`Processing initial contact rule: ${INITIAL_RULE.name}`);

    // Use the shared service to process only initial contacts (first rule only)
    const result = await processAllLeads(supabase, "sms", [INITIAL_RULE]);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        summary: { sent: 0, skipped: 0, errors: 1 },
      };
    }

    logInfo(`Initial nurturing processing completed`);

    return {
      success: true,
      summary: {
        sent: result.summary.sent,
        skipped: result.summary.skipped,
        errors: result.summary.errors,
        total: result.summary.sent + result.summary.skipped,
      },
      results: result.results,
      rule: INITIAL_RULE.name,
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
