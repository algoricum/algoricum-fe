// app/api/create-staff/route.ts - Enhanced debugging with additional error handling

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { setTimeout } from "timers/promises";

// Error codes for tracking
enum ErrorCode {
  INVALID_INPUT = "ERR_INVALID_INPUT",
  INVALID_EMAIL = "ERR_INVALID_EMAIL",
  USER_EXISTS = "ERR_USER_EXISTS",
  AUTH_CREATION_FAILED = "ERR_AUTH_CREATION_FAILED",
  USER_RECORD_FAILED = "ERR_USER_RECORD_FAILED",
  CLINIC_RELATION_FAILED = "ERR_CLINIC_RELATION_FAILED",
  EMAIL_SEND_FAILED = "ERR_EMAIL_SEND_FAILED",
  SUPABASE_CONNECTION_FAILED = "ERR_SUPABASE_CONNECTION_FAILED",
  RATE_LIMIT_EXCEEDED = "ERR_RATE_LIMIT_EXCEEDED",
  TIMEOUT = "ERR_TIMEOUT",
  UNEXPECTED = "ERR_UNEXPECTED",
}

// Interface for enhanced response
interface EnhancedCreateStaffResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
    };
    tempPassword?: string;
    emailSent: boolean;
    emailMethod?: string;
    emailError?: string;
    emailDetails?: any;
    errorCode?: string;
  };
  message: string;
}

// Interface for email result
interface EmailResult {
  success: boolean;
  method?: string;
  error?: string;
  errorCode?: string;
  details?: any;
  credentials?: {
    email: string;
    password: string;
    name: string;
  };
}

// Supabase admin client
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Validate environment variables at startup
const missingEnvVars: string[] = [];
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnvVars.push("NEXT_PUBLIC_SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");
if (!process.env.NEXT_PUBLIC_APP_URL) missingEnvVars.push("NEXT_PUBLIC_APP_URL");

if (missingEnvVars.length > 0) {
  console.warn("⚠️ Missing environment variables:", JSON.stringify({ missing: missingEnvVars }, null, 2));
}

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
 * Test Supabase connection and email capabilities
 */
async function testSupabaseConnection(): Promise<{ isValid: boolean; issues: string[] }> {
  const issues: string[] = [];
  const timeoutMs = 5000;

  try {
    // Test database connection with timeout
    const dbPromise = supabaseAdmin.from("user").select("count").limit(1);
    const dbResult = await Promise.race([
      dbPromise,
      setTimeout(timeoutMs).then(() => {
        throw new Error("Database connection timed out");
      }),
    ]);
    if (dbResult.error) {
      issues.push(`Database connection failed: ${dbResult.error.message}`);
    }

    // Test auth admin access with timeout
    const authPromise = supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const authResult = await Promise.race([
      authPromise,
      setTimeout(timeoutMs).then(() => {
        throw new Error("Auth admin access timed out");
      }),
    ]);
    if (authResult.error) {
      issues.push(`Auth admin access failed: ${authResult.error.message}`);
    }
  } catch (error) {
    issues.push(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Enhanced email sending with retry logic and detailed error reporting
 */
async function sendWelcomeEmail(email: string, tempPassword: string, name: string, clinicName: string): Promise<EmailResult> {
  const maxRetries = 3;
  const baseDelayMs = 1000;
  const timeoutMs = 10000;

  console.log(`🚀 Starting email send process for: ${email}`, {
    clinic: clinicName,
    user: name,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const loginUrl = `${baseUrl}/login`;

  console.log(`🔗 Login URL: ${loginUrl}`, { baseUrl });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Method 1: generateLink
      console.log(`📧 Attempt ${attempt}: Trying generateLink...`);
      const linkPromise = supabaseAdmin.auth.admin.generateLink({
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
      const { data: linkData, error: linkError } = await Promise.race([
        linkPromise,
        setTimeout(timeoutMs).then(() => {
          throw new Error("generateLink timed out");
        }),
      ]);

      if (linkError) {
        console.error(`❌ generateLink failed (attempt ${attempt}):`, {
          code: linkError.code,
          message: linkError.message,
          status: linkError.status,
        });

        // Check for rate limit
        if (linkError.status === 429 || linkError.message.includes("rate limit")) {
          return {
            success: false,
            error: `Rate limit exceeded: ${linkError.message}`,
            errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
            method: "generateLink",
            details: linkError,
            credentials: { email, password: tempPassword, name },
          };
        }

        // Method 2: inviteUserByEmail
        console.log(`📧 Attempt ${attempt}: Trying inviteUserByEmail...`);
        const invitePromise = supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            name: name,
            temp_password: tempPassword,
            clinic_name: clinicName,
            user_type: "staff",
          },
          redirectTo: loginUrl,
        });
        const { data: inviteData, error: inviteError } = await Promise.race([
          invitePromise,
          setTimeout(timeoutMs).then(() => {
            throw new Error("inviteUserByEmail timed out");
          }),
        ]);

        if (inviteError) {
          console.error(`❌ inviteUserByEmail failed (attempt ${attempt}):`, {
            code: inviteError.code,
            message: inviteError.message,
            status: inviteError.status,
          });

          // Method 3: Simple invite
          console.log(`📧 Attempt ${attempt}: Trying simple invite...`);
          const simplePromise = supabaseAdmin.auth.admin.inviteUserByEmail(email);
          const { data: simpleData, error: simpleError } = await Promise.race([
            simplePromise,
            setTimeout(timeoutMs).then(() => {
              throw new Error("Simple invite timed out");
            }),
          ]);

          if (simpleError) {
            console.error(`❌ Simple invite failed (attempt ${attempt}):`, {
              code: simpleError.code,
              message: simpleError.message,
              status: simpleError.status,
            });

            if (attempt === maxRetries) {
              return {
                success: false,
                error: `All email methods failed. Last error: ${simpleError.message}`,
                errorCode: ErrorCode.EMAIL_SEND_FAILED,
                method: "all_failed",
                details: {
                  generateLinkError: linkError,
                  inviteError: inviteError,
                  simpleError: simpleError,
                },
                credentials: { email, password: tempPassword, name },
              };
            }
            continue; // Retry
          }

          console.log(`✅ Simple invite succeeded (attempt ${attempt}):`, simpleData);
          return {
            success: true,
            method: "simple_invite",
            details: simpleData,
          };
        }

        console.log(`✅ inviteUserByEmail succeeded (attempt ${attempt}):`, inviteData);
        return {
          success: true,
          method: "inviteUserByEmail",
          details: inviteData,
        };
      }

      console.log(`✅ generateLink succeeded (attempt ${attempt}):`, linkData);
      return {
        success: true,
        method: "generateLink",
        details: linkData,
      };
    } catch (error) {
      console.error(`💥 Email send error (attempt ${attempt}):`, {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Log environment for debugging
      console.log("🔍 Environment check:", {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "❌ Using default",
      });

      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          errorCode: error instanceof Error && error.message.includes("timed out") ? ErrorCode.TIMEOUT : ErrorCode.EMAIL_SEND_FAILED,
          method: "exception",
          credentials: { email, password: tempPassword, name },
        };
      }

      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying after ${delay}ms...`);
      await setTimeout(delay);
    }
  }

  return {
    success: false,
    error: "Max retries exceeded for email sending",
    errorCode: ErrorCode.EMAIL_SEND_FAILED,
    method: "max_retries",
    credentials: { email, password: tempPassword, name },
  };
}

/**
 * POST handler for creating staff
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<EnhancedCreateStaffResponse | { error: string; errorCode: string }>> {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  console.log(`🚀 [${requestId}] Starting staff creation at ${timestamp}`, {
    ip,
    headers: Object.fromEntries(request.headers.entries()),
  });

  // Test Supabase connection
  const connectionTest = await testSupabaseConnection();
  if (!connectionTest.isValid) {
    console.error(`🔥 [${requestId}] Supabase connection issues:`, connectionTest.issues);
    return NextResponse.json(
      {
        error: `Supabase connection failed: ${connectionTest.issues.join(", ")}`,
        errorCode: ErrorCode.SUPABASE_CONNECTION_FAILED,
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { email, name, clinicId, roleId } = body;

    console.log(`📝 [${requestId}] Creating staff: ${name} (${email}) for clinic ${clinicId}`);

    // Validate inputs
    if (!email || !name || !clinicId || !roleId) {
      console.error(`❌ [${requestId}] Invalid input:`, { email, name, clinicId, roleId });
      return NextResponse.json(
        { error: "Email, name, clinic ID, and role ID are required", errorCode: ErrorCode.INVALID_INPUT },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`❌ [${requestId}] Invalid email format: ${email}`);
      return NextResponse.json({ error: "Invalid email format", errorCode: ErrorCode.INVALID_EMAIL }, { status: 400 });
    }

    const userPassword = generateRandomPassword();
    console.log(`🔐 [${requestId}] Generated password (length: ${userPassword.length})`);

    // Check existing user
    const { data: existingUser, error: userCheckError } = await supabaseAdmin.from("user").select("id, email").eq("email", email).single();

    if (userCheckError && userCheckError.code !== "PGRST116") {
      // PGRST116 means no rows returned
      console.error(`❌ [${requestId}] User check failed:`, userCheckError);
      return NextResponse.json(
        { error: `Failed to check existing user: ${userCheckError.message}`, errorCode: ErrorCode.UNEXPECTED },
        { status: 500 },
      );
    }

    if (existingUser) {
      console.error(`❌ [${requestId}] User already exists: ${email}`);
      return NextResponse.json({ error: "User with this email already exists", errorCode: ErrorCode.USER_EXISTS }, { status: 409 });
    }

    // Get clinic
    const { data: clinic, error: clinicError } = await supabaseAdmin.from("clinic").select("name").eq("id", clinicId).single();

    if (clinicError) {
      console.error(`❌ [${requestId}] Clinic fetch failed:`, clinicError);
      return NextResponse.json(
        { error: `Failed to fetch clinic: ${clinicError.message}`, errorCode: ErrorCode.UNEXPECTED },
        { status: 500 },
      );
    }

    console.log(`🏥 [${requestId}] Clinic found: ${clinic?.name || "Unknown"}`);

    // Create auth user
    console.log(`👤 [${requestId}] Creating auth user...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: false, // Let invite handle email confirmation
      user_metadata: {
        name,
        is_staff: true,
        clinic_id: clinicId,
      },
    });

    if (authError || !authData.user) {
      console.error(`❌ [${requestId}] Auth user creation failed:`, authError);
      return NextResponse.json(
        {
          error: `Failed to create auth user: ${authError?.message}`,
          errorCode: ErrorCode.AUTH_CREATION_FAILED,
        },
        { status: 500 },
      );
    }

    console.log(`✅ [${requestId}] Auth user created: ${authData.user.id}`);

    try {
      // Create user record
      console.log(`📊 [${requestId}] Creating user record...`);
      const { error: userError } = await supabaseAdmin.from("user").insert({
        id: authData.user.id,
        email,
        name,
        user_id: authData.user.id,
        is_email_verified: false, // Will be verified via email
      });

      if (userError) {
        console.error(`❌ [${requestId}] User record creation failed:`, userError);
        throw new Error(`User record creation failed: ${userError.message}`);
      }

      console.log(`✅ [${requestId}] User record created`);

      // Create clinic relationship
      console.log(`🔗 [${requestId}] Creating clinic relationship...`);
      const { error: ucError } = await supabaseAdmin.from("user_clinic").insert({
        user_id: authData.user.id,
        clinic_id: clinicId,
        role_id: roleId,
        is_active: true,
      });

      if (ucError) {
        console.error(`❌ [${requestId}] Clinic relationship creation failed:`, ucError);
        throw new Error(`Clinic relationship creation failed: ${ucError.message}`);
      }

      console.log(`✅ [${requestId}] Clinic relationship created`);
    } catch (error) {
      // Rollback auth user
      console.log(`🔄 [${requestId}] Rolling back auth user: ${authData.user.id}`);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from("user").delete().eq("id", authData.user.id);

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to create user records",
          errorCode:
            error instanceof Error && error.message.includes("user record")
              ? ErrorCode.USER_RECORD_FAILED
              : ErrorCode.CLINIC_RELATION_FAILED,
        },
        { status: 500 },
      );
    }

    // Send email
    console.log(`📧 [${requestId}] Attempting to send welcome email...`);
    const emailResult = await sendWelcomeEmail(email, userPassword, name, clinic?.name || "Our Clinic");

    console.log(`📧 [${requestId}] Email result:`, emailResult);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
        },
        tempPassword: userPassword, // Remove in production
        emailSent: emailResult.success,
        emailMethod: emailResult.method,
        emailError: emailResult.error,
        emailDetails: emailResult.details,
        errorCode: emailResult.errorCode,
      },
      message: emailResult.success
        ? "Staff member created successfully and email sent"
        : "Staff member created but email sending failed - check logs",
    });
  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error:`, {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "An unexpected error occurred while creating staff member",
        errorCode: ErrorCode.UNEXPECTED,
      },
      { status: 500 },
    );
  }
}
