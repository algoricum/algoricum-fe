import { HttpsProxyAgent } from "https-proxy-agent";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Environment variables
    const proxyUrl = process.env.FIXIE_PROXY_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Validate required environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing required Supabase config:", {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseAnonKey: !!supabaseAnonKey,
      });
      return NextResponse.json(
        {
          error: "Required Supabase configuration missing",
        },
        { status: 500 },
      );
    }

    // Parse request body
    const body = await req.json();
    // --- UPDATED: Destructure slug instead of clinicName ---
    const { clinicId, clinicName, clinicType, primaryContactEmail, clinicPhone, businessAddress, slug, action = "setup" } = body;

    // Validate required fields
    if (!clinicId) {
      return NextResponse.json(
        {
          error: "clinicId is required",
        },
        { status: 400 },
      );
    }

    // --- UPDATED VALIDATION: Ensure slug is provided ---
    if (!slug || slug.trim() === "") {
      return NextResponse.json(
        {
          error: "slug is required for domain setup",
        },
        { status: 400 },
      );
    }

    // Validate action
    const validActions = ["setup", "verify", "delete"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
        },
        { status: 400 },
      );
    }

    console.log("🚀 Starting clinic mailgun setup request:", {
      clinicId,
      clinicName,
      slug, // --- LOGGING THE SLUG ---
      action,
      timestamp: new Date().toISOString(),
    });

    // Prepare request to Supabase Edge Function
    const supabaseEdgeFunctionUrl = `${supabaseUrl}/functions/v1/setup-clinic-mailgun`;

    // --- UPDATED: Add slug to the payload ---
    const requestPayload = {
      clinicId,
      action,
      clinicName,
      clinicType,
      primaryContactEmail,
      clinicPhone,
      businessAddress,
      slug, // --- ADDED SLUG TO PAYLOAD ---
    };

    const headers = {
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    };

    console.log("📡 Calling Supabase Edge Function:", {
      url: supabaseEdgeFunctionUrl,
      payload: requestPayload,
      headers: { ...headers, Authorization: "[REDACTED]", apikey: "[REDACTED]" },
    });

    // Setup fetch options
    const fetchOptions: any = {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
      // No timeout property for native fetch
    };

    // Add proxy if available
    if (proxyUrl) {
      console.log("🔄 Using proxy for request");
      // Note: The native fetch doesn't directly support agents like node-fetch.
      // This part of the code might need a different approach depending on your deployment.
      // For Vercel Edge functions, you might need a different proxy library or solution.
      const agent = new HttpsProxyAgent(proxyUrl);
      fetchOptions.agent = agent;
    }

    // Make request to Supabase Edge Function using the native global `fetch`
    const startTime = Date.now();
    const supabaseResponse = await fetch(supabaseEdgeFunctionUrl, fetchOptions);
    const duration = Date.now() - startTime;

    console.log("📊 Supabase Edge Function response:", {
      status: supabaseResponse.status,
      statusText: supabaseResponse.statusText,
      duration: `${duration}ms`,
      headers: Object.fromEntries(supabaseResponse.headers.entries()),
    });

    // Parse response
    const responseData: any = await supabaseResponse.json();

    // Log response for debugging
    if (supabaseResponse.ok) {
      console.log("✅ Supabase Edge Function succeeded:", {
        clinicId,
        slug,
        action,
        success: responseData.success,
        duration: `${duration}ms`,
      });
    } else {
      console.error("❌ Supabase Edge Function failed:", {
        status: supabaseResponse.status,
        error: responseData.error,
        details: responseData.details,
        clinicId,
        slug,
        action,
        duration: `${duration}ms`,
      });
    }

    // Return response with same status code
    return NextResponse.json(responseData, {
      status: supabaseResponse.status,
    });
  } catch (error: any) {
    console.error("💥 API Route Error:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      return NextResponse.json(
        {
          error: "Request timeout. Please try again.",
          code: error.code,
        },
        { status: 504 },
      );
    }

    if (error.code === "ENOTFOUND") {
      return NextResponse.json(
        {
          error: "Network error. Could not reach Supabase.",
          code: error.code,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
