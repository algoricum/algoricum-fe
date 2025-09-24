"use client";
import { AuthSeparator } from "@/components/common";
import { Button, Input } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, WarningToast, SuccessToast } from "@/helpers/toast";
import { useClinicCheck } from "@/hooks/useClinicCheck";
import { MailIcon, PasswordIcon } from "@/icons";
import type { LoginProps } from "@/interfaces/services_type";
import { checkUserStatus, signInWithPassword } from "@/utils/supabase/auth-helper";
import { setClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { setUserData } from "@/utils/supabase/user-helper";
import { Flex, Form, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "react-query";

const { Text } = Typography;
const LoginPage = () => {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/dashboard";
  const [form] = Form.useForm();
  const { checkAndRedirectIfNoClinic } = useClinicCheck();

  const handleFieldFocus = (fieldName: string) => {
    form.setFields([
      {
        name: fieldName,
        errors: [],
      },
    ]);
  };

  const { mutate, isLoading } = useMutation((data: LoginProps) => signInWithPassword(data.email, data.password), {
    onSuccess: async (data: any) => {
      console.log("Login success data:", data); // Debug log
      setUserData(data?.user);
      // More robust email verification check
      const user = data?.user;
      if (!user) {
        ErrorToast("Login failed. User data not found.");
        return;
      }
      // Check multiple possible fields for email verification
      const isEmailVerified = user.is_email_verified !== null && user.is_email_verified !== undefined;

      console.log("Email verification status:", {
        is_email_verified: user.is_email_verified,
        isEmailVerified,
      }); // Debug log
      if (!isEmailVerified) {
        console.log("Email not verified, redirecting to OTP page"); // Debug log
        WarningToast("Please verify your email before continuing.");
        // Auto-resend verification email
        const supabase = createClient();
        try {
          const { error } = await supabase.auth.resend({
            type: "signup",
            email: user.email,
          });
          if (error) {
            console.error("Resend error:", error);
            ErrorToast("Failed to send verification code. Please try manually.");
          } else {
            WarningToast("A new verification code has been sent to your email.");
          }
        } catch (error) {
          console.error("Failed to resend verification email:", error);
        }
        // Store user email in localStorage for OTP page
        localStorage.setItem("pendingVerificationEmail", user.email);
        push(`/verify-otp?redirectUrl=${redirectUrl}&email=${encodeURIComponent(user.email)}&fromLogin=true`);
        return;
      }
      const id = data?.user?.id;
      const flag: boolean = await checkUserStatus(id);
      if (!flag) {
        push("/inactive");
        return; // Prevent further execution
      }
      const supabase = createClient();
      // Proceed with clinic check for verified users
      SuccessToast("Logged In succesfully");
      checkAndRedirectIfNoClinic(supabase, user.id, { push }, redirectUrl, setClinicData);
    },
    onError: (error: any) => {
      console.error("Login error:", error); // Debug log
      // Handle specific error cases
      if (error?.message?.includes("Email not confirmed") || error?.message?.includes("email_confirmed_at")) {
        // Extract email from form values for redirect
        const email = form.getFieldValue("email");
        if (email) {
          localStorage.setItem("pendingVerificationEmail", email);
          // Auto-resend verification
          const supabase = createClient();
          supabase.auth
            .resend({
              type: "signup",
              email: email,
            })
            .then(({ error }) => {
              if (!error) {
                WarningToast("Verification code sent to your email.");
              }
            });
          push(`/verify-otp?redirectUrl=${redirectUrl}&email=${encodeURIComponent(email)}&fromLogin=true`);
          return;
        } else {
          ErrorToast("Please verify your email. Check your inbox for verification code.");
        }
        return;
      }
      if (error?.message?.includes("Invalid login credentials")) {
        ErrorToast("Invalid email or password. Please check your credentials.");
        return;
      }
      if (error?.message?.includes("Too many requests")) {
        ErrorToast("Too many login attempts. Please wait a moment and try again.");
        return;
      }

      if (error.code == "PGRST116") {
        ErrorToast("Account does not exist in system");
        return;
      }
      // Generic error handling
      ErrorToast(error?.message || error?.error_description || "Login failed. Please try again.");
    },
  });
  const onFinish = (values: any) => {
    mutate(values);
  };
  return (
    <Flex vertical gap={24} className="w-full justify-center">
      <div>
        <h1 className="text-2xl font-bold mb-1">Welcome To Algoricum</h1>
        <p className="text-sm text-gray-600">AI-powered lead optimization for healthcare clinics</p>
      </div>
      <Form
        form={form}
        name="login"
        layout="vertical"
        className="w-full"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        validateTrigger="onBlur"
        onFinishFailed={errorInfo => {
          console.log("Form validation failed:", errorInfo);
        }}
      >
        <Flex vertical>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                required: true,
                message: "Please input your email",
              },
              {
                type: "email",
                message: "Invalid email address",
              },
            ]}
            validateTrigger={["onBlur", "onSubmit"]}
          >
            <Input
              prefix={<MailIcon />}
              className="w-full rounded-md py-2"
              placeholder="Type here"
              onFocus={() => handleFieldFocus("email")}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please input your password" }]}
            validateTrigger={["onBlur", "onSubmit"]}
          >
            <PasswordInput
              prefix={<PasswordIcon />}
              className="w-full rounded-md py-2"
              placeholder="Type here"
              onFocus={() => handleFieldFocus("password")}
            />
          </Form.Item>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-brand-primary hover:underline">
              Forgot Password?
            </Link>
          </div>
          <Form.Item className="mt-2">
            <Button
              loading={isLoading}
              className="w-full bg-brand-primary hover:!bg-brand-secondary text-white py-2 rounded-md"
              type="primary"
              htmlType="submit"
            >
              Log In
            </Button>
          </Form.Item>
        </Flex>
      </Form>
      <AuthSeparator />
      <div className="text-center mt-2">
        <Text className="text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="!text-brand-primary font-medium hover:underline">
            Sign Up
          </Link>
        </Text>
      </div>
    </Flex>
  );
};
export default LoginPage;
