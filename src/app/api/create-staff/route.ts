import { sendWelcomeEmail } from "@/app/api/create-staff/welcomeEmail";
import { ApiErrorResponse, CreateStaffRequest, CreateStaffResponse } from "@/interfaces/createStaffApi/types";
import { generateRandomPassword } from "@/utils/createStaffApiUtils";
import { createAdminClient } from "@/utils/supabase/config/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse<CreateStaffResponse | ApiErrorResponse>> {
  try {
    const supabaseAdmin = createAdminClient();
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
        tempPassword: userPassword,
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
