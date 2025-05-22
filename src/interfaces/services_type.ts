// Authentication related types
export interface LoginProps {
  email: string;
  password: string;
}

export interface SignupProps {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string; // Used on frontend only
}

export interface VerifyOtpProps {
  email: string;
  otp: string;
}

export interface ResendOtpProps {
  email: string;
}

export interface ForgotProps {
  email: string;
}

export interface ResetPasswordProps {
  password: string;
}

// User related types
export interface User {
  id: string;
  name: string;
  email: string;
  is_email_verified: boolean;
  is_super_admin?: boolean;
  created_at: string;
  updated_at: string;
}

// Clinic related types
export interface Clinic {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  language: string;
  owner_id: string;
  logo?: string;
  widget_logo?: string;
  domain?: string;
  widget_theme?: WidgetTheme;
  dashboard_theme?: DashboardTheme;
  created_at: string;
  updated_at: string;
  
  // Additional fields from the database
  openai_api_key?: string;
  assistant_prompt?: string;
  assistant_model?: string;
  legal_business_name?: string;
  dba_name?: string;
  business_hours?: BusinessHours;
  calendly_link?: string;
  
  // New fields for chatbot settings
  tone_selector?: string;
  sentence_length?: string;
  formality_level?: string;
}
export interface CreateClinicProps {
  // Required fields
  name: string;
  language: string;
  owner_id: string;
  
  // Optional fields (nullable in database)
  address?: string;
  phone?: string;
  email?: string;
  legal_business_name?: string;
  dba_name?: string;
  domain?: string;
  logo?: string;
  widget_logo?: string;
  business_hours?: BusinessHours;
  calendly_link?: string;
  
  // Chatbot related fields
  openai_api_key?: string;
  assistant_prompt?: string;
  assistant_model?: string;
  tone_selector?: string;
  sentence_length?: string;
  formality_level?: string;
  
  // Theme objects
  widget_theme?: WidgetTheme;
  dashboard_theme?: DashboardTheme;
}
export interface BusinessHours {
  [key: string]: {
    isOpen: boolean
    openTime: string
    closeTime: string
  }
}
export interface UpdateClinicProps {
  id: string;
  name?: string;
  language?: string;
  address?: string;
  phone?: string;
  email?: string;
  legal_business_name?: string;
  dba_name?: string;
  domain?: string;
  logo?: string;
  widget_logo?: string;
  business_hours?: BusinessHours;
  calendly_link?: string;
  
  // Chatbot related fields
  openai_api_key?: string;
  assistant_prompt?: string;
  assistant_model?: string;
  tone_selector?: string;
  sentence_length?: string;
  formality_level?: string;
  
  // Theme objects
  widget_theme?: WidgetTheme;
  dashboard_theme?: DashboardTheme;

}

export interface WidgetTheme {
  primary_color?: string;
  font_family?: string;
  border_radius?: string;
  [key: string]: any;
}

export interface DashboardTheme {
  primary_color?: string;
  layout?: 'sidebar' | 'topbar';
  [key: string]: any;
}

export interface UserClinic {
  id: string;
  user_id: string;
  clinic_id: string;
  role: 'owner' | 'admin' | 'staff';
  position?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Lead related types
export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source_id: string;
  clinic_id: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadSource {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Conversation related types
export interface Thread {
  id: string;
  user_id?: string;
  lead_id?: string;
  clinic_id: string;
  status: 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  thread_id: string;
  message: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

// API key related types
export interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  key_expires_at: string;
  last_used_at?: string;
  clinic_id: string;
  created_at: string;
  updated_at: string;
}

//Update Widget Details

export interface UpdateWidgetProps {
  widget_logo?: string;
  widget_theme?: {
    primary_color?: string;
    font_color?: string;
  };
}