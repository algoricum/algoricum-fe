"use client";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { saveUser } from "@/redux/accessors/user.accessors";
import { createClinic } from "@/utils/supabase/clinic-helper"; // Import createClinic
import { createClient } from "@/utils/supabase/config/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function OAuthRedirectPage() {
  const router = useRouter();
  const didRun = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const handleOAuthCallback = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        ErrorToast("Authentication failed");
        router.push("/login");
        return;
      }

      const user = session.user;

      try {
        // Save user to Redux and set user data
        saveUser(user);

        // Check if this user exists in the auth.users table by ID (returning user)
        const { data: existingUser } = await supabase.from("user").select("id, is_email_verified").eq("id", user.id).single();

        // If user exists in our user table, they're a returning user
        if (existingUser) {
          SuccessToast("Welcome back! You're now logged in.");
          router.push("/dashboard");
          return;
        }

        // Check if email already exists in the system (same email, different auth provider)
        const { data: emailUser } = await supabase.from("user").select("id").eq("email", user.email).single();

        if (emailUser) {
          SuccessToast("Account found with this email. Logging you in.");
          router.push("/dashboard");
          return;
        }

        // No existing user found - this is a new signup
        // Create new user record
        const name = user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0] || "Unknown";
        const email = user.email;
        const { error: insertError } = await supabase.from("user").insert([
          {
            id: user.id,
            name,
            email,
            is_email_verified: true, // OAuth users are typically verified
          },
        ]);

        if (insertError) {
          if (insertError.code === "23505") {
            SuccessToast("Login successful!");
            router.push("/dashboard");
            return;
          }
          throw insertError;
        }

        // Create default clinic for the new user
        const clinicData = {
          owner_id: user.id,
          name: `${name}'s Clinic`,
          legal_business_name: `${name}'s Clinic`,
          dba_name: "",
          address: "",
          phone: "",
          email: "",
          language: "en",
          business_hours: {},
          calendly_link: "",
          logo: "",
          tone_selector: "professional",
          sentence_length: "medium",
          formality_level: "formal",
          clinic_type: "general",
          uses_hubspot: false,
          uses_ads: false,
          has_chatbot: false,
          other_tools: "",
          widget_theme: {
            primary_color: "#2563EB",
            font_family: "Inter, sans-serif",
            border_radius: "8px",
          },
          dashboard_theme: {
            primary_color: "#2563EB",
          },
        };

        await createClinic(clinicData);

        SuccessToast("Account and clinic created successfully!");
        router.push("/onboarding"); // Redirect to onboarding to complete clinic setup
      } catch (e) {
        console.error("Error during user or clinic creation:", e);
        ErrorToast("There was a problem setting up your account. Please try again.");

        // Clean up - sign out the user if we couldn't create their record
        await supabase.auth.signOut();
        router.push("/signup");
      }
    };

    handleOAuthCallback();
  }, [router, supabase]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center p-8 animate-pulse">
        <div className="inline-block mx-auto mb-4">
          <div className="w-12 h-12 border-t-4 border-b-4 border-brand-primary rounded-full animate-spin"></div>
        </div>
        <p className="text-xl font-medium">Processing your authentication...</p>
        <p className="text-gray-500 mt-2">Please wait while we verify your account.</p>
      </div>
    </div>
  );
}
