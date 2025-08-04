// @/utils/supabase/staff-helper.ts
import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

export interface UpdateStaffData {
  name?: string;
  is_active?: boolean;
}

export interface StaffUpdateResponse {
  data?: any;
  error?: string;
}

export interface StaffDeleteResponse {
  data?: any;
  error?: string;
}

// Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Role {
  id: string;
  type: string;
}

export interface UserClinic {
  id: string;
  created_at: string;
  is_active: boolean;
  user: User;
  role: Role;
}

export interface TransformedStaffMember {
  user_id: string;
  staff_member: string;
  email: string;
  role: string;
  joined_date: string;
  created_by: string;
  status: string;
}

export interface StaffResponse {
  data: TransformedStaffMember[] | null;
  error: string | null;
}

export interface SingleStaffResponse {
  data: UserClinic | null;
  error: string | null;
}

export interface UpdateResponse {
  data: any[] | null;
  error: string | null;
}

// Get all staff members for a specific clinic (excluding owner)
export async function getClinicStaff(clinicId: string): Promise<StaffResponse> {
 try {
   if (!clinicId) {
     throw new Error("Clinic ID is required");
   }

   const { data: staffMembers, error } = await supabase
     .from("user_clinic")
     .select(
       `
        id,
        created_at,
        is_active,
        user_id,
        role_id,
        user!inner (
          id,
          name,
          email
        ),
        role!inner (
          id,
          type
        )
      `,
     )
     .eq("clinic_id", clinicId)
     .neq("role.type", "owner")
     .order("created_at", { ascending: false });

   if (error) {
     console.error("Error fetching staff members:", error);
     throw new Error(`Database error: ${error.message}`);
   }

   if (!staffMembers) {
     return { data: [], error: null };
   }

   const transformedData: TransformedStaffMember[] = staffMembers.map((item: any) => ({
     user_id: item.user?.id || "",
     staff_member: item.user?.name || "Unknown",
     email: item.user?.email || "No email",
     role: item.role?.type || "Unknown",
     joined_date: item.created_at || "",
     created_by: "Admin",
     status: item.is_active ? "Active" : "Inactive",
   }));

   return { data: transformedData, error: null };
 } catch (error: any) {
   console.error("Error in getClinicStaffWithJoin:", error);
   return {
     data: null,
     error: error.message || "An unexpected error occurred",
   };
 }
}

// Get staff member by ID
export async function getStaffMember(userId: string, clinicId: string): Promise<SingleStaffResponse> {
  try {
    const { data, error } = await supabase
      .from("user_clinic")
      .select(
        `
        id,
        created_at,
        is_active,
        user:user_id (
          id,
          name,
          email
        ),
        role:role_id (
          id,
          type
        )
      `,
      )
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .single();

    if (error) {
      console.error("Error fetching staff member:", error);
      throw error;
    }

    return { data: data as UserClinic, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "An unexpected error occurred" };
  }
}

// Update staff member status
export async function updateStaffStatus(userId: string, clinicId: string, isActive: boolean): Promise<UpdateResponse> {
  try {
    const { data, error } = await supabase
      .from("user_clinic")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("clinic_id", clinicId)
      .select();

    if (error) {
      console.error("Error updating staff status:", error);
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "An unexpected error occurred" };
  }
}



// Additional helper function to get staff count
export async function getStaffCount(clinicId: string): Promise<{ count: number; error: string | null }> {
  try {
    const { count, error } = await supabase
      .from("user_clinic")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .neq("role.type", "owner");

    if (error) {
      console.error("Error fetching staff count:", error);
      throw error;
    }

    return { count: count || 0, error: null };
  } catch (error: any) {
    return { count: 0, error: error.message || "An unexpected error occurred" };
  }
}


// Add these functions to your clinic-staff-helper.ts file




export async function updateStaffMember(
  userId: string,
  clinicId: string,
  updateData: UpdateStaffData
): Promise<StaffUpdateResponse> {
  try {
    if (!userId || !clinicId) {
      throw new Error("User ID and Clinic ID are required");
    }

    // Start a transaction-like approach
    const updates: Promise<any>[] = [];

    // Update user table if name is provided
    if (updateData.name) {
      const userUpdate = supabase
        .from("user")
        .update({ 
          name: updateData.name,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      
      updates.push(userUpdate);
    }

    // Update user_clinic table if is_active is provided
    if (updateData.is_active !== undefined) {
      const userClinicUpdate = supabase
        .from("user_clinic")
        .update({ 
          is_active: updateData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("clinic_id", clinicId);
      
      updates.push(userClinicUpdate);
    }

    // Execute all updates
    const results = await Promise.all(updates);

    // Check for errors in any of the updates
    for (const result of results) {
      if (result.error) {
        console.error("Update error:", result.error);
        throw new Error(`Database update failed: ${result.error.message}`);
      }
    }

    return { data: "Staff member updated successfully", error: undefined };
  } catch (error: any) {
    console.error("Error updating staff member:", error);
    return { 
      data: undefined, 
      error: error.message || "An unexpected error occurred while updating staff member" 
    };
  }
}

/**
 * Delete (deactivate) staff member
 * @param userId - The user ID of the staff member
 * @param clinicId - The clinic ID
 * @returns Promise<StaffDeleteResponse>
 */
export async function deleteStaffMember(userId: string, clinicId: string): Promise<StaffDeleteResponse> {
  try {
    if (!userId || !clinicId) {
      throw new Error("User ID and Clinic ID are required");
    }

    // Hard delete from user_clinic table
    const { data, error } = await supabase.from("user_clinic").delete().eq("user_id", userId).eq("clinic_id", clinicId).select();

    if (error) {
      console.error("Error deleting staff member:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("Staff member not found or already removed");
    }

    return { data: "Staff member deleted successfully", error: undefined };
  } catch (error: any) {
    console.error("Error deleting staff member:", error);
    return {
      data: undefined,
      error: error.message || "An unexpected error occurred while deleting staff member",
    };
  }
}

