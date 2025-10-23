"use client";
import { Button } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { PasswordIcon } from "@/icons";
import AuthLayout from "@/layouts/AuthLayout";
import { createClient } from "@/utils/supabase/config/client";
import Flex from "antd/es/flex";
import Form from "antd/es/form";
import Typography from "antd/es/typography";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
const { Title, Text } = Typography;

const PasswordSetupPage = () => {
  const [form] = Form.useForm();
  const supabase = createClient();
  const [loadingSession, setLoadingSession] = useState(true);
  const searchParams = useSearchParams();

  // Check for recovery token or code in hash or query parameters
  useEffect(() => {
    // Check URL hash
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
        }
      } catch (error) {
        console.error("Error verifying session:", error);
      }
    };
    verifySession();
  }, [searchParams, supabase.auth]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          logged_first: false,
        },
      });
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      SuccessToast("Password updated successfully");
      form.resetFields();

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to update password");
    },
  });

  const onFinish = (values: any) => {
    mutate(values.password);
  };

  const onFinishFailed = () => {
    // This will trigger validation and show errors for all fields
    form.validateFields();
  };

  const handleFieldFocus = (fieldName: string) => {
    form.setFields([
      {
        name: fieldName,
        errors: [],
      },
    ]);
  };

  if (loadingSession) return <p className="text-center mt-10">Loading...</p>;

  return (
    <AuthLayout isBack={true}>
      <Flex vertical gap={36} className="w-full max-w-md mx-auto">
        <Flex vertical gap={12} align="center">
          <Title level={2}>Set Your Password</Title>
          <Text className="text-Gray600 text-center">{`Enter your new password below.`}</Text>
        </Flex>

        <Form
          form={form}
          name="password-setup"
          layout="vertical"
          className="w-full"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          validateTrigger="onBlur"
        >
          <Flex vertical gap={18}>
            <Form.Item
              name="password"
              label="New Password"
              validateTrigger="onBlur"
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
              validateTrigger="onBlur"
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
              <PasswordInput prefix={<PasswordIcon />} placeholder="Confirm Password" onFocus={() => handleFieldFocus("confirmPassword")} />
            </Form.Item>

            <Form.Item>
              <Button loading={isPending} className="w-full" type="primary" htmlType="submit">
                Save Password
              </Button>
            </Form.Item>
          </Flex>
        </Form>
      </Flex>
    </AuthLayout>
  );
};

export default PasswordSetupPage;
