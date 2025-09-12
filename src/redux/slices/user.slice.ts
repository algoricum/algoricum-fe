// src/redux/slices/userSlice.ts
import { getAccessToken } from "@/helpers/storage-helper";
import { User } from "@/interfaces/services_type";
import {
  resendOtp as resendOtpService,
  resetPasswordRequest,
  signInWithPassword,
  signUp as signupUserService,
  verifyOtp as verifyOtpService,
} from "@/utils/supabase/auth-helper";
import { getUserData } from "@/utils/supabase/user-helper";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

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
  error: null,
};

// Async thunks for auth operations
export const fetchCurrentUser = createAsyncThunk("user/fetchCurrentUser", async (_, { rejectWithValue }) => {
  try {
    // Get token from localStorage
    const token = getAccessToken();

    if (!token) {
      return rejectWithValue("No token found");
    }

    // Get user data from service (checks localStorage first, then Supabase)
    const userData = await getUserData();

    if (!userData) {
      return rejectWithValue("User data not found");
    }

    return { user: userData, token };
  } catch (error: any) {
    return rejectWithValue(error.message || "Failed to fetch user data");
  }
});

export const loginUser = createAsyncThunk(
  "user/loginUser",
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const result = await signInWithPassword(credentials.email, credentials.password);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || "Login failed");
    }
  },
);

export const signupUser = createAsyncThunk(
  "user/signupUser",
  async (userData: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      await signupUserService(userData.name, userData.email, userData.password);
      return { email: userData.email };
    } catch (error: any) {
      return rejectWithValue(error.message || "Signup failed");
    }
  },
);

export const verifyOtp = createAsyncThunk("user/verifyOtp", async (data: { email: string; otp: string }, { rejectWithValue }) => {
  try {
    await verifyOtpService(data.email, data.otp);
    return { email: data.email };
  } catch (error: any) {
    return rejectWithValue(error.message || "OTP verification failed");
  }
});

export const resendOtp = createAsyncThunk("user/resendOtp", async (email: string, { rejectWithValue }) => {
  try {
    await resendOtpService(email);
    return { email };
  } catch (error: any) {
    return rejectWithValue(error.message || "Resend OTP failed");
  }
});

export const resetPassword = createAsyncThunk("user/resetPassword", async (password: string, { rejectWithValue }) => {
  try {
    await resetPasswordRequest(password);
    return { success: true };
  } catch (error: any) {
    return rejectWithValue(error.message || "Password reset failed");
  }
});

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
    clearUser: state => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.token = null;
      state.error = null;
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    // Handle fetchCurrentUser
    builder.addCase(fetchCurrentUser.pending, state => {
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
    builder.addCase(loginUser.pending, state => {
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
  },
});

export const { setUser, setToken, setAuthLoading, clearUser: clearUserAction, clearError } = userSlice.actions;

export default userSlice.reducer;
