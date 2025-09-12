// supabase/functions/leads-worker/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // must use service role
);

const QUEUE = "leads_queue";
const BATCH_SIZE = 20; // how many messages per run
const VISIBILITY_TIMEOUT = 30; // seconds

serve(async () => {
  try {
    // Step 1: read messages
    const { data: rows, error: readError } = await supabase.rpc("pgmq_read", {
      queue_name: QUEUE,
      qty: BATCH_SIZE,
      vt: VISIBILITY_TIMEOUT,
    });

    if (readError) throw readError;
    if (!rows || rows.length === 0) {
      return new Response("Queue empty", { status: 200 });
    }

    for (const msg of rows) {
      const msgId = msg.msg_id as number;
      const payload = typeof msg.message === "string" ? JSON.parse(msg.message) : msg.message;

      try {
        // Step 2: process payload
        console.log("Processing message", msgId, payload.data.Lead_data);
        // >>> Your business logic here <<<
        // Example: send email, call API, etc.
        // inside your for-loop:
        const response = await fetch("https://eypitkzntyiyvwrndkgy.supabase.co/functions/v1/GPT-extractor-function", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({ data: payload.data.Lead_data }),
        });

        const result = await response.json();
        console.log("Extractor response:", result);
        const { data: source } = await supabase.from("lead_source").select("id").eq("name", "Others").single();
        const rows = result.data.map((p: any) => ({
          clinic_id: payload.data.clinic_id,
          source_id: source.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.bio?.phone_number || null,
          form_data: p,
        }));
        const { error } = await supabase.from("lead").upsert(rows, { onConflict: ["email", "clinic_id"] });
        if (error) throw new Error(`Insert failed: ${error.message}`);
        // Step 3: delete after success
        const { error: delError } = await supabase.rpc("pgmq_delete", {
          queue_name: QUEUE,
          msg_id: msgId,
        });
        if (delError) console.error("Delete error", delError);
      } catch (e) {
        console.error("Job failed", msgId, e);
        // Do not delete → will be retried after visibility timeout
      }
    }

    return new Response("Processed batch", { status: 200 });
  } catch (err) {
    console.error("Worker error", err);
    return new Response("Error", { status: 500 });
  }
});
