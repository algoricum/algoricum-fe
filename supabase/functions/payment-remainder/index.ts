import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabaseClient.ts";

async function sendEmail(to: string, subject: string, html: string, clinicMailgunDomain?: string) {
  const MAILGUN_DOMAIN = clinicMailgunDomain || Deno.env.get("MAILGUN_DOMAIN");
  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");

  if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
    console.error("[sendEmail] Mailgun credentials not configured");
    return false;
  }

  try {
    const formData = new FormData();
    formData.append("from", `noreply@${MAILGUN_DOMAIN}`);
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

// Generate trial reminder email HTML
function generateReminderEmail(clinicName: string, checkoutUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Trial is Almost Over</title>
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
            .footer { font-size: 12px; color: #666; text-align: center; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Your Free Trial Ends Soon!</h1>
            </div>
            <div class="content">
                <p>Hi ${clinicName},</p>
                <p>Your 14-day free trial is coming to an end in just <strong>6 days</strong>.</p>
                <p>We hope you've been enjoying our platform! To continue using all the features without interruption, please subscribe to one of our plans.</p>
                <div style="text-align: center;">
                    <a href="${checkoutUrl}" class="cta-button">Choose Your Plan</a>
                </div>
                <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
                <p>Thank you for trying our service!</p>
                <p>Best regards,<br>The Team</p>
            </div>
            <div class="footer">
                <p>You received this email because your trial is ending soon. If you don't wish to continue, no action is required.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

serve(async req => {
  const startTime = new Date();

  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const { data: subscriptionsToRemind, error: queryError } = await supabase
      .from("stripe_subscriptions")
      .select(
        `
        *,
        clinic:clinic_id (
          id, name, email, mailgun_domain, mailgun_email
        )
      `,
      )
      .eq("status", "trialing")
      .gte("trial_end", now.toISOString()) // Still in trial
      .lte("created_at", eightDaysAgo.toISOString()); // Started 8 days ago or more

    if (queryError) {
      console.error("[TrialReminder] ❌ Database query failed:", queryError);
      console.error("[TrialReminder] Query details:", {
        table: "stripe_subscriptions",
        status: "trialing",
        trial_end_after: now.toISOString(),
        created_at_before: eightDaysAgo.toISOString(),
      });
      return new Response("Database query failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log(`[TrialReminder] ✅ Query successful. Found ${subscriptionsToRemind?.length || 0} subscriptions`);

    if (!subscriptionsToRemind || subscriptionsToRemind.length === 0) {
      return new Response(JSON.stringify({ message: "No trials to remind", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[TrialReminder] 📋 Processing ${subscriptionsToRemind.length} subscription(s):`);
    subscriptionsToRemind.forEach((sub, index) => {
      console.log(`[TrialReminder]   ${index + 1}. ID: ${sub.stripe_subscription_id}, Clinic: ${sub.clinic?.name || "N/A"}`);
    });

    const results = [];

    for (const [index, subscription] of subscriptionsToRemind.entries()) {
      const processingStart = new Date();
      console.log(`\n[TrialReminder] 🔄 Processing subscription ${index + 1}/${subscriptionsToRemind.length}`);
      console.log(`[TrialReminder] Subscription ID: ${subscription.stripe_subscription_id}`);
      console.log(`[TrialReminder] Created at: ${subscription.created_at}`);
      console.log(`[TrialReminder] Trial ends: ${subscription.trial_end}`);

      const clinic = subscription.clinic;
      if (!clinic || !clinic.email) {
        console.warn(`[TrialReminder] ⚠️  Skipping subscription ${subscription.id} - no clinic email`);
        console.warn(`[TrialReminder] Clinic data:`, {
          clinic_exists: !!clinic,
          clinic_id: clinic?.id,
          clinic_name: clinic?.name,
          clinic_email: clinic?.email,
        });
        continue;
      }

      // Check if we already sent a reminder by looking at stripe_events
      const { data: existingReminder, error: reminderCheckError } = await supabase
        .from("stripe_events")
        .select("id, created_at")
        .eq("stripe_subscription_id", subscription.stripe_subscription_id)
        .eq("type", "trial_reminder_sent")
        .single();

      if (reminderCheckError && reminderCheckError.code !== "PGRST116") {
        console.error(`[TrialReminder] ❌ Error checking for existing reminder:`, reminderCheckError);
      }

      if (existingReminder) {
        console.log(
          `[TrialReminder] ⏭️  Reminder already sent for subscription ${subscription.stripe_subscription_id} on ${existingReminder.created_at}`,
        );
        continue;
      }

      let checkoutUrl = null;

      if (!subscription.stripe_price_id) {
        console.error(`[TrialReminder] ❌ No stripe_price_id found for subscription ${subscription.stripe_subscription_id}`);
        console.log(`[TrialReminder] Skipping this subscription - cannot create checkout session without price_id`);
        continue;
      }

      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://eypitkzntyiyvwrndkgy.supabase.co";
        const SUPABASE_ANON_KEY =
          Deno.env.get("SUPABASE_ANON_KEY") ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGl0a3pudHlpeXZ3cm5ka2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTEyNTUsImV4cCI6MjA2MTU4NzI1NX0.KNuo0SGqJKEtJj5-vPz2D6kdtYB54XXBjkqYqdkaBQI";

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
          if (checkoutData.url) {
            checkoutUrl = checkoutData.url;
            console.log(`[TrialReminder] ✅ Checkout session created successfully: ${checkoutUrl}`);
          } else {
            console.error(`[TrialReminder] ❌ Checkout session created but no URL returned`);
            console.log(`[TrialReminder] Response data:`, checkoutData);
            console.log(`[TrialReminder] Skipping this subscription - no checkout URL available`);
            continue;
          }
        } else {
          const errorText = await checkoutResponse.text();
          console.error(`[TrialReminder] ❌ Failed to create checkout session: ${checkoutResponse.status} ${checkoutResponse.statusText}`);
          console.error(`[TrialReminder] Error response: ${errorText}`);
          console.log(`[TrialReminder] Skipping this subscription - checkout session creation failed`);
          continue;
        }
      } catch (checkoutError) {
        console.error(`[TrialReminder] ❌ Exception creating checkout session:`, checkoutError);
        console.log(`[TrialReminder] Skipping this subscription - checkout session creation failed`);
        continue;
      }

      // Send reminder email
      const emailSent = await sendEmail(
        clinic.email,
        "Your Free Trial Ends Soon - Continue Your Subscription",
        generateReminderEmail(clinic.name || "there", checkoutUrl),
        clinic.mailgun_domain,
      );

      if (emailSent) {
        const eventPayload = {
          clinic_id: clinic.id,
          subscription_id: subscription.id,
          reminder_sent_at: now.toISOString(),
        };

        const { data: insertedEvent, error: insertError } = await supabase
          .from("stripe_events")
          .insert({
            event_id: `trial_reminder_${subscription.stripe_subscription_id}_${Date.now()}`,
            type: "trial_reminder_sent",
            payload: eventPayload,
            stripe_subscription_id: subscription.stripe_subscription_id,
            subscription_id: subscription.id,
            summary: `Trial reminder sent to ${clinic.email}`,
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
          status: "sent",
        });

        console.log(`[TrialReminder] ✅ Successfully processed subscription ${subscription.stripe_subscription_id}`);
      } else {
        console.error(`[TrialReminder] ❌ Failed to send email for subscription ${subscription.stripe_subscription_id}`);

        results.push({
          subscription_id: subscription.stripe_subscription_id,
          clinic_name: clinic.name,
          email: clinic.email,
          status: "failed",
        });
      }

      const processingEnd = new Date();
      const processingTime = processingEnd.getTime() - processingStart.getTime();
      console.log(`[TrialReminder] ⏱️  Subscription processing took ${processingTime}ms`);
    }

    const endTime = new Date();
    const totalTime = endTime.getTime() - startTime.getTime();

    console.log(`\n[TrialReminder] 🎉 Function completed successfully!`);
    console.log(`[TrialReminder] Total execution time: ${totalTime}ms`);
    console.log(`[TrialReminder] Subscriptions found: ${subscriptionsToRemind.length}`);
    console.log(`[TrialReminder] Reminders processed: ${results.length}`);
    console.log(`[TrialReminder] Successful sends: ${results.filter(r => r.status === "sent").length}`);
    console.log(`[TrialReminder] Failed sends: ${results.filter(r => r.status === "failed").length}`);

    return new Response(
      JSON.stringify({
        message: "Trial reminders processed",
        total_processed: results.length,
        results,
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
