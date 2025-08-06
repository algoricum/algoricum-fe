// utils/supabase/config/staff.ts
export interface CreateStaffRequest {
  email: string;
  name: string;
  clinicId: string;
  roleId: string;
}

export interface CreateStaffResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
    };
    tempPassword?: string; // Only for development
    emailSent: boolean;
  };
  message: string;
}

export interface ApiErrorResponse {
  error: string;
}

// Define interfaces for better type safety
interface CreateStaffUserParams {
  email: string;
  name: string;
  clinicId: string | number; // Adjust based on your actual ID type
  roleId: string | number; // Adjust based on your actual ID type
}

interface CreateStaffResult {
  data?: {
    user: {
      id: string;
      email: string;
    };
    tempPassword?: string;
    emailSent: boolean;
  };
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

    const result: CreateStaffResponse | ApiErrorResponse = await response.json();

    if (!response.ok) {
      return {
        error: {
          message: "error" in result ? result.error : "Failed to create staff user",
        },
      };
    }

    if ("success" in result && result.success) {
      return { data: result.data };
    }

    return {
      error: {
        message: "Unexpected response format",
      },
    };
  } catch (error) {
    console.error("Error calling create staff API:", error);
    return {
      error: {
        message: "Failed to communicate with server. Please try again.",
      },
    };
  }
};
