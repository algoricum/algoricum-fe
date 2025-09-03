"use client";
import { Button } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { PasswordIcon } from "@/icons";
import { Flex, Form, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "react-query";
import { createClient } from "@/utils/supabase/config/client";

const { Title, Text } = Typography;

const PasswordSetupPage = () => {
  const { push } = useRouter();
  const [form] = Form.useForm();
  const supabase = createClient();
  const [loadingSession, setLoadingSession] = useState(true);
  const searchParams = useSearchParams();

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
      // Verify session if code is present
      if (codeFromQuery) {
        const verifySession = async () => {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (data.session) {
              setLoadingSession(false)
            } else {
              console.error({
                message: "Error",
                description: "No active session found. Please request a new reset link.",
              });
            }
          } catch (error) {
            console.error('Error verifying session:', error);
          }
        };
        verifySession();
      } else {
        setLoadingSession(false);
      }
    }
  }, [searchParams, supabase.auth]);

  const { mutate, isLoading } = useMutation(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return true;
    },
    {
      onSuccess: () => {
        SuccessToast("Password updated successfully");
        push("/login");
      },
      onError: (error: any) => {
        ErrorToast(error?.message || "Failed to update password");
      },
    },
  );

  const onFinish = (values: any) => {
    mutate(values.password);
  };

  if (loadingSession) return <p className="text-center mt-10">Loading...</p>;

  return (
    <Flex vertical gap={36} className="w-full max-w-md mx-auto">
      <Flex vertical gap={12} align="center">
        <Title level={2}>Set Your Password</Title>
        <Text className="text-Gray600 text-center">{`Enter your new password below.`}</Text>
      </Flex>

      <Form form={form} name="password-setup" layout="vertical" className="w-full" onFinish={onFinish}>
        <Flex vertical gap={18}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Please input your new password" },
              { min: 8, message: "Password must contain at least 8 characters" },
              { max: 32, message: "Password can be maximum 32 characters long" },
            ]}
          >
            <PasswordInput prefix={<PasswordIcon />} placeholder="New Password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
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
            <PasswordInput prefix={<PasswordIcon />} placeholder="Confirm Password" />
          </Form.Item>

          <Form.Item>
            <Button loading={isLoading} className="w-full" type="primary" htmlType="submit">
              Save Password
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Flex>
  );
};

export default PasswordSetupPage;
