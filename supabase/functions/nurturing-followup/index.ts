// supabase/functions/nurturing-followup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/logger.ts";
import { processScheduledFollowUps } from "../_shared/nurturing-service.ts";

// Create logger with FOLLOWUPS prefix
const { info: logInfo, error: logError } = createLogger("FOLLOWUPS");

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

  // Authenticate: require service role key
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // Process nurturing follow-ups for non-demo clinics only
    logInfo("Starting nurturing follow-ups processing");
    const result = await processScheduledFollowUps(supabase, "non_demo_only");

    logInfo("Nurturing follow-ups processing completed", {
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
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
