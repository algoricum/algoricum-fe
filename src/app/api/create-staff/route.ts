// types/staff.ts
export interface CreateStaffRequest {
  email: string;
  name: string;
  clinicId: string;
  roleId: string;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  user_id: string;
  is_email_verified: boolean;
  is_onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
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

// app/api/create-staff/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
// import type { CreateStaffRequest, CreateStaffResponse, ApiErrorResponse, EmailResult } from "@/types/staff";

// Server-side admin client
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Generate a random password
 */
function generateRandomPassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

/**
 * Send welcome email using Supabase
 */
async function sendWelcomeEmail(email: string, tempPassword: string, name: string, clinicName: string): Promise<EmailResult> {
  try {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;

    // Try invite email first
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: email,
      options: {
        data: {
          name: name,
          temp_password: tempPassword,
          clinic_name: clinicName,
          welcome_email: true,
        },
        redirectTo: loginUrl,
      },
    });

    if (error) {
      console.error("Invite email error:", error);

      // Fallback: Try invite user by email
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          name: name,
          temp_password: tempPassword,
          clinic_name: clinicName,
        },
        redirectTo: loginUrl,
      });

      if (inviteError) {
        console.error("Invite user error:", inviteError);
        throw new Error(`Failed to send welcome email: ${inviteError.message}`);
      }

      console.log(`✅ Welcome email sent via invite to: ${email}`);
      return { success: true, method: "invite" };
    }

    console.log(`✅ Welcome email sent to: ${email}`);
    console.log(`🔐 Temporary Password: ${tempPassword}`);

    return { success: true, method: "generate_link" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending welcome email:", error);

    // Log credentials for manual sharing
    console.log(`
    ❌ EMAIL FAILED - Manual credentials for ${email}:
    📧 Email: ${email}
    🔐 Password: ${tempPassword}
    👤 Name: ${name}
    🏥 Clinic: ${clinicName}
        `);

    return {
      success: false,
      error: errorMessage,
      credentials: { email, password: tempPassword, name },
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateStaffResponse | ApiErrorResponse>> {
  try {
    const body: CreateStaffRequest = await request.json();
    const { email, name, clinicId, roleId } = body;

    // Validate inputs
    if (!email || !name || !clinicId || !roleId) {
      return NextResponse.json({ error: "Email, name, clinic ID, and role ID are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Generate password
    const userPassword = generateRandomPassword();

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.from("user").select("id, email").eq("email", email).single();

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    // Get clinic name for email
    const { data: clinic } = await supabaseAdmin.from("clinic").select("name").eq("id", clinicId).single();

    // Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name,
        is_staff: true,
        clinic_id: clinicId,
        logged_first:true
      },
    });

    if (authError) {
      return NextResponse.json({ error: `Failed to create auth user: ${authError.message}` }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user - no user data returned" }, { status: 500 });
    }

    // Insert in user table
    const { error: userError } = await supabaseAdmin.from("user").insert({
      id: authData.user.id,
      email,
      name,
      user_id: authData.user.id,
      is_email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (userError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Failed to create user record: ${userError.message}` }, { status: 500 });
    }

    // Insert in user_clinic
    const { error: ucError } = await supabaseAdmin.from("user_clinic").insert({
      user_id: authData.user.id,
      clinic_id: clinicId,
      role_id: roleId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (ucError) {
      // Rollback user and auth user
      await supabaseAdmin.from("user").delete().eq("id", authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Failed to create user-clinic relationship: ${ucError.message}` }, { status: 500 });
    }

    // Send welcome email
    const emailResult = await sendWelcomeEmail(email, userPassword, name, clinic?.name || "Our Clinic");

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
        },
        tempPassword: userPassword, // Only for development - remove in production
        emailSent: emailResult.success,
      },
      message: "Staff member created successfully",
    });
  } catch (error) {
    console.error("Error creating staff:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "An unexpected error occurred while creating staff member" }, { status: 500 });
  }
}

// utils/supabase/config/staff.ts - Updated client-side version
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

export const createStaffUser = async ({ email, name, clinicId, roleId }: CreateStaffRequest): Promise<CreateStaffResult> => {
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
