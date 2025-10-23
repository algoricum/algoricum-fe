"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { SUPABASE_URL } from "@/constants/integration-constants";
import { useEffect } from "react";

export default function DashboardPage() {
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);

      if ([...params].length === 0) {
        console.log("No params found, not redirecting");
        return;
      }

      const callbackUrl = `${SUPABASE_URL}/functions/v1/google-form-integration/oauth/callback?${params.toString()}`;

      window.location.href = callbackUrl;
    };
    run();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner message="Loading ..." size="lg" />
    </div>
  );
}
