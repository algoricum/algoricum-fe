// src/hooks/useAuth.ts
import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { 
  fetchCurrentUser,
  loginUser,
  signupUser,
  verifyOtp,
  resendOtp,
  resetPassword,
  clearError
} from '@/redux/slices/user.slice';
import { RootState } from '@/redux/store';
import { User } from '@/interfaces/services_type';
import { AppDispatch } from '@/redux/store';
import { setupAuthListener, signOut } from '@/utils/supabase/auth-helper';
import { clearAll } from '@/helpers/storage-helper';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error 
  } = useSelector((state: RootState) => state.user);

  // Initialize auth on mount
  useEffect(() => {
    // Set up auth listener for realtime updates
    const unsubscribe = setupAuthListener(
      // onSignIn callback
      // eslint-disable-next-line no-unused-vars
      (_userData: User, _token: string) => {
        dispatch(fetchCurrentUser());
      },
      // onSignOut callback
      () => {
        router.push('/login');
      }
    );
    
    // Check if user is already authenticated on mount
    if (!isAuthenticated && !isLoading) {
      dispatch(fetchCurrentUser());
    }
    
    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [dispatch, isAuthenticated, isLoading, router]);

  // Login handler
  const login = useCallback(async (email: string, password: string) => {
    try {
      await dispatch(loginUser({ email, password })).unwrap();
      router.push('/dashboard');
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch, router]);

  // Signup handler
  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      await dispatch(signupUser({ name, email, password })).unwrap();
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch, router]);

  // OTP verification handler
  const verify = useCallback(async (email: string, otp: string) => {
    try {
      await dispatch(verifyOtp({ email, otp })).unwrap();
      router.push('/login');
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch, router]);

  // Resend OTP handler
  const resend = useCallback(async (email: string) => {
    try {
      await dispatch(resendOtp(email)).unwrap();
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch]);

  // Forgot password handler
  const forgot = useCallback(async (email: string) => {
    try {
      // await dispatch(forgotPassword(email)).unwrap();
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      return true;
    } catch (error) {
      return false;
    }
  }, [router]);

  // Reset password handler
  const reset = useCallback(async (password: string) => {
    try {
      await dispatch(resetPassword(password)).unwrap();
      router.push('/login');
      return true;
    } catch (error) {
      return false;
    }
  }, [dispatch, router]);

  // Logout handler
const logout = useCallback(async () => {
  try {
    
    // First ensure the Supabase signOut succeeds
    await signOut();    
    // Then clear local storage data
    clearAll();    
    return true;
  } catch (error) {
    console.error("Detailed logout error:", error);
    // Try to clear data anyway in case of partial logout
    try {
      clearAll();
    } catch (clearError) {
      console.error("Failed to clear storage:", clearError);
    }
    return false;
  }
}, []);

  // Clear error state
  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    verify,
    resend,
    forgot,
    reset,
    logout,
    clearAuthError
  };
};