"use client";
import { Button, Input } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { MailIcon, PasswordIcon } from "@/icons";
import { ForgotProps } from "@/interfaces/services_type";
import { resetPasswordRequest } from "@/utils/supabase/auth-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Flex, Form, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const { Title, Text } = Typography;

const ForgotPasswordPage = () => {
  const { push } = useRouter();
  const [form] = Form.useForm();
  const supabase = createClient();
  const searchParams = useSearchParams();

  // State to determine which UI to show
  const [isResetMode, setIsResetMode] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  // Check for recovery token or code in hash or query parameters
  useEffect(() => {
    // Check URL hash
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessTokenFromHash = hashParams.get("access_token");
    const typeFromHash = hashParams.get("type");

    // Check query parameters
    const tokenFromQuery = searchParams.get("token");
    const typeFromQuery = searchParams.get("type");
    const codeFromQuery = searchParams.get("code");

    // Log parameters for debugging
    console.log("Hash:", { accessToken: accessTokenFromHash, type: typeFromHash });
    console.log("Query:", { token: tokenFromQuery, type: typeFromQuery, code: codeFromQuery });

    if (
      (typeFromHash === "recovery" && accessTokenFromHash) ||
      (typeFromQuery === "recovery" && tokenFromQuery) ||
      codeFromQuery // Handle code parameter from redirect
    ) {
      setIsResetMode(true);

      // Verify session if code is present
      if (codeFromQuery) {
        const verifySession = async () => {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (data.session) {
              setLoadingSession(false);
            } else {
              console.error({
                message: "Error",
                description: "No active session found. Please request a new reset link.",
              });
              setIsResetMode(false);
            }
          } catch (error) {
            console.error("Error verifying session:", error);
            setIsResetMode(false);
          }
        };
        verifySession();
      } else {
        setLoadingSession(false);
      }
    } else {
      setIsResetMode(false);
      setLoadingSession(false);
    }
  }, [searchParams, supabase.auth]);

  // Mutation for forgot password request
  const forgotPasswordMutation = useMutation({
    mutationFn: (data: ForgotProps) => resetPasswordRequest(data.email),
    onSuccess: () => {
      SuccessToast("Password reset instructions sent to your email");
      push("/login");
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to process password reset request");
    },
  });

  // Mutation for password reset
  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      SuccessToast("Password updated successfully");
      push("/login");
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to update password");
    },
  });

  const handleFieldFocus = (fieldName: string) => {
    form.setFields([
      {
        name: fieldName,
        errors: [],
      },
    ]);
  };

  const onFinish = (values: any) => {
    if (isResetMode) {
      // Reset password mode
      resetPasswordMutation.mutate(values.password);
    } else {
      // Forgot password mode
      forgotPasswordMutation.mutate(values);
    }
  };

  if (loadingSession && isResetMode) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  return (
    <Flex vertical gap={36} className="w-full max-w-md mx-auto">
      <Flex vertical gap={12} align={isResetMode ? "center" : "start"}>
        <Title level={2}>{isResetMode ? "Set Your Password" : "Forgot Password"}</Title>
        <Text className="text-Gray600 text-center">
          {isResetMode
            ? "Enter your new password below."
            : "Enter your email address below and we'll send you instructions to reset your password."}
        </Text>
      </Flex>

      <Form
        form={form}
        name={isResetMode ? "password-setup" : "forgot-password"}
        layout="vertical"
        className="w-full"
        onFinish={onFinish}
        validateTrigger="onBlur"
        onFinishFailed={errorInfo => {
          console.log("Form validation failed:", errorInfo);
        }}
      >
        <Flex vertical gap={isResetMode ? 18 : 24}>
          {!isResetMode ? (
            // Forgot Password Form
            <>
              <Form.Item
                name="email"
                validateTrigger={["onBlur", "onSubmit"]}
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
              >
                <Input prefix={<MailIcon />} className="w-full" placeholder="Email" onFocus={() => handleFieldFocus("email")} />
              </Form.Item>

              <Form.Item>
                <Button
                  loading={forgotPasswordMutation.isPending}
                  className="bg-brand-primary hover:!bg-brand-secondary text-white w-full"
                  type="primary"
                  htmlType="submit"
                >
                  Send Reset Instructions
                </Button>
              </Form.Item>

              <Flex justify="center">
                <Text className="text-sm font-helvetica text-Gray600">
                  Remember your password?{" "}
                  <Link href="/login" className="font-helvetica-700 !text-Primary1000">
                    Login Here
                  </Link>
                </Text>
              </Flex>
            </>
          ) : (
            // Reset Password Form
            <>
              <Form.Item
                name="password"
                label="New Password"
                validateTrigger={["onBlur", "onSubmit"]}
                rules={[
                  { required: true, message: "Please input your new password" },
                  { min: 8, message: "Password must contain at least 8 characters" },
                  { max: 32, message: "Password can be maximum 32 characters long" },
                ]}
              >
                <PasswordInput prefix={<PasswordIcon />} placeholder="New Password" onFocus={() => handleFieldFocus("password")} />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                dependencies={["password"]}
                validateTrigger={["onBlur", "onSubmit"]}
                rules={[
                  { required: true, message: "Please confirm your password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) return Promise.resolve();
                      return Promise.reject(new Error("Passwords do not match!"));
                    },
                  }),
                ]}
              >
                <PasswordInput
                  prefix={<PasswordIcon />}
                  placeholder="Confirm Password"
                  onFocus={() => handleFieldFocus("confirmPassword")}
                />
              </Form.Item>

              <Form.Item>
                <Button loading={resetPasswordMutation.isPending} className="w-full" type="primary" htmlType="submit">
                  Save Password
                </Button>
              </Form.Item>
            </>
          )}
        </Flex>
      </Form>
    </Flex>
  );
};

export default ForgotPasswordPage;
