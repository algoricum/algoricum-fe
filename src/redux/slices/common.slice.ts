import { createSlice } from "@reduxjs/toolkit";
import { CommonState } from "../models/common_model";

const initialState: CommonState = {
  isClinicOpen: false, // Provide a default value
};

const commonSlice = createSlice({
  name: "common",
  initialState: initialState,
  reducers: {
    setIsClinicOpen: (state, { payload }) => {
      state.isClinicOpen = payload;
    },
  },
});

export default commonSlice;
