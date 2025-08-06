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

export interface EmailResult {
  success: boolean;
  method?: string;
  error?: string;
  credentials?: {
    email: string;
    password: string;
    name: string;
  };
}