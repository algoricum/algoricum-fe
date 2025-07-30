"use client";
import { Button } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { PasswordIcon } from "@/icons";
import { Flex, Form, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "react-query";
import { createClient } from "@/utils/supabase/config/client";

const { Title, Text } = Typography;

const PasswordSetupPage = () => {
  const { push } = useRouter();
  const [form] = Form.useForm();
  const supabase = createClient();
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const handleRedirect = async () => {
      if (window.location.href.includes("access_token")) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          ErrorToast("Failed to restore session");
          push("/login");
          return;
        }
      }
      setLoadingSession(false);
    };

    handleRedirect();
  }, []);

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
