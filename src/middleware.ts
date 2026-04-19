import { checkUserStatus } from "@/utils/supabase/auth-helper";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "./utils/supabase/config/middleware";
// List of public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/auth/callback",
  "/auth/oauth-redirect",
  "/schedule-meeting",
  "/api/namecheap-dns",
  "/inactive",
  "/unauthorized",
  "/unsubscribe-lead", // Add unauthorized page to public routes
  "/redirect-form", // OAuth redirect handler
  "/redirect-lead", // Lead form redirect handler
  "/hubspot-setup", // Hubspot setup guide page
];
// Paths that should redirect to dashboard if already authenticated
const authRoutes = ["/login", "/signup", "/forgot-password"];
// Routes that are restricted for staff users
// const staffRestrictedRoutes = ["/staff", "/billing"];
async function getRestrictedRoutes(supabase: SupabaseClient, userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("user_clinic")
      // This tells postgREST to include the role row (FK role_id) with permissions
      .select("role:role_id(permissions)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("getRestrictedRoutes: db error", error);
      return [];
    }
    // data.role.permissions should be a JS object
    const perms = (data as any)?.role?.permissions;
    if (!perms) return [];
    const routes = Array.isArray(perms.restricted_routes) ? perms.restricted_routes : [];
    return routes.filter((r: any) => typeof r === "string");
  } catch (err) {
    console.error("getRestrictedRoutes error", err);
    return [];
  }
}
export async function middleware(request: NextRequest) {
  try {
    // Get the pathname from the URL
    const { pathname } = request.nextUrl;
    // Add null check for pathname
    if (!pathname) {
      return NextResponse.next();
    }
    // Create helper function for redirects
    const redirect = (path: string) => {
      return NextResponse.redirect(new URL(path, request.url));
    };
    // Handle homepage separately - always redirect
    if (pathname === "/") {
      return redirect("/login");
    }
    // Check if this is a public route or auth route
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
    const isOnboardingRoute = pathname === "/onboarding";
    const isChangePasswordRoute = pathname === "/change-password";
    const isInactiveRoute = pathname === "/inactive";
    const isUnauthorizedRoute = pathname === "/unauthorized";
    // Create Supabase client with proper error handling
    const { supabase, response } = createClient(request);
    // Add timeout to prevent hanging
    const userPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 5000));
    let user, userError;
    try {
      const result = await Promise.race([userPromise, timeoutPromise]);
      ({
        data: { user },
        error: userError,
      } = result as any);
    } catch (error) {
      console.error("Auth timeout or error:", error);
      // If auth check fails, treat as unauthenticated
      user = null;
      userError = error;
    }
    // CASE 1: User is not logged in (homepage already handled above)
    if (!user || userError) {
      // Allow OAuth callbacks through even if session is not yet restored
      // This happens when Google, HubSpot, Facebook etc redirect back after OAuth
      // Detect any OAuth callback by checking for any param ending in _status
      const isOAuthCallback = isOnboardingRoute && [...request.nextUrl.searchParams.keys()].some(key =>
        key.endsWith("_status")
      );
      const isPaymentCallback = isOnboardingRoute && request.nextUrl.searchParams.has("payment");
      if (isOAuthCallback || isPaymentCallback) {
        return response;
      }

      // If trying to access a protected route, redirect to login
      if (!isPublicRoute) {
        const redirectUrl = new URL("/login", request.url);
        redirectUrl.searchParams.set("redirectUrl", pathname);
        return NextResponse.redirect(redirectUrl);
      }
      // If not logged in and on public route, allow access
      return response;
    }
    // Check email verification
    if (!user?.email_confirmed_at) {
      return redirect("/verify-otp");
    }
    let isUserActive = true;
    try {
      const activeCheckPromise = checkUserStatus(user.id);
      const activeTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("User status check timeout")), 3000));
      isUserActive = (await Promise.race([activeCheckPromise, activeTimeoutPromise])) as boolean;
    } catch (error) {
      console.error("User status check timeout or error:", error);
      // If status check fails, assume user is active to avoid blocking
      isUserActive = true;
    }
    const staffRestrictedRoutes = await getRestrictedRoutes(supabase, user.id);
    const isStaffRestrictedRoute = staffRestrictedRoutes.some(route => pathname.startsWith(route));
    // If user is inactive and not on inactive page, redirect to inactive
    if (!isUserActive && !isInactiveRoute) {
      return redirect("/inactive");
    }
    // If user is active but on inactive page, redirect to dashboard
    if (isUserActive && isInactiveRoute) {
      return redirect("/dashboard");
    }
    if (isUserActive) {
      // Get user role information
      const loggedFirst = user.user_metadata?.logged_first;
      const isStaff = user.user_metadata?.is_staff;
      // CASE 2: Check staff access restrictions for protected routes
      if (isStaff && isStaffRestrictedRoute && !isUnauthorizedRoute) {
        return redirect("/unauthorized");
      }
      // CASE 3: Handle staff first-time login
      if (loggedFirst === true && isStaff && !isChangePasswordRoute) {
        return redirect("/change-password");
      }
      // If user is on an auth route (except reset-password for staff), redirect to dashboard
      if (isAuthRoute && !(isStaff && loggedFirst === true)) {
        return redirect("/dashboard");
      }
      // Check if user has an associated clinic with timeout
      let hasClinic = false;
      try {
        const clinicPromise = checkIfUserHasClinic(supabase, user.id);
        const clinicTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Clinic check timeout")), 3000));
        hasClinic = (await Promise.race([clinicPromise, clinicTimeoutPromise])) as boolean;
      } catch (error) {
        console.error("Clinic check timeout or error:", error);
        // If clinic check fails, allow to continue but log the error
        hasClinic = false;
      }
      // Handle onboarding logic
      // Don't redirect to dashboard if this is an OAuth callback - let the page handle it
      // Detect any OAuth return by checking for any param ending in _status
      const isOAuthReturn = isOnboardingRoute && [...request.nextUrl.searchParams.keys()].some(key =>
        key.endsWith("_status")
      );
      const isPaymentReturn = isOnboardingRoute && request.nextUrl.searchParams.has("payment");
      if (isOnboardingRoute && hasClinic && !isOAuthReturn && !isPaymentReturn) {
        return redirect("/dashboard");
      }
      // If no clinic associated, redirect to onboarding (except for onboarding page and staff first-time)
      if (
        !hasClinic &&
        pathname !== "/onboarding" &&
        pathname !== "/redirect-form" &&
        pathname !== "/redirect-lead" &&
        !isChangePasswordRoute &&
        !(isStaff && loggedFirst === true) &&
        !isUnauthorizedRoute
      ) {
        // Preserve OAuth callback parameters when redirecting to onboarding
        const searchParams = request.nextUrl.searchParams;
        const oauthParams = new URLSearchParams();

        // Preserve important OAuth status parameters
        [
          "google_form_status",
          "google_lead_form_status",
          "hubspot_status",
          "pipedrive_status",
          "typeform_status",
          "facebook_lead_form_status",
          "connection_id",
          "account_name",
          "contact_count",
          "deal_count",
          "error_message",
        ].forEach(param => {
          const value = searchParams.get(param);
          if (value) oauthParams.set(param, value);
        });

        const onboardingUrl = new URL("/onboarding", request.url);
        if (oauthParams.toString()) {
          onboardingUrl.search = oauthParams.toString();
        }

        return NextResponse.redirect(onboardingUrl);
      }
      // If user is on homepage, redirect based on clinic status
      if (pathname === "/") {
        if (hasClinic) {
          return redirect("/dashboard");
        } else {
          // No clinic, send to onboarding (unless staff first-time)
          if (!(isStaff && loggedFirst === true)) {
            return redirect("/onboarding");
          }
        }
      }
      // If user has clinic and is on other public routes, redirect to dashboard
      // But don't redirect staff on first login from change-password or unauthorized page
      // Also don't redirect from OAuth callback handlers or hubspot setup page
      if (
        isPublicRoute &&
        hasClinic &&
        !(isStaff && loggedFirst === true && isChangePasswordRoute) &&
        !isUnauthorizedRoute &&
        pathname !== "/redirect-form" &&
        pathname !== "/redirect-lead" &&
        pathname !== "/hubspot-setup"
      ) {
        return redirect("/dashboard");
      }
    }
    // For all other cases allow access
    return response;
  } catch (error) {
    console.error("Middleware error:", error);
    // On any critical error, continue with minimal response
    return NextResponse.next();
  }
}
// Helper function to check if user has an associated clinic
async function checkIfUserHasClinic(supabase: SupabaseClient<any, "public", any>, userId: string): Promise<boolean> {
  try {
    // Get the user's most recent active clinic link
    const { data: userClinicData, error: clinicUserError } = await supabase
      .from("user_clinic")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // No clinic relationship found
    if (clinicUserError || !userClinicData) {
      return false;
    }
    // Fetch the clinic data
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinic")
      .select("id, email")
      .eq("id", userClinicData.clinic_id)
      .maybeSingle();
    // Return false if no clinic found, there's an error, or email is empty
    if (clinicError || !clinicData || !clinicData.email || clinicData.email.trim() === "") {
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error checking clinic association:", error);
    return false;
  }
}
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)"],
};
