import { setAccessToken } from "@/helpers/storage-helper";
import { User } from "@/interfaces/services_type";
import { signOut } from "@/utils/supabase/auth-helper";
import { getUserData, setUserData } from "@/utils/supabase/user-helper";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

const initialState: UserState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  token: null,
};

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
    },
  },
});

export const { setUser, setToken, setAuthLoading, clearUser: clearUserAction } = userSlice.actions;

// Accessor functions
export const saveUser = (user: any, token?: string) => (dispatch: any) => {
  if (user) {
    setUserData(user);
    dispatch(setUser(user));

    if (token) {
      setAccessToken(token);
      dispatch(setToken(token));
    }
  } else {
    dispatch(signOut());
  }
};

export const clearUser = () => (dispatch: any) => {
  signOut();
  dispatch(clearUserAction());
};

// Get user from Redux store or localStorage if not in store
export const getUser = async (): Promise<User | null> => {
  return await getUserData();
};

export default userSlice.reducer;
