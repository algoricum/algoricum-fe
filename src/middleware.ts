import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./utils/supabase/config/middleware";

// List of public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-otp",
  "/auth/callback",
  "/auth/oauth-redirect",
  "/schedule-meeting",,
  '/api/namecheap-dns'
];

// Paths that should redirect to dashboard if already authenticated
const authRoutes = ["/login", "/signup", "/forgot-password"];

export async function middleware(request: NextRequest) {
  try {
    // Get the pathname from the URL
    const { pathname } = request.nextUrl;

    // Create helper function for redirects
    const redirect = (path: string) => {
      return NextResponse.redirect(new URL(path, request.url));
    };

    // Check if this is a public route or auth route
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route) || pathname === "/");

    const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

    const isOnboardingRoute = pathname === "/onboarding";
    
    const isChangePasswordRoute = pathname === "/change-password";

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

    // CASE 1: User is not logged in
    if (!user || userError) {
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

    // CASE 2: Handle staff first-time login
    const loggedFirst = user.user_metadata?.logged_first;
    const isStaff = user.user_metadata?.is_staff;

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
    if (isOnboardingRoute && hasClinic) {
      return redirect("/dashboard");
    }

    // If no clinic associated, redirect to onboarding (except for onboarding page and staff first-time)
    if (!hasClinic && pathname !== "/onboarding" && !isChangePasswordRoute && !(isStaff && loggedFirst === true)) {
      return redirect("/onboarding");
    }

    // If user has clinic and is on a public route (like homepage), redirect to dashboard
    // But don't redirect staff on first login from change-password
    if (isPublicRoute && hasClinic && !(isStaff && loggedFirst === true && isChangePasswordRoute)) {
      return redirect("/dashboard");
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
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)']
};
