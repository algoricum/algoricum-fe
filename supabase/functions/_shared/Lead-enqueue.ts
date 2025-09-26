import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export async function enqueueLead(leads: unknown[], clinicId: string) {
  const payload = {
    task: "process_lead",
    data: {
      Lead_data: leads,
    },
    clinic_id: clinicId,
  };

  const { data, error } = await supabase.rpc("pgmq_send", {
    queue_name: "leads_queue",
    message: payload,
  });

  if (error) throw error;
  return data;
}
export function chunkArray(array: any[], size: number) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
