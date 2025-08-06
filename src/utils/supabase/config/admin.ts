// utils/supabase/server-admin.js
import { createClient } from "@supabase/supabase-js";

// Server-side admin client with service role key
export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key (server-side only)
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
};
