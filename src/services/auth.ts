// src/services/authService.ts
import { User, Clinic } from '@/interfaces/services_type';
import { createClient } from '@/utils/supabase/client';
import { Session } from '@supabase/supabase-js';
import { User as SupabaseUser } from '@supabase/auth-js';
// Define keys for localStorage with namespace
const STORAGE_PREFIX = 'algoricum_';
const ACCESS_TOKEN_KEY = `${STORAGE_PREFIX}access_token`;
const USER_DATA_KEY = `${STORAGE_PREFIX}user_data`;
const CLINIC_DATA_KEY = `${STORAGE_PREFIX}clinic_data`;
const CLINIC_API_KEY = `${STORAGE_PREFIX}clinic_api_key`;
const supabase = createClient();
// ===== TOKEN MANAGEMENT =====
export const setAccessToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
};

export const getAccessToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
};

// ===== USER DATA MANAGEMENT =====
export const setUserData = async (userData: User) => {
  if (typeof window !== 'undefined') {
    // Store in localStorage for quick access
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }

  // Update in Supabase if this is an update operation
  try {
    if (userData.id) {
      const { error } = await supabase
        .from('user')
        .update({
          name: userData.name,
          email: userData.email,
          is_email_verified: userData.is_email_verified,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      if (error) {
        console.error('Error updating user data in Supabase:', error);
      }
    }
  } catch (error) {
    console.error('Error in Supabase user update operation:', error);
  }
};

export const getUserData = async (): Promise<User | null> => {
  // First try to get from localStorage for performance
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem(USER_DATA_KEY);
    if (userData) {
      try {
        return JSON.parse(userData) as User;
      } catch (error) {
        console.error('Failed to parse user data from localStorage:', error);
      }
    }
  }

  // If not in localStorage or parsing failed, get from Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get user profile data from user table
      const { data } = await supabase
        .from('user')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        // Store in localStorage for future quick access
        const userData = data as User;
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        }
        return userData;
      }
    }
  } catch (error) {
    console.error('Error fetching user data from Supabase:', error);
  }

  return null;
};

// ===== CLINIC DATA MANAGEMENT =====
export const setClinicData = async (clinicData: Clinic) => {
  if (typeof window !== 'undefined') {
    // Store in localStorage for quick access
    localStorage.setItem(CLINIC_DATA_KEY, JSON.stringify(clinicData));
  }
};

export const getClinicData = async (): Promise<Clinic | null> => {
  // First try to get from localStorage for performance
  if (typeof window !== 'undefined') {
    const clinicData = localStorage.getItem(CLINIC_DATA_KEY);
    if (clinicData) {
      try {
        return JSON.parse(clinicData) as Clinic;
      } catch (error) {
        console.error('Failed to parse clinic data from localStorage:', error);
      }
    }
  }

  // If not in localStorage or parsing failed, get from Supabase
  try {
    const userData = await getUserData();

    if (userData) {
      // Get user-clinic mapping
      const { data: userClinicData } = await supabase
        .from('user_clinic')
        .select('clinic_id')
        .eq('user_id', userData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (userClinicData) {
        // Get clinic data
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('*')
          .eq('id', userClinicData.clinic_id)
          .single();

        if (clinicData) {
          // Store in localStorage for future quick access
          const clinic = clinicData as Clinic;
          if (typeof window !== 'undefined') {
            localStorage.setItem(CLINIC_DATA_KEY, JSON.stringify(clinic));
          }
          return clinic;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching clinic data from Supabase:', error);
  }

  return null;
};

// ===== AUTHENTICATION METHODS =====
export const loginUser = async (email: string, password: string): Promise<{ user: User, token: string }> => {

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.session || !data.user) {
      throw new Error('Authentication failed');
    }

    // Get user profile data
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      throw userError;
    }

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

export const signupUser = async (name: string, email: string, password: string): Promise<{ user: SupabaseUser | null; session: Session | null; }> => {
  try {
    const { data: existingUserData, error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: 'temp-password-to-check-existence', // This will fail if user exists but with wrong password
    });
    if (checkError) {
      if (checkError.message?.includes('Invalid login credentials')) {
        throw new Error('ACCOUNT_EXISTS');
      }
      if (!checkError.message?.includes('user not found')) {
        throw checkError;
      }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Signup failed');
    }

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + 120 * 60000);
    // Create user record in user table
    const { error: userError } = await supabase
      .from('user')
      .insert([{
        id: data.user.id,
        name,
        email,
        is_email_verified: false,
        otp,
        otp_expires_at: otpExpiresAt.toISOString()
      }]);

    if (userError) {
      throw userError;
    }

    // In a real app, you would send the OTP via email here
    return data
  } catch (error: any) {
    console.error('Signup error:', error.message);
    if (error.message === 'ACCOUNT_EXISTS') {
      const customError = new Error('An account with this email already exists. Please login instead.');
      customError.name = 'ACCOUNT_EXISTS';
      throw customError;
    }
    throw error;
  }
};

export const resendOtp = async (email: string): Promise<void> => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create date in UTC and add 120 minutes
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + 120 * 60000);

    // Store as ISO string
    const { error } = await supabase
      .from('user')
      .update({
        otp,
        otp_expires_at: otpExpiresAt.toISOString()
      })
      .eq('email', email);

    if (error) throw error;

  } catch (error: any) {
    console.error('Resend OTP error:', error.message);
    throw error;
  }
};

export const verifyOtp = async (email: string, otp: string): Promise<void> => {
  try {
    const { data: userData, error: fetchError } = await supabase
      .from('user')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .single();

    if (fetchError || !userData) {
      throw new Error('Invalid OTP');
    }

    // Parse the ISO string to create a date object
    const otpExpiresAt = new Date(userData.otp_expires_at);
    const now = new Date();

    if (otpExpiresAt < now) {
      throw new Error('OTP has expired');
    }

    // Update user as verified
    const { error: updateError } = await supabase
      .from('user')
      .update({
        is_email_verified: true,
        otp: null,
        otp_expires_at: null
      })
      .eq('email', email);

    if (updateError) throw updateError;

  } catch (error: any) {
    console.error('OTP verification error:', error.message);
    throw error;
  }
};

export const forgotPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Forgot password error:', error.message);
    throw error;
  }
};

export const resetPassword = async (password: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Logout error:', error.message);
    throw error;
  }
};

// ===== CLEAR FUNCTIONS =====
export const clearClinicData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CLINIC_DATA_KEY);
  }
};

export const clearUserData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_DATA_KEY);
  }
};
export const clearApiKeyData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CLINIC_API_KEY);
  }
};

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const clearAll = () => {
  clearTokens();
  clearApiKeyData();
  clearUserData();
  clearClinicData();
};

// ===== AUTHENTICATION STATUS =====
export const isAuthenticated = async (): Promise<boolean> => {
  // First, check token in localStorage for quick response
  if (getAccessToken()) {
    // Verify with Supabase in the background
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  return false;
};

// ===== SUPABASE LISTENER =====
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

            // Update localStorage
            setAccessToken(session.access_token);
            await setUserData(userData);

            // Call callback
            onSignIn(userData, session.access_token);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear localStorage
        clearAll();

        // Call callback
        onSignOut();
      }
    }
  );

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};