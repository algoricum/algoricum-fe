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

    let result: CreateStaffResponse | ApiErrorResponse;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      return {
        error: {
          message: `Invalid response from server (${response.status}: ${response.statusText})`,
        },
      };
    }

    console.log("API Response Status:", response.status, response.statusText);
    console.log("API Response Data:", result);

    if (!response.ok) {
      console.error("API error - Status:", response.status);
      console.error("API error - Response:", result);
      console.error("API error - Full response object:", JSON.stringify(result, null, 2));
      return {
        error: {
          message: "error" in result ? result.error : `Failed to create staff user (${response.status}: ${response.statusText})`,
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
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return {
      error: {
        message: `Failed to communicate with server: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
};
