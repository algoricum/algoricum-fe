// utils/supabase/server-admin.js
import { createClient } from "@supabase/supabase-js";

// Server-side admin client with service role key
export const createAdminClient = () => {
  // Server-side admin client
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
};
