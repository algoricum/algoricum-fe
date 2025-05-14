// hooks/useClinicCheck.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getUserActiveClinic } from '@/utils/supabase/clinic-relationships';

export function useClinicCheck() {
  return {
    checkAndRedirectIfNoClinic: async (
      supabase: SupabaseClient,
      userId: string,
      router: { push: (url: string) => void },
      targetUrl: string = '/dashboard',
      setClinicData?: (data: any) => void
    ) => {
      try {
        // Get the user's active clinic
        const clinicData = await getUserActiveClinic(userId);

        // If no clinic found, redirect to onboarding
        if (!clinicData) {
          router.push("/onboarding");
          return true; // Redirect performed
        }

        // Store clinic data if handler provided
        if (setClinicData && clinicData) {
          setClinicData(clinicData);
        }

        // If there's a target URL, redirect there
        if (targetUrl) {
          router.push(targetUrl);
          return true; // Redirect performed
        }

        return false; // No redirect performed (clinic exists)
      } catch (error) {
        console.error("Error checking clinic association:", error);
        // On error, safest to redirect to onboarding
        router.push("/onboarding");
        return true; // Redirect performed
      }
    }
  };
}

export async function ensureUserHasClinic(
  supabase: SupabaseClient,
  userId: string,
  redirectFunction: (url: string) => void,
  targetUrl: string = '/dashboard'
): Promise<boolean> {
  try {
    // Get the user's active clinic
    const clinicData = await getUserActiveClinic(userId);

    // If no clinic found, redirect to onboarding
    if (!clinicData) {
      redirectFunction("/onboarding");
      return true; // Redirect performed
    }

    // If a valid clinic is found and there's a target URL, redirect there
    if (targetUrl) {
      redirectFunction(targetUrl);
      return true; // Redirect performed
    }

    return false; // No redirect performed (clinic exists)
  } catch (error) {
    console.error("Error checking clinic association:", error);
    // On error, safest to redirect to onboarding
    redirectFunction("/onboarding");
    return true; // Redirect performed
  }
}