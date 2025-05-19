import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/config/middleware';
import { SupabaseClient } from '@supabase/supabase-js';

// List of public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-otp',
  '/auth/callback',
  '/auth/oauth-redirect'
];

// Paths that should redirect to dashboard if already authenticated
const authRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password'
];

export async function middleware(request: NextRequest) {
  // Update the response with the Supabase session
  const response = createClient(request);

  try {
  
    // Get the pathname from the URL
    const { pathname } = request.nextUrl;
    // Create helper function for redirects
    const redirect = (path: string) => {
      return NextResponse.redirect(new URL(path, request.url));
    };

    // Check if this is a public route or auth route
    const isPublicRoute = publicRoutes.some(route =>
      pathname.startsWith(route) || pathname === '/'
    );

    const isAuthRoute = authRoutes.some(route =>
      pathname.startsWith(route)
    );

    const isOnboardingRoute = pathname === '/onboarding';

    const { createServerClient } = await import('@supabase/ssr');

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // CASE 1: User is not logged in
    if (!user || userError) {
      // If trying to access a protected route, redirect to login
      if (!isPublicRoute) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirectUrl', pathname);
        return NextResponse.redirect(redirectUrl);
      }
      // If not logged in and on public route, allow access
      return response;
    }


    if (!user?.email_confirmed_at) {
      // Still unverified, send to OTP page
      return redirect('/verify-otp');
    }

    // If user is on an auth route, redirect to dashboard
    if (isAuthRoute) {
      return redirect('/dashboard');
    }
    // Skip clinic check for the onboarding route itself

    // Check if user has an associated clinic
    const hasClinic = await checkIfUserHasClinic(supabase, user.id);
    if (isOnboardingRoute && hasClinic) {
      return redirect('/dashboard');
    }
    // If no clinic associated, redirect to onboarding
    if (!hasClinic && pathname !== '/onboarding') {
      return redirect('/onboarding');
    }

    // If user has clinic and is on a public route (like homepage), redirect to dashboard
    if (isPublicRoute) {
      return redirect('/dashboard');
    }

    // For all other cases (logged in, has clinic, private route) allow access
    return response;
  } catch (e) {
    console.error("Middleware error:", e);
    // If there's an error, continue with the response
    return response;
  }
}

// Helper function to check if user has an associated clinic
async function checkIfUserHasClinic(supabase: SupabaseClient<any, "public", any>, userId: string) {
  try {
    // Get clinic_id from user_clinic
    const { data: userClinicData, error: clinicUserError } = await supabase
      .from("user_clinic")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // No clinic found
    if (clinicUserError || !userClinicData) {
      return false;
    }

    // Verify clinic exists
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinic")
      .select("id")
      .eq("id", userClinicData.clinic_id)
      .single();

    return !(clinicError || !clinicData);
  } catch (error) {
    console.error("Error checking clinic association:", error);
    return false;
  }
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    // Match all routes except for these:
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};