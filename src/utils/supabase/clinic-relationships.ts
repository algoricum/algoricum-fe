// utils/supabase/clinic-relationships.ts
import { v4 as uuidv4 } from "uuid";
import { createClient } from "./config/client";

const supabase = createClient();

/**
 * Create user-clinic relationship
 */
export const createUserClinicRelationship = async (params: { userId: string; clinicId: string; role_id: string; isActive?: boolean }) => {
  const { userId, clinicId, role_id, isActive = true } = params;

  // Check if relationship already exists
  const { data: existingRelationship, error: checkError } = await supabase
    .from("user_clinic")
    .select("*")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (checkError) {
    throw checkError;
  }

  if (existingRelationship) {
    throw new Error("User already has a relationship with this clinic");
  }

  // Create the relationship
  const { data: clinicUser, error } = await supabase
    .from("user_clinic")
    .insert([
      {
        id: uuidv4(),
        user_id: userId,
        clinic_id: clinicId,
        role_id,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return clinicUser;
};

/**
 * Get user's active clinic
 */
export const getUserActiveClinic = async (userId: string) => {
  // Get clinic_id from user_clinic
  const { data: userClinicData, error: clinicUserError } = await supabase
    .from("user_clinic")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (clinicUserError || !userClinicData) {
    return null;
  }

  // Get clinic info using clinic_id
  const { data: clinicData, error: clinicError } = await supabase.from("clinic").select("*").eq("id", userClinicData.clinic_id).single();

  if (clinicError || !clinicData) {
    return null;
  }

  return clinicData;
};

/**
 * Get all clinics for a user
 */
export const getUserClinics = async (userId: string) => {
  // Get all clinic associations
  const { data: userClinics, error: userClinicsError } = await supabase
    .from("user_clinic")
    .select("clinic_id, role_id, is_active")
    .eq("user_id", userId);

  if (userClinicsError || !userClinics?.length) {
    return [];
  }

  // Get all clinic IDs
  const clinicIds = userClinics.map(uc => uc.clinic_id);

  // Get clinic details
  const { data: clinics, error: clinicsError } = await supabase.from("clinic").select("*").in("id", clinicIds);

  if (clinicsError || !clinics) {
    return [];
  }

  // Merge clinic data with relationship data
  return clinics.map(clinic => {
    const userClinic = userClinics.find(uc => uc.clinic_id === clinic.id);
    return {
      ...clinic,
      userRole: userClinic?.role_id,
      isActive: userClinic?.is_active,
    };
  });
};
