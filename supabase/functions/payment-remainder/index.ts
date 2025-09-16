import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

async function sendEmail(to: string, subject: string, html: string) {
  const MAILGUN_DOMAIN = "algoricum.com";
  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");

  if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
    console.error("[sendEmail] Mailgun credentials not configured");
    return false;
  }

  try {
    const formData = new FormData();
    formData.append("from", `no-reply@algoricum.com`);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("html", html);

    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
      },
      body: formData,
    });

    if (response.ok) {
      console.log(`[sendEmail] ✅ Email sent successfully to ${to}`);
      const responseData = await response.text();
      console.log(`[sendEmail] Mailgun response: ${responseData}`);
    } else {
      console.error(`[sendEmail] ❌ Email sending failed to ${to}`);
      console.error(`[sendEmail] Status: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[sendEmail] Error response: ${errorText}`);
    }

    return response.ok;
  } catch (error) {
    console.error(`[sendEmail] ❌ Email sending exception for ${to}:`, error);
    return false;
  }
}

// Generate trial reminder email HTML based on day
function generateReminderEmail(clinicName: string, checkoutUrl: string, day: number, daysLeft: number) {
  const getSubject = (day: number) => {
    switch (day) {
      case 3:
        return "Add your payment details to keep things running smoothly";
      case 8:
        return "Don’t lose access to your patient follow-ups";
      case 12:
        return "Last call – add your card or lose access";
      default:
        return "Trial Reminder";
    }
  };
  const getCTAText = (day: number) => {
    switch (day) {
      case 3:
        return "Add Payment Info";
      case 8:
        return "Add Card";
      case 12:
        return "Add Card";
      default:
        return "Add Card";
    }
  };
  function getTrialEndDate(daysLeft: number): string {
    const now = new Date();
    const endDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);

    return endDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const getMainMessage = (day: number, daysLeft: number) => {
    switch (day) {
      case 3:
        return `
          <p>Hi ${clinicName},</p>
          <p>Your account is set up and running -  great start! </p>
          <p>To keep your access uninterrupted and ensure all features (like SMS/email follow-up) continue without a hitch, please add your payment details.</p>
        `;
      case 8:
        return `
          <p>Hi ${clinicName},</p>
          <p>Right now, your account is active, but payment details are missing.</p>
          <p>Without them, your follow-ups could be paused, which means potential patients may slip through the cracks.</p>
          <p>Take a minute now to enter your card so that your workflows continue to run.</p>
        `;
      case 12:
        return `
          <p>Hi ${clinicName},</p>
          <p>This is the last reminder. On  ${getTrialEndDate(daysLeft)}, your account will be shut off if payment details aren’t added. No SMS. No email follow-ups. No patient inquiries handled.</p>
          <p>You’ve already put in the work to get set up. Don’t throw it away over leaving one field blank.</p>
        `;
      default:
        return `
          <p>Hi ${clinicName},</p>
          <p>Your trial reminder.</p>
        `;
    }
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${getSubject(day)}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
            .content { padding: 20px 0; }
            .cta-button { 
               display: inline-block; 
                background: #800080; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0; 

            }
                .cta-button, 
.cta-button:link, 
.cta-button:visited, 
.cta-button:hover, 
.cta-button:active {
    color: white !important;
    text-decoration: none;
}
            .footer { font-size: 12px; color: #666; text-align: center; margin-top: 30px; }
            .urgent { color: #dc3545; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
       
            <div class="content">
                ${getMainMessage(day, daysLeft)}
                <div style="text-align: center;">
                    <a href="${checkoutUrl}" class="cta-button">${getCTAText(day)}</a>
                </div>
               
                <p>Algoricum</p>
            </div>
          
        </div>
    </body>
    </html>
  `;
}

// Calculate days since trial started
function getDaysSinceTrialStart(createdAt: string): number {
  const now = new Date();
  const trialStart = new Date(createdAt);
  const diffTime = now.getTime() - trialStart.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate days left in trial
function getDaysLeftInTrial(trialEnd: string): number {
  const now = new Date();
  const end = new Date(trialEnd);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Get reminder configuration for each day
const REMINDER_DAYS = [
  { day: 3, eventType: "trial_reminder_sent_3_days", subject: "Add your payment details to keep things running smoothly" },
  { day: 8, eventType: "trial_reminder_sent_8_days", subject: "Don’t lose access to your patient follow-ups" },
  { day: 12, eventType: "trial_reminder_sent_12_days", subject: "Last call – add your card or lose access" },
];

async function processRemindersForDay(reminderConfig: any, subscriptions: any[]) {
  console.log(`\n[TrialReminder] 🔄 Processing ${reminderConfig.eventType} reminders...`);
  console.log(`[TrialReminder] Found ${subscriptions.length} subscriptions for day ${reminderConfig.day}`);

  const results = [];

  for (const [index, subscription] of subscriptions.entries()) {
    const processingStart = new Date();
    console.log(`\n[TrialReminder] 🔄 Processing subscription ${index + 1}/${subscriptions.length} for day ${reminderConfig.day}`);
    console.log(`[TrialReminder] Subscription ID: ${subscription.stripe_subscription_id}`);

    const clinic = subscription.clinic;
    if (!clinic || !clinic.email) {
      console.warn(`[TrialReminder] ⚠️  Skipping subscription ${subscription.id} - no clinic email`);
      continue;
    }

    // Check if we already sent this specific reminder
    const { data: existingReminder } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("stripe_subscription_id", subscription.stripe_subscription_id)
      .eq("type", reminderConfig.eventType)
      .single();

    if (existingReminder) {
      console.log(`[TrialReminder] ⏭️  ${reminderConfig.eventType} already sent for ${subscription.stripe_subscription_id}`);
      continue;
    }

    if (!subscription.stripe_price_id) {
      console.error(`[TrialReminder] ❌ No stripe_price_id found for subscription ${subscription.stripe_subscription_id}`);
      continue;
    }

    // Create checkout URL
    let checkoutUrl = null;
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://eypitkzntyiyvwrndkgy.supabase.co";
      const SUPABASE_ANON_KEY =
        Deno.env.get("SUPABASE_ANON_KEY") || "";

      const checkoutResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinic_id: clinic.id,
          price_id: subscription.stripe_price_id,
        }),
      });

      if (checkoutResponse.ok) {
        const checkoutData = await checkoutResponse.json();
        checkoutUrl = checkoutData.url;
        console.log(`[TrialReminder] ✅ Checkout session created for day ${reminderConfig.day}`);
      } else {
        console.error(`[TrialReminder] ❌ Failed to create checkout session for day ${reminderConfig.day}`);
        continue;
      }
    } catch (error) {
      console.error(`[TrialReminder] ❌ Exception creating checkout session:`, error);
      continue;
    }

    // Calculate days left
    const daysLeft = getDaysLeftInTrial(subscription.trial_end);

    // Send reminder email
    const emailSent = await sendEmail(
      clinic.email,
      reminderConfig.subject,
      generateReminderEmail(clinic.name || "there", checkoutUrl, reminderConfig.day, daysLeft),
    );

    if (emailSent) {
      const eventPayload = {
        clinic_id: clinic.id,
        subscription_id: subscription.id,
        reminder_sent_at: new Date().toISOString(),
        day: reminderConfig.day,
        days_left: daysLeft,
      };

      const { data: insertedEvent, error: insertError } = await supabase
        .from("stripe_events")
        .insert({
          event_id: `${reminderConfig.eventType}_${subscription.stripe_subscription_id}_${Date.now()}`,
          type: reminderConfig.eventType,
          payload: eventPayload,
          stripe_subscription_id: subscription.stripe_subscription_id,
          subscription_id: subscription.id,
          summary: `Day ${reminderConfig.day} trial reminder sent to ${clinic.email}`,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[TrialReminder] ❌ Failed to log reminder event:`, insertError);
      } else {
        console.log(`[TrialReminder] ✅ Event logged with ID: ${insertedEvent?.id}`);
      }

      results.push({
        subscription_id: subscription.stripe_subscription_id,
        clinic_name: clinic.name,
        email: clinic.email,
        day: reminderConfig.day,
        status: "sent",
      });
    } else {
      results.push({
        subscription_id: subscription.stripe_subscription_id,
        clinic_name: clinic.name,
        email: clinic.email,
        day: reminderConfig.day,
        status: "failed",
      });
    }

    const processingTime = Date.now() - processingStart.getTime();
    console.log(`[TrialReminder] ⏱️  Day ${reminderConfig.day} processing took ${processingTime}ms`);
  }

  return results;
}

serve(async req => {
  const startTime = new Date();

  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    console.log("[TrialReminder] 🚀 Starting multi-day trial reminder function...");

    // Get all active trial subscriptions
    const { data: allTrialSubscriptions, error: queryError } = await supabase
      .from("stripe_subscriptions")
      .select(
        `
        *,
        clinic:clinic_id (
          id, name, email
        )
      `,
      )
      .eq("status", "trialing")
      .eq("last4", "") // No payment method on file
      .gte("trial_end", new Date().toISOString()); // Still in trial

    if (queryError) {
      console.error("[TrialReminder] ❌ Database query failed:", queryError);
      return new Response("Database query failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log(`[TrialReminder] ✅ Found ${allTrialSubscriptions?.length || 0} active trial subscriptions`);

    if (!allTrialSubscriptions || allTrialSubscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active trials found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allResults = [];

    // Process each reminder day
    for (const reminderConfig of REMINDER_DAYS) {
      // Filter subscriptions that should receive this day's reminder
      const subscriptionsForDay = allTrialSubscriptions.filter(subscription => {
        const daysSinceStart = getDaysSinceTrialStart(subscription.created_at);
        // Send reminder if it's exactly the target day or later (to catch any missed ones)
        return daysSinceStart >= reminderConfig.day;
      });

      if (subscriptionsForDay.length > 0) {
        const dayResults = await processRemindersForDay(reminderConfig, subscriptionsForDay);
        allResults.push(...dayResults);
      }
    }

    const endTime = new Date();
    const totalTime = endTime.getTime() - startTime.getTime();

    // Summarize results by day
    const summary = REMINDER_DAYS.map(config => {
      const dayResults = allResults.filter(r => r.day === config.day);
      return {
        day: config.day,
        total_processed: dayResults.length,
        successful_sends: dayResults.filter(r => r.status === "sent").length,
        failed_sends: dayResults.filter(r => r.status === "failed").length,
      };
    });

    console.log(`\n[TrialReminder] 🎉 Multi-day reminder function completed!`);
    console.log(`[TrialReminder] Total execution time: ${totalTime}ms`);
    console.log(`[TrialReminder] Total subscriptions processed: ${allResults.length}`);
    summary.forEach(s => {
      if (s.total_processed > 0) {
        console.log(`[TrialReminder] Day ${s.day}: ${s.successful_sends} sent, ${s.failed_sends} failed`);
      }
    });

    return new Response(
      JSON.stringify({
        message: "Multi-day trial reminders processed",
        total_processed: allResults.length,
        summary,
        results: allResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const endTime = new Date();
    const totalTime = endTime.getTime() - startTime.getTime();

    console.error(`[TrialReminder] 💥 Critical error after ${totalTime}ms:`, error);
    console.error("[TrialReminder] Error stack:", error.stack);

    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
