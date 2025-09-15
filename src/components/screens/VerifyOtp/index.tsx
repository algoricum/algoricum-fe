"use client";
import { Button } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { ResendOtpProps, VerifyOtpProps } from "@/interfaces/services_type";
import { resendOtp, verifyOtp } from "@/utils/supabase/auth-helper";
import { createClinic, setClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { getUserData } from "@/utils/supabase/user-helper";
import { Flex, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import OtpInput from "react-otp-input";
import { useMutation } from "react-query";

const { Title, Text } = Typography;

const VerifyOTPPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/dashboard";
  const emailParam = searchParams.get("email");
  const fromLogin = searchParams.get("fromLogin") === "true";

  const [otp, setOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(120);
  const [user, setUser] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    const initializeUser = async () => {
      // Get email from multiple sources
      let email = emailParam || localStorage.getItem("pendingVerificationEmail") || "";

      try {
        const currentUser = await getUserData();
        setUser(currentUser);

        if (currentUser?.email) {
          email = currentUser.email;
        }
      } catch (error) {
        console.error("Failed to get user data:", error);
      }

      if (email) {
        setUserEmail(email);
      } else if (fromLogin) {
        ErrorToast("Email not found. Please login again.");
        router.push("/login");
      }
    };

    initializeUser();
  }, [emailParam, fromLogin, router]);

  const { mutate: verifyOTP, isLoading: verifyLoading } = useMutation((data: VerifyOtpProps) => verifyOtp(data.email, data.otp), {
    onSuccess: async () => {
      SuccessToast("Email verified successfully");

      // Clear stored email
      localStorage.removeItem("pendingVerificationEmail");

      if (!user?.id) {
        ErrorToast("User not found. Please try logging in again.");
        router.push("/login");
        return;
      }

      try {
        await supabase
          .from("user")
          .upsert({
            is_email_verified: true,
          })
          .eq("id", user.id);
      } catch (error) {
        console.error("Failed to update email verification status:", error);
      }

      // Check if user has a clinic
      const { data: userClinic } = await supabase
        .from("user_clinic")
        .select("clinic_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (userClinic) {
        // Fetch and set clinic data
        const { data: clinicData } = await supabase.from("clinic").select("*").eq("id", userClinic.clinic_id).single();

        if (clinicData) {
          setClinicData(clinicData);
          SuccessToast("Login successful!");
          router.push(redirectUrl);
          return;
        }
      }

      // Create default clinic for new users
      const name = user.user_metadata?.name || user.email?.split("@")[0] || `User-${user.id.slice(0, 8)}`;
      const clinicData = {
        owner_id: user.id,
        name: `${name}'s Clinic`,
        legal_business_name: "",
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

      console.log("VerifyOTPPage clinicData:", clinicData);

      try {
        const clinic = await createClinic(clinicData);
        setClinicData(clinic);
        router.push("/onboarding");
      } catch (error: any) {
        ErrorToast(error.message || "Failed to create clinic");
        router.push("/login");
      }
    },
    onError: (error: any) => {
      console.error("OTP verification error:", error);

      // Handle expired or invalid OTP
      if (error?.message?.includes("expired") || error?.message?.includes("invalid")) {
        ErrorToast("OTP has expired. Sending you a new one...");
        // Auto-resend when expired
        if (userEmail) {
          resendOTP({ email: userEmail });
        }
        return;
      }

      if (error?.message?.includes("too_many_requests")) {
        ErrorToast("Too many attempts. Please wait before trying again.");
        return;
      }

      ErrorToast(error?.message || "Invalid OTP");
    },
  });

  const { mutate: resendOTP, isLoading: resendLoading } = useMutation((data: ResendOtpProps) => resendOtp(data.email), {
    onSuccess: () => {
      SuccessToast("OTP resent successfully");
      setResendTimer(60);
      setOtp(""); // Clear current OTP when new one is sent
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to resend OTP");
    },
  });

  const handleVerify = () => {
    if (otp.length !== 6) {
      ErrorToast("Please enter a valid 6-digit OTP");
      return;
    }

    const email = userEmail || user?.email;
    if (!email) {
      ErrorToast("User email not found. Please try logging in again.");
      return;
    }

    verifyOTP({ email, otp });
  };

  const handleResend = () => {
    const email = userEmail || user?.email;
    if (!email) {
      ErrorToast("User email not found. Please try logging in again.");
      return;
    }

    resendOTP({ email });
  };

  return (
    <Flex vertical align="center" gap={36} className="w-full max-w-md mx-auto mt-10">
      <Flex vertical gap={12} align="center">
        <Title level={2}>Verify Your Email</Title>
        <Text className="text-Gray600 text-center">
          We&apos;ve sent a verification code to your email address. Please enter the code below.
        </Text>
      </Flex>

      <Flex vertical gap={24} className="w-full">
        <OtpInput
          value={otp}
          onChange={setOtp}
          numInputs={6}
          renderSeparator={<span className=""></span>}
          renderInput={props => <input {...props} className="h-16 w-12 border border-gray-300 rounded-md text-center text-5xl p-2" />}
          inputStyle="inputStyle"
          containerStyle="flex justify-between w-full"
        />

        <Button
          loading={verifyLoading}
          className="w-full bg-brand-primary hover:!bg-brand-secondary text-white"
          type="primary"
          onClick={handleVerify}
        >
          Verify Email
        </Button>

        <Flex justify="center">
          {resendTimer > 0 ? (
            <Text type="secondary">
              You can resend the OTP in <strong>{resendTimer}s</strong>
            </Text>
          ) : (
            <Text className="text-sm font-helvetica text-Gray600">
              Didn&apos;t receive a code?{" "}
              <Button type="link" className="p-0 font-helvetica-700 !text-Primary1000" onClick={handleResend} loading={resendLoading}>
                Resend
              </Button>
            </Text>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
};

export default VerifyOTPPage;
