// services/clinic.ts
import { createClient } from '@/utils/supabase/client';
import { CreateClinicProps, UpdateClinicProps } from "@/interfaces/services_type";
import { v4 as uuidv4 } from 'uuid';
import { setClinicData } from './auth';
import { SupabaseClient } from '@supabase/supabase-js';

const supabase = createClient();
const clinicService = {
  create: async (data: CreateClinicProps) => {
    const { owner_id, ...clinicData } = data;
    
    // Start a transaction to ensure both the clinic and relationship are created
    const { data: clinicResult, error: clinicError } = await supabase
      .from('clinic')
      .insert([
        {
          ...clinicData,
          owner_id: owner_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (clinicError) {
      throw clinicError;
    }
    // Create user_clinic relationship
    const { error: relationError } = await supabase
      .from('user_clinic') // Adjusted to match your schema table name
      .insert([
        {
          id: uuidv4(), // Generate a UUID for the relationship
          user_id: owner_id,
          clinic_id: clinicResult.id,
          role: 'owner',
          position: 'Administrator',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (relationError) {
      throw relationError;
    }
    await setClinicData(clinicResult)
    return clinicResult;
  },
  
  update: async (data: UpdateClinicProps) => {
    const { id, ...updateData } = data;
    
    // Prepare update data
    const updateObject: any = {
      ...updateData,
      updated_at: new Date().toISOString()
    };
    
    // Process dashboard_theme if provided
    if (updateData.dashboard_theme) {
      updateObject.dashboard_theme = updateData.dashboard_theme;
    }
    
    // Process widget_theme if provided
    if (updateData.widget_theme) {
      updateObject.widget_theme = updateData.widget_theme;
    }
    
    const { data: clinicData, error } = await supabase
      .from('clinic')
      .update(updateObject)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    
    // Process the result to indicate if openai_api_key is present without revealing the key
    if (clinicData && clinicData.openai_api_key) {
      clinicData.openai_api_key_present = true;
      // Don't send the actual API key to the client
      delete clinicData.openai_api_key;
    }
    
    return clinicData;
  },
  
  getClinic: async (id: string) => {
    const { data, error } = await supabase
      .from('clinic')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      throw error;
    }
    
    // Process the result to indicate if openai_api_key is present without revealing the key
    if (data && data.openai_api_key) {
      data.openai_api_key_present = true;
      // Don't send the actual API key to the client
      delete data.openai_api_key;
    }
    
    return data;
  },
  
  fetchClinics: async (page: number = 1, perPage: number = 10, search: string = '') => {
    // Calculate range for pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    
    let query = supabase
      .from('clinic')
      .select('*', { count: 'exact' });
    
    // Add search filter if provided
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    // Execute the query with range
    const { data, error, count } = await query.range(from, to);
    
    if (error) {
      throw error;
    }
    
    // Process the results to indicate if openai_api_key is present without revealing the keys
    if (data) {
      data.forEach(clinic => {
        if (clinic.openai_api_key) {
          clinic.openai_api_key_present = true;
          delete clinic.openai_api_key;
        }
      });
    }
    
    return {
      data,
      pagination: {
        total: count || 0,
        page,
        perPage
      }
    };
  },
  
  delete: async (id: string) => {
    // Check user permissions before deletion
    const { data: userClinic, error: permissionError } = await supabase
      .from('user_clinic') // Adjusted to match your schema table name
      .select('role')
      .eq('clinic_id', id)
      .eq('user_id', supabase.auth.getUser())
      .single();
      
    if (permissionError) {
      throw new Error('You do not have permission to delete this clinic');
    }
    
    if (userClinic.role !== 'owner' && userClinic.role !== 'admin') {
      throw new Error('Only clinic owners or admins can delete a clinic');
    }
    
    const { error } = await supabase
      .from('clinic')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw error;
    }
    
    return { success: true };
  },

  // Helper method to handle logo upload
  uploadLogo: async (userId: string | undefined, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clinic-logos')
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL for the uploaded logo
    const { data: publicUrlData } = supabase.storage
      .from('clinic-logos')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  },
  
  // Helper method to handle widget logo upload
  uploadWidgetLogo: async (userId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `widget-${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clinic-logos')
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL for the uploaded logo
    const { data: publicUrlData } = supabase.storage
      .from('clinic-logos')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  },
  
  // Get user role in clinic
  getUserRole: async (userId: string, clinicId: string) => {
    const { data, error } = await supabase
      .from('user_clinic') // Adjusted to match your schema table name
      .select('role')
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
      .single();
      
    if (error) {
      return null;
    }
    
    return data.role;
  },
  
  // Check if user is owner of clinic
  isClinicOwner: async (userId: string, clinicId: string) => {
    const { data, error } = await supabase
      .from('clinic')
      .select('owner_id')
      .eq('id', clinicId)
      .single();
      
    if (error || !data) {
      return false;
    }
    
    return data.owner_id === userId;
  },
  
  // Create a clinic-user relationship
  createClinicUserRelationship: async (data: {
    userId: string;
    clinicId: string;
    role: string;
    position?: string;
  }) => {
    const { userId, clinicId, role, position } = data;
    
    // Check if relationship already exists
    const { data: existingRelationship, error: checkError } = await supabase
      .from('user_clinic')
      .select('*')
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
      .maybeSingle();
      
    if (checkError) {
      throw checkError;
    }
    
    if (existingRelationship) {
      throw new Error('User already has a relationship with this clinic');
    }
    
    // Create the relationship
    const { data: clinicUser, error } = await supabase
      .from('user_clinic')
      .insert([
        {
          id: uuidv4(),
          user_id: userId,
          clinic_id: clinicId,
          role,
          position: position || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return clinicUser;
  }
};
export async function ensureUserHasClinic(
  supabase: SupabaseClient,
  userId: string,
  redirectFunction: (url: string) => void,
  targetUrl: string = '/dashboard'
): Promise<boolean> {
  try {
    // Step 1: Get clinic_id from user_clinic
    const { data: userClinicData, error: clinicUserError } = await supabase
      .from("user_clinic")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // No clinic found - redirect to onboarding
    if (clinicUserError || !userClinicData) {
      redirectFunction("/onboarding");
      return true; // Redirect performed
    }

    // Step 2: Get clinic info using clinic_id
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinic")
      .select("*")
      .eq("id", userClinicData.clinic_id)
      .single();

    if (clinicError) {
      // Clinic not found despite association - redirect to onboarding
      redirectFunction("/onboarding");
      return true; // Redirect performed
    }

    // If a valid clinic is found and there's a target URL, redirect there
    if (targetUrl) {
      redirectFunction(targetUrl);
      return true; // Redirect performed
    }

    return false; // No redirect performed (clinic exists)
  } catch (error) {
    console.error("Error checking clinic association:", error);
    // On error, safest to redirect to onboarding
    redirectFunction("/onboarding");
    return true; // Redirect performed
  }
}
export function useClinicCheck() {
  return {
    checkAndRedirectIfNoClinic: async (
      supabase: SupabaseClient,
      userId: string,
      router: any, // Next.js router
      targetUrl: string = '/dashboard',
      setClinicData?: (data: any) => void
    ) => {
      try {
        // Step 1: Get clinic_id from user_clinic
        const { data: userClinicData, error: clinicUserError } = await supabase
          .from("user_clinic")
          .select("clinic_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // No clinic found - redirect to onboarding
        if (clinicUserError || !userClinicData) {
          router.push("/onboarding");
          return true; // Redirect performed
        }

        // Step 2: Get clinic info using clinic_id
        const { data: clinicData, error: clinicError } = await supabase
          .from("clinic")
          .select("*")
          .eq("id", userClinicData.clinic_id)
          .single();

        if (clinicError) {
          // Clinic not found despite association - redirect to onboarding
          router.push("/onboarding");
          return true; // Redirect performed
        }

        // Store clinic data if handler provided
        if (setClinicData && clinicData) {
          setClinicData(clinicData);
        }

        // If there's a target URL, redirect there
        if (targetUrl) {
          router.push(targetUrl);
          return true; // Redirect performed
        }

        return false; // No redirect performed (clinic exists)
      } catch (error) {
        console.error("Error checking clinic association:", error);
        // On error, safest to redirect to onboarding
        router.push("/onboarding");
        return true; // Redirect performed
      }
    }
  };
}
export default clinicService;