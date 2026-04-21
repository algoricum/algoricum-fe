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

      const callbackUrl = `${SUPABASE_URL}/functions/v1/google-form-integration/oauth/callback?${params.toString()}`;
      console.log("Calling callback via fetch to preserve session:", callbackUrl);

      try {
        // Use fetch instead of window.location.href to preserve the auth session cookie
        // Direct navigation to supabase.co domain would lose the app.algoricum.com session
        const response = await fetch(callbackUrl, {
          method: "GET",
          redirect: "follow",
          credentials: "include",
        });

        // The edge function redirects to the final destination URL
        // Get the final URL after following redirects
        const finalUrl = response.url;
        console.log("Final redirect URL:", finalUrl);

        if (finalUrl && finalUrl !== callbackUrl) {
          window.location.href = finalUrl;
        } else {
          // Fallback - extract redirect from response if available
          const text = await response.text();
          console.log("Response text:", text);
          window.location.href = "/onboarding?google_form_status=error";
        }
      } catch (error) {
        console.error("Error calling callback:", error);
        // Fallback to direct redirect
        window.location.href = callbackUrl;
      }
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
