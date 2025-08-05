// src/app/api/create-staff/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import FormData from "form-data";
import Mailgun from "mailgun.js";
import { emailTemplate } from "@/utils/emailTemplate";

// Types
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

interface EmailResult {
  success: boolean;
  method?: string;
  error?: string;
  credentials?: {
    email: string;
    password: string;
    name: string;
  };
}

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
 * Send welcome email with credentials using Mailgun
 */
async function sendWelcomeEmail(email: string, name: string, password: string, clinicName: string): Promise<EmailResult> {
  try {
    // Initialize Mailgun client
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY || "",
    });

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/login`;

    // Generate beautiful email template
    const { html: emailHtml, text: textContent } = emailTemplate({
      name,
      email,
      password,
      clinicName,
      loginUrl,
    });

    // Send email using Mailgun
    const mailData = {
      from: `${clinicName} <${process.env.MAILGUN_FROM_EMAIL || "noreply@yourdomain.com"}>`,
      to: [email],
      subject: `Welcome to ${clinicName} - Your Account Details`,
      text: textContent,
      html: emailHtml,
    };

    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN || "", mailData);

    console.log("Email sent successfully:", data);

    return {
      success: true,
      method: "mailgun",
      credentials: {
        email,
        password,
        name,
      },
    };
  } catch (error) {
    console.error("Mailgun email sending failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
      credentials: {
        email,
        password,
        name,
      },
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
    const clinicName = clinic?.name || "Healthcare System";

    // Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name,
        is_staff: true,
        clinic_id: clinicId,
        logged_first: true,
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
    const emailResult = await sendWelcomeEmail(email, name, userPassword, clinicName);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
        },
        tempPassword: process.env.NODE_ENV === "development" ? userPassword : undefined, // Only for development
        emailSent: emailResult.success,
      },
      message: emailResult.success
        ? "Staff member created successfully and welcome email sent"
        : "Staff member created successfully but email sending failed",
    });
  } catch (error) {
    console.error("Error creating staff:", error);

    return NextResponse.json({ error: "An unexpected error occurred while creating staff member" }, { status: 500 });
  }
}
