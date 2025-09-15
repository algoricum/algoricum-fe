import { createClient } from "@/utils/supabase/config/client";

const getLeadSourceId = async (sourceName: string) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("lead_source").select("id").eq("name", sourceName).single();
  if (error) {
    throw new Error(error.message);
  }
  return data?.id;
};

export default getLeadSourceId;
