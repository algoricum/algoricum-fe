// utils/supabase/clinic-helper.ts
import { getLocalClinicData, setLocalClinicData } from '@/helpers/storage-helper';
import { createClient } from './config/client';
import { getUserData } from './user-helper';
import type { Clinic, CreateClinicProps, UpdateClinicProps } from '@/interfaces/services_type';
import { getRoleId } from "@/redux/slices/clinic.slice";

const supabase = createClient();

/**
 * Set clinic data
 */
export const setClinicData = async (clinicData: Clinic): Promise<void> => {
  setLocalClinicData(clinicData);
};

/**
 * Get clinic data from localStorage or Supabase
 */
export const getClinicData = async (): Promise<Clinic | null> => {
  // First try localStorage
  // If not in localStorage, get from Supabase
  try {
    const userData = await getUserData();

    if (userData) {
      // Get user-clinic mapping
     const { data: userClinicData } = await supabase
        .from("user_clinic")
        .select("clinic_id")
        .eq("user_id", userData.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (userClinicData) {
        // Get clinic data
        const { data: clinicData } = await supabase.from("clinic").select("*").eq("id", userClinicData.clinic_id).single();

        if (clinicData) {
          const clinic = clinicData as Clinic;
          setLocalClinicData(clinic);
          return clinic;
        } else {
          const localClinic = getLocalClinicData();
          if (localClinic) return localClinic;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching clinic data from Supabase:', error);
  }

  return null;
};

export async function updateMailgunDomainSettings(clinicId: string, mailgunData?: { domain: string; email: string }) {
  try {
    // Early return if no Mailgun data is provided
    if (!mailgunData) {
      console.log("No Mailgun data provided, skipping update");
      return null;
    }

    // Only update the specific Mailgun fields and updated_at timestamp
    const updateData = {
      mailgun_domain: mailgunData.domain,
      mailgun_email: mailgunData.email,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("clinic")
      .update(updateData)
      .eq("id", clinicId)
      .select()
      .single();

    if (error) {
      console.error("Error updating Mailgun settings:", error);
      throw new Error("Failed to update Mailgun settings");
    }

    console.log("Mailgun settings updated:", data);
    return data;
  } catch (error) {
    console.error("Error in updateMailgunDomainSettings:", error);
    throw error;
  }
}

export const getAssistantByClinicId = async (clinicId:string) => {
  try {
    if (!clinicId) {
      throw new Error('Clinic ID is required');
    }

    // Query the assistants table to get the assistant for this clinic
    const { data: assistant, error } = await supabase.from("assistants").select("*").eq("clinic_id", clinicId).single(); // Use single() since each clinic should have one assistant

    if (error) {
      if (error.code === 'PGRST116') {
        // No assistant found for this clinic
        return null;
      }
      throw error;
    }

    return assistant;
  } catch (error) {
    console.error('Error fetching assistant for clinic:', error);
    throw error;
  }
};
export const getClincApiKey = async (clinicId: string): Promise<String | null> => {
  try {
    // Get user-clinic mapping
    const { data: apiKeyData } = await supabase.from("api_key").select("api_key").eq("clinic_id", clinicId).limit(1).single();

    if (apiKeyData) {
      return apiKeyData.api_key;
    }
  } catch (error) {
    console.error('Error fetching clinic data from Supabase:', error);
  }

  return null;
};

/**
 * Get all clinics for user
 */
export const getUserClinics = async (userId: string): Promise<Clinic[]> => {
  try {
    // Get user-clinic mappings
    const { data: userClinics, error: mappingError } = await supabase.from("user_clinic").select("clinic_id").eq("user_id", userId);

    if (mappingError) throw mappingError;

    if (!userClinics || userClinics.length === 0) {
      return [];
    }

    // Extract clinic IDs
    const clinicIds = userClinics.map(mapping => mapping.clinic_id);

    // Get clinic data
    const { data: clinics, error: clinicsError } = await supabase.from("clinic").select("*").in("id", clinicIds);

    if (clinicsError) throw clinicsError;

    return clinics as Clinic[];
  } catch (error) {
    console.error('Error fetching user clinics:', error);
    return [];
  }
};

export const createClinic = async (data: CreateClinicProps): Promise<Clinic> => {
  const { owner_id, ...clinicData } = data;

  // Create the clinic record
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

  const role_id=await getRoleId()

  const { error: userClinicError } = await supabase.from("user_clinic").insert([
    {
      user_id: owner_id,
      clinic_id: clinicResult.id,
      role_id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  if (userClinicError) {
    console.error("Failed to create user-clinic relationship:", userClinicError);
    throw userClinicError;
  }
  // Store in localStorage
  setLocalClinicData(clinicResult);

  return clinicResult;
};

/**
 * Update an existing clinic
 */
export const updateClinic = async (data: UpdateClinicProps): Promise<Clinic> => {
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

  const { data: clinicData, error } = await supabase.from("clinic").update(updateObject).eq("id", id).select().single();

  if (error) {
    throw error;
  }

  return clinicData;
};

/**
 * Get a clinic by ID
 */
export const getClinicById = async (id: string): Promise<Clinic> => {
  const { data, error } = await supabase
    .from('clinic')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  // Process API key for security
  if (data && data.openai_api_key) {
    data.openai_api_key_present = true;
    delete data.openai_api_key;
  }

  return data;
};

/**
 * Fetch clinics with pagination and search
 */
export const fetchClinics = async (page: number = 1, perPage: number = 10, search: string = '') => {
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

  // Process API keys for security
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
};

/**
 * Delete a clinic
 */
export const deleteClinic = async (id: string): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('clinic')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return { success: true };
};
