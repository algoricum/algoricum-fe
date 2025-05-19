"use client";
import { Button } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { ResendOtpProps, VerifyOtpProps } from "@/interfaces/services_type";
import { Flex, Form, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useMutation } from "react-query";
import OtpInput from 'react-otp-input';
import { getUserData } from "@/utils/supabase/user-helper";
import { resendOtp, verifyOtp } from "@/utils/supabase/auth-helper";

const { Title, Text } = Typography;

const VerifyOTPPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") ?? "/dashboard";
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [user, setUser] = useState<any>(null);
useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);
  useEffect(() => {
    (async () => {
      const currentUser = await getUserData();
      setUser(currentUser);
    })();
  }, []);

  const { mutate: verifyOTP, isLoading: verifyLoading } = useMutation(
    (data: VerifyOtpProps) => verifyOtp(data.email,data.otp),
    {
      onSuccess: () => {
        SuccessToast("Email verified successfully");
        router.push("/onboarding");
      },
      onError: (error: any) => {
        ErrorToast(error?.message || "Invalid OTP");
      },
    }
  );

  const { mutate: resendOTP, isLoading: resendLoading } = useMutation(
    (data: ResendOtpProps) => resendOtp(data.email),
    {
      onSuccess: () => {
        SuccessToast("OTP resent successfully");
        setResendTimer(60);
      },
      onError: (error: any) => {
        ErrorToast(error?.message || "Failed to resend OTP");
      },
    }
  );

  const handleVerify = () => {
    if (otp.length !== 6) {
      ErrorToast("Please enter a valid 6-digit OTP");
      return;
    }

    if (!user?.email) {
      ErrorToast("User email not found. Please try logging in again.");
      return;
    }

    verifyOTP({ email: user.email, otp });
  };

  const handleResend = () => {
    if (!user?.email) {
      ErrorToast("User email not found. Please try logging in again.");
      return;
    }

    resendOTP({ email: user.email });
  };

  return (
    <Flex vertical align="center" gap={36} className="w-full max-w-md mx-auto mt-10">
      <Flex vertical gap={12} align="center">
        <Title level={2}>Verify Your Email</Title>
        <Text className="text-Gray600 text-center">
          We've sent a verification code to your email address. Please enter the code below.
        </Text>
      </Flex>

      <Flex vertical gap={24} className="w-full">
        <OtpInput
          value={otp}
          onChange={setOtp}
          numInputs={6}
          renderSeparator={<span className="w-4"></span>}
          renderInput={(props) => <input {...props} className="w-12 h-12 border border-gray-300 rounded-md text-center text-xl" />}
          inputStyle="inputStyle"
          containerStyle="flex justify-between w-full"
        />

        <Button
          loading={verifyLoading}
          className="w-full  bg-brand-primary hover:!bg-brand-secondary text-white"
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
            Didn't receive a code?{" "}
            <Button
              type="link"
              className="p-0 font-helvetica-700 !text-Primary1000"
              onClick={handleResend}
              loading={resendLoading}
            >
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