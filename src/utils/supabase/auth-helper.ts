// utils/supabase/auth-helper.ts
import { createClient } from './config/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User } from '@/interfaces/services_type';
import { clearAll, setAccessToken } from '@/helpers/storage-helper';
import { setUserData } from './user-helper';

const supabase = createClient();

/**
 * Sign in with email and password
 */
export const signInWithPassword = async (email: string, password: string): Promise<{ user: User, token: string }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('Authentication failed');

    // Get user profile data
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) throw userError;

    // Cache data in localStorage
    setAccessToken(data.session.access_token);
    await setUserData(userData as User);

    return {
      user: userData as User,
      token: data.session.access_token
    };
  } catch (error: any) {
    console.error('Login error:', error.message);
    throw error;
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (
  name: string,
  email: string,
  password: string
): Promise<{ user: SupabaseUser | null; session: Session | null }> => {
  try {
    // Check if user exists in the `user` table
    const { data: existingUser, error: userCheckError } = await supabase
      .from('user')
      .select('id')
      .eq('email', email)
      .single();

    if (userCheckError === null && existingUser) {
      const customError = new Error('An account with this email already exists. Please login instead.');
      customError.name = 'ACCOUNT_EXISTS';
      throw customError;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');

    // Insert user profile in your user table
    const { error: insertError } = await supabase.from('user').insert([
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
    console.error('Signup error:', error.message);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<boolean> => {
  try {
    console.log("control before signout healper supabase")
    const { error } = await supabase.auth.signOut();
    console.log("control after signout healper supabase")
    if (error) throw error;
    clearAll();
    return true
  } catch (error: any) {
    console.error('Logout error:', error.message);
    throw error;
  }
};

/**
 * Resend OTP verification
 */
export const resendOtp = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Resend OTP error:', error.message);
    throw error;
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (email: string, otp: string): Promise<void> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: 'email',
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('OTP verification error:', error.message);
    throw error;
  }
};

/**
 * Password reset request
 */
export const resetPasswordRequest = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  } catch (error: any) {
    console.error('Forgot password error:', error.message);
    throw error;
  }
};

/**
 * Update user password
 */
export const updatePassword = async (password: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password
    });
    if (error) throw error;
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    throw error;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
};

/**
 * Set up authentication state change listener
 */
export const setupAuthListener = (
  onSignIn: (user: User, token: string) => void,
  onSignOut: () => void
): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          // Get full user data from user table
          const { data } = await supabase
            .from('user')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            const userData = data as User;
            setAccessToken(session.access_token);
            await setUserData(userData);
            onSignIn(userData, session.access_token);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        clearAll();
        onSignOut();
      }
    }
  );

  return () => {
    subscription.unsubscribe();
  };
};