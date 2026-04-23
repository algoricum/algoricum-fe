"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { SUPABASE_URL } from "@/constants/integration-constants";
import { useEffect } from "react";

export default function RedirectFormPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if ([...params].length === 0) {
      return;
    }

    // Immediately clear the URL to prevent Supabase auth client from
    // intercepting the OAuth `code` param and attempting a PKCE exchange
    const paramsString = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname);

    // Now navigate to the Edge Function callback with the original params
    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-form-integration/oauth/callback?${paramsString}`;
    window.location.href = callbackUrl;
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner message="Loading ..." size="lg" />
    </div>
  );
}
