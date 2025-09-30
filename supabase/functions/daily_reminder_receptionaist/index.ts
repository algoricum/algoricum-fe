// supabase/functions/send-receptionist-emails/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import "https://deno.land/x/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

// Mailgun constants
const MAILGUN_DOMAIN = "algoricum.com";
const MAILGUN_KEY = Deno.env.get("MAILGUN_API_KEY");

serve(async () => {
  // 1. Fetch receptionists whose local time = 3PM (with owner emails)
  const { data: users, error } = await supabase.rpc("get_receptionists_at_3pm");
  console.warn(users);

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
    const { user_email, clinic_name, from_email, clinic_id, owner_email } = row;

    // Build email parameters
    const emailParams: Record<string, string> = {
      from: `Algoricum <no-reply@algoricum.com>`,
      to: user_email,
      subject: `Stay on top of today's patient leads`,
      text: `Hi ${clinic_name},
To keep your pipeline accurate, remember to enter any new inquiries from today - calls, walk-ins, or manual uploads.

Add new leads: https://app.algoricum.com

Algoricum`,
      html: `<p>Hi ${clinic_name},</p>
<p>To keep your pipeline accurate, remember to enter any new inquiries from today - calls, walk-ins, or manual uploads.</p>
<p><a href="https://app.algoricum.com">Add new leads</a></p>
<p>Algoricum</p>`,
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
      console.log(`Sent mail to ${user_email}${emailParams.cc ? ` (CC: ${emailParams.cc})` : ""} from ${from_email}`);
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
