// utils/supabase/auth-helper.ts
import { clearAll, setAccessToken } from "@/helpers/storage-helper";
import { SuccessToast } from "@/helpers/toast";
import type { User } from "@/interfaces/services_type";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "./config/client";
import { setUserData } from "./user-helper";

const supabase = createClient();

/**
 * Sign in with email and password
 */
export const signInWithPassword = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error("Authentication failed");

    // Get user profile data
    const { data: userData, error: userError } = await supabase.from("user").select("*").eq("id", data.user.id).single();

    if (userError) throw userError;

    // Cache data in localStorage
    setAccessToken(data.session.access_token);
    await setUserData(userData as User);

    return {
      user: userData as User,
      token: data.session.access_token,
    };
  } catch (error: any) {
    console.error("Login error:", error.message);
    throw error;
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (
  name: string,
  email: string,
  password: string,
): Promise<{ user: SupabaseUser | null; session: Session | null }> => {
  try {
    // Check if user exists in the `user` table
    const { data: existingUser, error: userCheckError } = await supabase.from("user").select("id").eq("email", email).single();

    if (userCheckError === null && existingUser) {
      const customError = new Error("An account with this email already exists. Please login instead.");
      customError.name = "ACCOUNT_EXISTS";
      throw customError;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Signup failed");

    // Insert user profile in your user table
    const { error: insertError } = await supabase.from("user").insert([
      {
        id: data.user.id,
        name,
        email,
        is_email_verified: false,
      },
    ]);

    if (insertError) throw insertError;
    return data;
  } catch (error: any) {
    console.error("Signup error:", error.message);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearAll();
    return true;
  } catch (error: any) {
    console.error("Logout error:", error.message);
    throw error;
  }
};

/**
 * Resend OTP verification
 */
export const resendOtp = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
    });

    if (error) throw error;
  } catch (error: any) {
    console.error("Resend OTP error:", error.message);
    throw error;
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (email: string, otp: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: "email",
    });

    if (error) throw error;
  } catch (error: any) {
    console.error("OTP verification error:", error.message);
    throw error;
  }
};

/**
 * Password reset request
 */
export const resetPasswordRequest = async (email: string): Promise<void> => {
  try {
    // Check email in a public table you can access
    const { data: user, error: userCheckError } = await supabase.from("user").select("id").eq("email", email).single();

    if (!user || userCheckError) {
      throw new Error("No account exists with this email.");
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_URL}/forgot-password`,
    });

    if (resetError) {
      throw resetError;
    }
  } catch (error: any) {
    console.error(`Forgot password error: ${error.message}`);
    throw error;
  }
};

/**
 * Update user password
 */
export const updatePassword = async (password: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    if (error) throw error;
  } catch (error: any) {
    console.error("Reset password error:", error.message);
    throw error;
  }
};

export const updateLoggedStatus = async (newPassword: string) => {
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    data: {
      logged_first: false, // ✅ prevent future redirects
    },
  });

  if (updateError) {
    console.error("Error resetting password: " + updateError.message);
  } else {
    SuccessToast("Moving to Dashboard"); // redirect after success
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return false;
  }
};
export const getSupabaseSession = async (): Promise<Session> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw { message: "User not authenticated" };
    return session;
  } catch (error) {
    console.error("Error checking authentication status:", error);
    throw error;
  }
};

/**
 * Set up authentication state change listener
 */

export const setupAuthListener = (onSignIn: (_user: User, _token: string) => void, onSignOut: () => void): (() => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session) {
        // Wrap the database call in setTimeout to make it non-blocking
        // This prevents the auth state change callback from blocking the event loop
        setTimeout(async () => {
          try {
            // Get full user data from user table
            const { data } = await supabase.from("user").select("*").eq("id", session.user.id).single();

            if (data) {
              const userData = data as User;
              setAccessToken(session.access_token);
              await setUserData(userData);
              onSignIn(userData, session.access_token);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            // Handle error appropriately - maybe call onSignOut or retry
          }
        }, 0);
      }
    } else if (event === "SIGNED_OUT") {
      // Also wrap this in setTimeout to be consistent
      setTimeout(() => {
        clearAll();
        onSignOut();
      }, 0);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const checkUserStatus = async (user_id: string): Promise<boolean> => {
  try {
    // Fetch user data
    const { data: user, error } = await supabase.from("user_clinic").select("is_active").eq("user_id", user_id).maybeSingle();
    if (error) throw error;
    if (!user) {
      return false; // User has no clinic relationship = inactive
    }
    return user.is_active; // Return true if user is active, false otherwise
  } catch (error: any) {
    console.error("Error checking user status:", error.message);
    return false; // Return false on error (safe default for middleware)
  }
};