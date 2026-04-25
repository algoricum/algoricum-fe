"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { SUPABASE_URL } from "@/constants/integration-constants";
import { useEffect } from "react";

export default function DashboardPage() {
  useEffect(() => {
    console.log("🔄 Redirect-form page loaded!");
    console.log("Current URL:", window.location.href);
    console.log("Current search params:", window.location.search);

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      console.log("Redirect-form params:", [...params]);
      console.log("SUPABASE_URL:", SUPABASE_URL);

      if ([...params].length === 0) {
        console.log("No params found, not redirecting");
        return;
      }

      // Save session to localStorage before leaving app domain
      // so it can be restored when we come back from Supabase domain
      try {
        const { createClient } = await import("@/utils/supabase/config/client");
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          localStorage.setItem("pre_oauth_access_token", data.session.access_token);
          localStorage.setItem("pre_oauth_refresh_token", data.session.refresh_token);
          console.log("✅ Session saved before OAuth redirect");
        }
      } catch (e) {
        console.warn("Could not save session before OAuth redirect:", e);
      }

      const callbackUrl = `${SUPABASE_URL}/functions/v1/google-form-integration/oauth/callback?${params.toString()}`;
      console.log("Redirecting to:", callbackUrl);

      // allow event loop to complete fetch before navigation
      window.location.href = callbackUrl;
    };
    run();
  }, []);

  // Loading/UI state

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner message="Loading ..." size="lg" />
    </div>
  );
}
