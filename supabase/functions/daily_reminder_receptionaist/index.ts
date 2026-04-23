// supabase/functions/send-receptionist-emails/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import "https://deno.land/x/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

// Mailgun constants
const MAILGUN_DOMAIN = "algoricum.com";
const MAILGUN_KEY = Deno.env.get("MAILGUN_API_KEY");

// Generate professional reminder email HTML with original content
function generateReminderEmail(clinicName: string, clinic: any, clinic_id: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stay on top of today's patient leads</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #334155;">
                                <p style="margin: 0 0 20px 0; line-height: 1.6;">Hi ${clinicName},</p>
                                <p style="margin: 0 0 20px 0; line-height: 1.6;">Just a quick check-in from your Algoricum AI assistant.</p>
                                <p style="margin: 0 0 20px 0; line-height: 1.6;">Any new inquiries that came in today — calls, walk-ins, or form submissions — need to be in your pipeline so we can follow up right away. The faster a lead hears from you, the better your chances of booking them.</p>
                                <p style="margin: 0 0 8px 0; line-height: 1.6;"><strong>Here's what to do before end of day:</strong></p>
                                <p style="margin: 0 0 6px 0; line-height: 1.6;">- Add any new leads you received manually</p>
                                <p style="margin: 0 0 6px 0; line-height: 1.6;">- Review leads the AI has been following up on</p>
                                <p style="margin: 0 0 20px 0; line-height: 1.6;">- Update statuses for anyone who booked or went cold</p>
                                <p style="margin: 0 0 20px 0; line-height: 1.6;">Your AI assistant is working in the background — but it needs your leads to work with.</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="https://app.algoricum.com" style="display: inline-block; background: #800080; color: white; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; border: none; cursor: pointer;">Review Today's Leads →</a>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Contact Information Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #64748b; text-align: center;">
                                            <strong style="color: #2563eb; font-size: 16px; display: block; margin-bottom: 10px;">${clinic?.name || clinicName}</strong>
                                            ${clinic?.address ? `<div style="margin-bottom: 8px;">${clinic.address}</div>` : ""}
                                            ${clinic?.phone ? `<div style="margin-bottom: 8px;">Phone: <a href="tel:${clinic.phone}" style="color: #2563eb; text-decoration: none;">${clinic.phone}</a></div>` : ""}
                                            ${clinic?.email ? `<div style="margin-bottom: 8px;">Email: <a href="mailto:${clinic.email}" style="color: #2563eb; text-decoration: none;">${clinic.email}</a></div>` : ""}
                                            <div style="margin-top: 15px; font-size: 12px; color: #94a3b8;">
                                                <div>Powered by Algoricum</div>
                                                <div style="margin-top: 10px;">
                                                    <a href="${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe-lead/unsubscribe-daily-remainder?clinic_id=${clinic_id}" 
                                                       style="color: #6b7280; text-decoration: underline; font-size: 11px;">
                                                        Unsubscribe from daily reminders
                                                    </a>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}

serve(async () => {
  // 1. Fetch receptionists whose local time = 3PM (with owner emails)
  const { data: users, error } = await supabase.rpc("get_receptionists_at_3pm");

  if (error) {
    console.error("DB error:", error);
    return new Response("DB error", { status: 500 });
  }

  if (!users || users.length === 0) {
    console.log("No receptionists at 3PM local");
    return new Response("ok");
  }

  // 2. Send mail via Mailgun
  for (const row of users) {
    const { user_email, clinic_name, clinic_id, owner_email } = row;

    // Fetch clinic details for dynamic footer
    const { data: clinic } = await supabase.from("clinics").select("id, name, address, phone, email").eq("id", clinic_id).single();

    // Build email parameters
    const emailParams: Record<string, string> = {
      from: `Algoricum <no-reply@algoricum.com>`,
      to: user_email,
      subject: `Your leads from today — don't let them go cold`,
      text: `Hi ${clinic_name},
To keep your pipeline accurate, remember to enter any new inquiries from today - calls, walk-ins, or manual uploads.

Also, please review today's appointments and update patient statuses accordingly.

Manage Leads & Appointments: https://app.algoricum.com

Algoricum`,
      html: generateReminderEmail(clinic_name, clinic, clinic_id),
    };

    // CC the owner (only if owner email exists and is different from receptionist)
    if (owner_email && owner_email !== user_email) {
      emailParams.cc = owner_email;
    }

    const body = new URLSearchParams(emailParams);

    const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`api:${MAILGUN_KEY}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      console.error("Mailgun error:", await res.text());
    } else {
      console.log(`Sent daily reminder for clinic ${clinic_id}`);
    }

    // --- insert a task ---
    const { error: taskError } = await supabase.from("tasks").insert({
      clinic_id,
      task: "Enter new inquiries (calls, walk-ins, uploads).",
      priority: "medium",
      time: "15:00",
      due_at: new Date().toISOString(),
      is_automated: true,
    });

    if (taskError) {
      console.error("Task insert error:", taskError);
    } else {
      console.log(`Task logged for clinic ${clinic_name}`);
    }
  }

  return new Response("ok");
});
