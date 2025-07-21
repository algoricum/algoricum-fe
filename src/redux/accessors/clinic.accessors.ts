import { createSlice, Dispatch, PayloadAction } from "@reduxjs/toolkit";
import { createClient } from "@/utils/supabase/config/client";
import { Clinic, UpdateClinicProps } from "@/interfaces/services_type";
import { getClinicData, setClinicData } from "@/utils/supabase/clinic-helper";

interface ClinicState {
    clinic: Clinic | null;
    loading: boolean;
}

const initialState: ClinicState = {
    clinic: null,
    loading: false,
};

const clinicSlice = createSlice({
    name: "clinic",
    initialState,
    reducers: {
        setClinic: (state, action: PayloadAction<Clinic | null>) => {
            state.clinic = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        updateClinic: (state, action: PayloadAction<Partial<Clinic>>) => {
            if (state.clinic) {
                state.clinic = { ...state.clinic, ...action.payload };
            }
        },
    },
});

export const { setClinic, setLoading, updateClinic } = clinicSlice.actions;

// Action creators
export const saveClinic = (clinic: Clinic | null) => {
    // Save to localStorage if clinic exists
    if (clinic) {
        setClinicData(clinic);
    } else {
        // Clear from localStorage if null
        if (typeof window !== 'undefined') {
            localStorage.removeItem('algoricum_clinic_data');
        }
    }
    return setClinic(clinic);
};

// Update clinic in Redux and Supabase
export const updateClinicData = async (updateData: UpdateClinicProps, dispatch: Dispatch) => {
    try {
      dispatch(setLoading(true));
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('clinic')
        .update(updateData)
        .eq('id', updateData.id)
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      dispatch(updateClinic(data));
      return data;
    } catch (error) {
      console.error('Error updating clinic:', error);
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

// Upload logo to Supabase storage
export const uploadLogo = async (userId: string, file: File, dispatch: Dispatch) => {
    try {
      dispatch(setLoading(true));
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `clinic-logos/${fileName}`;
      
      const {error } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (error) {
        throw error;
      }
      
      const { data: urlData } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
        
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };
  

// Selector hook
export const useClinic = () => {
    // Get data from localStorage
    const clinic = getClinicData();
    
    return {
        clinic,
        loading: false, // We can't get loading state from localStorage
    };
};

// Fetch user's clinic from Supabase
export const fetchUserClinic = (userId: string) => async (dispatch: any) => {
    try {
        dispatch(setLoading(true));
        const supabase = createClient();

        // Get the clinic this user is part of
        const { data, error } = await supabase
            .from('user_clinic')
            .select(`
        clinic_id,
        role,
        position,
        clinic (*)
      `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('Error fetching clinic:', error);
            dispatch(setClinic(null));
            return;
        }
        // Check if clinic is an array and handle appropriately
        const clinicData = Array.isArray(data.clinic) ? data.clinic[0] : data.clinic;
        dispatch(setClinic(clinicData));
    } catch (error) {
        console.error('Error fetching clinic:', error);
        dispatch(setClinic(null));
    } finally {
        dispatch(setLoading(false));
    }
};

export default clinicSlice.reducer;