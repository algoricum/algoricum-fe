import { ensureMutators } from "@/helpers/helper";
import { useSelector } from "react-redux";
import commonSlice from "../slices/common.slice";
import { BaseState, store } from "../store";

// mutators
export const setIsClinicOpen = (isClinicOpen: boolean) => store.dispatch(commonSlice.actions.setIsClinicOpen(isClinicOpen));

// export const updateTokens = (tokens: Omit<AuthState, 'user'>) =>
//   store.dispatch(authSlice.actions.updateTokens(tokens));

// export const updateUser = (user: Partial<User>) =>
//   store.dispatch(authSlice.actions.updateUser(user));

ensureMutators<typeof commonSlice.actions>({
  setIsClinicOpen,
});

export const useCommon = () => useSelector((state: BaseState) => state.common);
