import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import { corsHeaders } from "../_shared/cors.ts";

async function sendEmail(to: string, subject: string, html: string, clinicMailgunDomain?: string) {
  const MAILGUN_DOMAIN = clinicMailgunDomain || Deno.env.get("MAILGUN_DOMAIN");
  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
  
  if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
    console.error("Mailgun credentials not configured");
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

    return response.ok;
  } catch (error) {
    console.error("Email sending failed:", error);
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
                background: #007bff; 
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    const APP_URL = Deno.env.get("LIVE_APP_URL") || "http://localhost:3000";
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000));

    // Query for subscriptions that are in trial and started 8 days ago
    const { data: subscriptionsToRemind, error: queryError } = await supabase
      .from("stripe_subscriptions")
      .select(`
        *,
        clinic:clinic_id (
          id, name, email, mailgun_domain, mailgun_email
        )
      `)
      .eq("status", "trialing")
      .gte("trial_end", now.toISOString()) // Still in trial
      .lte("created_at", eightDaysAgo.toISOString()); // Started 8 days ago or more

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response("Database query failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!subscriptionsToRemind || subscriptionsToRemind.length === 0) {
      return new Response(
        JSON.stringify({ message: "No trials to remind", count: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];
    
    for (const subscription of subscriptionsToRemind) {
      const clinic = subscription.clinic;
      if (!clinic || !clinic.email) {
        console.log(`Skipping subscription ${subscription.id} - no clinic email`);
        continue;
      }

      // Check if we already sent a reminder by looking at stripe_events
      const { data: existingReminder } = await supabase
        .from("stripe_events")
        .select("id")
        .eq("stripe_subscription_id", subscription.stripe_subscription_id)
        .eq("type", "trial_reminder_sent")
        .single();

      if (existingReminder) {
        console.log(`Reminder already sent for subscription ${subscription.stripe_subscription_id}`);
        continue;
      }

      // Generate checkout URL for this clinic
      const checkoutUrl = `${APP_URL}/subscribe?clinic_id=${clinic.id}`;
      
      // Send reminder email
      const emailSent = await sendEmail(
        clinic.email,
        "Your Free Trial Ends Soon - Continue Your Subscription",
        generateReminderEmail(clinic.name || "there", checkoutUrl),
        clinic.mailgun_domain
      );

      if (emailSent) {
        // Log the reminder in stripe_events table
        await supabase
          .from("stripe_events")
          .insert({
            event_id: `trial_reminder_${subscription.stripe_subscription_id}_${Date.now()}`,
            type: "trial_reminder_sent",
            payload: {
              clinic_id: clinic.id,
              subscription_id: subscription.id,
              reminder_sent_at: now.toISOString(),
            },
            stripe_subscription_id: subscription.stripe_subscription_id,
            subscription_id: subscription.id,
            summary: `Trial reminder sent to ${clinic.email}`,
          });

        results.push({
          subscription_id: subscription.stripe_subscription_id,
          clinic_name: clinic.name,
          email: clinic.email,
          status: "sent",
        });
      } else {
        results.push({
          subscription_id: subscription.stripe_subscription_id,
          clinic_name: clinic.name,
          email: clinic.email,
          status: "failed",
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Trial reminders processed",
        total_processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Trial reminder error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});