// src/redux/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { 
  getUserData, 
  setUserData, 
  getAccessToken, 
  setAccessToken, 
  clearUserData, 
  clearTokens, 
  clearAll,
  loginUser as loginUserService,
  signupUser as signupUserService,
  verifyOtp as verifyOtpService,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
  logoutUser as logoutUserService,
  resendOtp as resendOtpService
} from "@/services/auth";
import { User } from "@/interfaces/services_type";

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  token: null,
  error: null
};

// Async thunks for auth operations
export const fetchCurrentUser = createAsyncThunk(
  'user/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      // Get token from localStorage
      const token = getAccessToken();
      
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      // Get user data from service (checks localStorage first, then Supabase)
      const userData = await getUserData();
      
      if (!userData) {
        return rejectWithValue('User data not found');
      }
      
      return { user: userData, token };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch user data');
    }
  }
);

export const loginUser = createAsyncThunk(
  'user/loginUser',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const result = await loginUserService(credentials.email, credentials.password);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const signupUser = createAsyncThunk(
  'user/signupUser',
  async (userData: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      await signupUserService(userData.name, userData.email, userData.password);
      return { email: userData.email };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Signup failed');
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'user/verifyOtp',
  async (data: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      await verifyOtpService(data.email, data.otp);
      return { email: data.email };
    } catch (error: any) {
      return rejectWithValue(error.message || 'OTP verification failed');
    }
  }
);

export const resendOtp = createAsyncThunk(
  'user/resendOtp',
  async (email: string, { rejectWithValue }) => {
    try {
      await resendOtpService(email);
      return { email };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Resend OTP failed');
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'user/forgotPassword',
  async (email: string, { rejectWithValue }) => {
    try {
      await forgotPasswordService(email);
      return { email };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Forgot password request failed');
    }
  }
);

export const resetPassword = createAsyncThunk(
  'user/resetPassword',
  async (password: string, { rejectWithValue }) => {
    try {
      await resetPasswordService(password);
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Password reset failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'user/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await logoutUserService();
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isLoading = false;
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.token = null;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Handle fetchCurrentUser
    builder.addCase(fetchCurrentUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchCurrentUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(fetchCurrentUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
      state.isAuthenticated = false;
    });
    
    // Handle loginUser
    builder.addCase(loginUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle signupUser
    builder.addCase(signupUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(signupUser.fulfilled, (state) => {
      state.isLoading = false;
      // User is not logged in after signup until OTP is verified
    });
    builder.addCase(signupUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle OTP verification
    builder.addCase(verifyOtp.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyOtp.fulfilled, (state) => {
      state.isLoading = false;
      // Verification successful, but user still needs to log in
    });
    builder.addCase(verifyOtp.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle resendOtp
    builder.addCase(resendOtp.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(resendOtp.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(resendOtp.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle forgotPassword
    builder.addCase(forgotPassword.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(forgotPassword.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(forgotPassword.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle resetPassword
    builder.addCase(resetPassword.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(resetPassword.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(resetPassword.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle logoutUser
    builder.addCase(logoutUser.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.isLoading = false;
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    });
    builder.addCase(logoutUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  }
});

export const { 
  setUser, 
  setToken, 
  setAuthLoading, 
  clearUser: clearUserAction,
  clearError
} = userSlice.actions;

export default userSlice.reducer;