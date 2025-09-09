// supabase/functions/auto-email-processing/index.ts
// This Supabase cron job calls your existing test-email-connection function automatically

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🤖 Starting automated email processing cron job...");

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Get all clinics with email configurations AND assistants
    const { data: clinics, error: clinicsError } = await supabaseClient
      .from("clinic")
      .select(
        `
        id,
        name,
        email,
        phone,
        mailgun_email,
        assistants (
          id,
          openai_assistant_id,
          assistant_name,
          instructions
        )
      `,
      )
      .not("mailgun_email", "is", null);

    if (clinicsError) {
      console.error("Failed to fetch clinics:", clinicsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch clinics: ${clinicsError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!clinics || clinics.length === 0) {
      console.log("📭 No clinics with email configurations found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No clinics configured for email processing",
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`📧 Found ${clinics.length} clinics with email configurations`);

    const results = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    // Process each clinic by calling your existing test-email-connection function
    for (const clinic of clinics) {
      try {
        console.log(`🏥 Processing clinic: ${clinic.name} (ID: ${clinic.id})`);

        if (!clinic.mailgun_email) {
          console.log(`⚠️ Skipping ${clinic.name} - no email configuration`);
          continue;
        }

        // Find the first assistant for this clinic
        const assistant = clinic.assistants?.[0];
        if (!assistant) {
          console.log(`⚠️ Skipping ${clinic.name} - no assistant configured`);
          continue;
        }

        // Call your existing test-email-connection edge function
        const edgeFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/test-email-connection`;

        // Prepare the payload exactly like your button does, but with cron_job flag
        const payload = {
          ...clinic.mailgun_email, // This contains all SMTP/IMAP settings
          clinic_id: clinic.id,
          assistant_id: assistant.id,
          cron_job: true, // This tells your function it's a cron job, not manual test
        };

        console.log(`🔄 Calling test-email-connection function for ${clinic.name}...`);

        const response = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Successfully processed ${clinic.name}`);
          console.log(`📬 Emails processed: ${result.summary?.emails_processed || 0}`);
          totalProcessed += result.summary?.emails_processed || 0;
        } else {
          console.error(`❌ Failed to process ${clinic.name}:`, result.error);
          totalErrors++;
        }

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          success: result.success,
          emails_processed: result.summary?.emails_processed || 0,
          error: result.error || null,
          processed_at: new Date().toISOString(),
        });

        // Small delay between clinics to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (clinicError) {
        console.error(`❌ Error processing clinic ${clinic.name}:`, clinicError);
        totalErrors++;

        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          success: false,
          emails_processed: 0,
          error: clinicError instanceof Error ? clinicError.message : "Unknown error",
          processed_at: new Date().toISOString(),
        });
      }
    }

    // Log the cron job execution to database
    try {
      await supabaseClient.from("cron_job_logs").insert({
        job_type: "email_processing",
        total_clinics: clinics.length,
        successful_clinics: results.filter(r => r.success).length,
        failed_clinics: totalErrors,
        total_emails_processed: totalProcessed,
        execution_details: results,
        executed_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error("Failed to log cron job execution:", logError);
    }

    console.log(`🏁 Cron job completed:`);
    console.log(`   - Clinics processed: ${clinics.length}`);
    console.log(`   - Total emails processed: ${totalProcessed}`);
    console.log(`   - Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Automated email processing completed successfully`,
        summary: {
          total_clinics: clinics.length,
          successful_clinics: results.filter(r => r.success).length,
          failed_clinics: totalErrors,
          total_emails_processed: totalProcessed,
          execution_time: new Date().toISOString(),
          next_run: "In 5 minutes",
        },
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Cron job error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
