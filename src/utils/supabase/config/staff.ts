// utils/supabase/config/staff.ts

// Define interfaces for better type safety
interface CreateStaffUserParams {
  email: string;
  name: string;
  clinicId: string | number; // Adjust based on your actual ID type
  roleId: string | number; // Adjust based on your actual ID type
}

interface StaffUser {
  id: string;
  email: string;
  name: string;
  clinicId: string | number;
  roleId: string | number;
  createdAt?: string;
  // Add other properties that your API returns
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface CreateStaffResult {
  data?: StaffUser;
  error?: {
    message: string;
  };
}

export const createStaffUser = async ({ email, name, clinicId, roleId }: CreateStaffUserParams): Promise<CreateStaffResult> => {
  try {
    const response = await fetch("/api/create-staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim(),
        clinicId,
        roleId,
      }),
    });

    const result: ApiResponse<StaffUser> = await response.json();

    if (!response.ok) {
      return {
        error: {
          message: result.error || "Failed to create staff user",
        },
      };
    }

    return { data: result.data };
  } catch (error) {
    console.error("Error calling create staff API:", error);
    return {
      error: {
        message: "Failed to communicate with server. Please try again.",
      },
    };
  }
};

// Optional: Create a more specific type for clinic and role IDs if they're UUIDs
// type UUID = string;
//
// interface CreateStaffUserParams {
//   email: string;
//   name: string;
//   clinicId: UUID;
//   roleId: UUID;
// }
