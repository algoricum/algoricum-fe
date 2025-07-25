// src/redux/slices/clinicSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { createClient } from '@supabase/supabase-js';
import { Clinic, CreateClinicProps, UpdateClinicProps } from "@/interfaces/services_type";
import { setClinicData } from "@/utils/supabase/clinic-helper";
import { clearClinicData } from "@/helpers/storage-helper";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClinicState {
  activeClinics: Clinic[];
  currentClinic: Clinic | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ClinicState = {
  activeClinics: [],
  currentClinic: null,
  isLoading: false,
  error: null
};

// Async thunks for Supabase operations
export const fetchUserClinics = createAsyncThunk(
  'clinic/fetchUserClinics',
  async (userId: string, { rejectWithValue }) => {
    try {
      // Get user-clinic mappings for the user
      const { data: userClinics, error: userClinicsError } = await supabase
        .from('user_clinic')
        .select('clinic_id')
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (userClinicsError) {
        return rejectWithValue(userClinicsError.message);
      }
      
      if (!userClinics || userClinics.length === 0) {
        return { clinics: [] };
      }
      
      // Extract clinic IDs
      const clinicIds = userClinics.map(uc => uc.clinic_id);
      
      // Get detailed clinic data
      const { data: clinics, error: clinicsError } = await supabase
        .from('clinic')
        .select('*')
        .in('id', clinicIds);
        
      if (clinicsError) {
        return rejectWithValue(clinicsError.message);
      }
      
      return { clinics: clinics as Clinic[] };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch user clinics');
    }
  }
);

export const fetchClinicById = createAsyncThunk(
  'clinic/fetchClinicById',
  async (clinicId: string, { rejectWithValue }) => {
    try {
      // Get clinic data
      const { data, error } = await supabase
        .from('clinic')
        .select('*')
        .eq('id', clinicId)
        .single();
        
      if (error) {
        return rejectWithValue(error.message);
      }
      
      // Cache clinic data in localStorage
      await setClinicData(data as Clinic);
      
      return { clinic: data as Clinic };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch clinic');
    }
  }
);

export const getRoleId = async () => {
  const { data, error } = await supabase.from("role").select("id").eq("type", "owner").single(); // ✅ ensures only one record is returned

  if (error) {
    console.error("Error fetching role:", error.message);
    return null;
  }

  return data.id; // ✅ returns the role ID
};


export const createClinic = createAsyncThunk(
  'clinic/createClinic',
  async (clinicData: CreateClinicProps, { rejectWithValue }) => {
    try {
      // Insert new clinic
      const { data, error } = await supabase
        .from('clinic')
        .insert([clinicData])
        .select()
        .single();
        
      if (error) {
        return rejectWithValue(error.message);
      }
      
      // Create user_clinic relationship if userId is provided
      if (clinicData.owner_id) {

        const role_id= await getRoleId()
        const { error: relationError } = await supabase
          .from('user_clinic')
          .insert([{
            user_id: clinicData.owner_id,
            clinic_id: data.id,
            role_id,
            is_active: true
          }]);
          
        if (relationError) {
          return rejectWithValue(relationError.message);
        }
      }
      
      // Cache clinic data in localStorage
      await setClinicData(data as Clinic);
      
      return { clinic: data as Clinic };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create clinic');
    }
  }
);

export const updateClinic = createAsyncThunk(
  'clinic/updateClinic',
  async (clinicData: UpdateClinicProps, { rejectWithValue }) => {
    try {
      // Update clinic
      const { data, error } = await supabase
        .from('clinic')
        .update({
          name: clinicData.name,
          address: clinicData.address,
          phone: clinicData.phone,
          email: clinicData.email,
          language: clinicData.language,
          logo: clinicData.logo,
          widget_logo: clinicData.widget_logo,
          domain: clinicData.domain,
          widget_theme: clinicData.widget_theme,
          dashboard_theme: clinicData.dashboard_theme,
          updated_at: new Date().toISOString()
        })
        .eq('id', clinicData.id)
        .select()
        .single();
        
      if (error) {
        return rejectWithValue(error.message);
      }
      
      // Update cache in localStorage
      await setClinicData(data as Clinic);
      
      return { clinic: data as Clinic };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update clinic');
    }
  }
);

const clinicSlice = createSlice({
  name: "clinic",
  initialState,
  reducers: {
    setCurrentClinic: (state, action: PayloadAction<Clinic | null>) => {
      state.currentClinic = action.payload;
    },
    clearClinic: (state) => {
      state.currentClinic = null;
      clearClinicData();
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Handle fetchUserClinics
    builder.addCase(fetchUserClinics.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchUserClinics.fulfilled, (state, action) => {
      state.isLoading = false;
      state.activeClinics = action.payload.clinics;
      // Set the first clinic as current if we don't have one set
      if (action.payload.clinics.length > 0 && !state.currentClinic) {
        state.currentClinic = action.payload.clinics[0];
      }
      state.error = null;
    });
    builder.addCase(fetchUserClinics.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle fetchClinicById
    builder.addCase(fetchClinicById.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchClinicById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentClinic = action.payload.clinic;
      
      // Update the clinic in the activeClinics array if it exists
      const index = state.activeClinics.findIndex(c => c.id === action.payload.clinic.id);
      if (index !== -1) {
        state.activeClinics[index] = action.payload.clinic;
      } else {
        state.activeClinics.push(action.payload.clinic);
      }
      
      state.error = null;
    });
    builder.addCase(fetchClinicById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle createClinic
    builder.addCase(createClinic.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(createClinic.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentClinic = action.payload.clinic;
      state.activeClinics.push(action.payload.clinic);
      state.error = null;
    });
    builder.addCase(createClinic.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Handle updateClinic
    builder.addCase(updateClinic.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateClinic.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentClinic = action.payload.clinic;
      
      // Update the clinic in the activeClinics array
      const index = state.activeClinics.findIndex(c => c.id === action.payload.clinic.id);
      if (index !== -1) {
        state.activeClinics[index] = action.payload.clinic;
      }
      
      state.error = null;
    });
    builder.addCase(updateClinic.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  }
});

export const { 
  setCurrentClinic, 
  clearClinic,
  clearError
} = clinicSlice.actions;

export default clinicSlice.reducer;