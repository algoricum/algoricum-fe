"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { useEffect } from "react";

export default function DashboardPage() {
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      if ([...params].length === 0) return;

      // allow event loop to complete fetch before navigation
      window.location.href = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-leads/oauth/callback?${params.toString()}`;
    };
    run();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner message="Loading ..." size="lg" />
    </div>
  );
}
