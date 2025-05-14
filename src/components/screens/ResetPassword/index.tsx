"use client";
import { Button } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { PasswordIcon } from "@/icons";
import { ResetPasswordProps } from "@/interfaces/services_type";
import { Flex, Form, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation } from "react-query";
import { createClient } from "@/utils/supabase/config/client";
import { resendOtp } from "@/utils/supabase/auth-helper";

const { Title, Text } = Typography;

const ResetPasswordPage = () => {
  const { push } = useRouter();
  const [form] = Form.useForm();
  const supabase = createClient();

  // Check if user has a valid password reset session
  useEffect(() => {
    const checkResetSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        ErrorToast("Invalid or expired password reset link");
        push("/login");
      }
    };

    checkResetSession();
  }, [push]);

  const { mutate, isLoading } = useMutation((data: ResetPasswordProps) => resendOtp("email"), {
    onSuccess: () => {
      SuccessToast("Password reset successfully");
      push("/login");
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to reset password");
    },
  });

  const onFinish = (values: any) => {
    mutate({ password: values.password });
  };

  return (
    <Flex vertical gap={36} className="w-full max-w-md mx-auto">
      <Flex vertical gap={12} align="center">
        <Title level={2}>Reset Your Password</Title>
        <Text className="text-Gray600 text-center">
          Enter your new password below.
        </Text>
      </Flex>

      <Form
        form={form}
        name="reset-password"
        layout="vertical"
        className="w-full"
        onFinish={onFinish}
      >
        <Flex vertical gap={18}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Please input your new password" },
              {
                min: 8,
                message: "Password must contain at least 8 characters",
              },
              {
                max: 32,
                message: "Password can be maximum 32 characters long",
              },
            ]}
          >
            <PasswordInput prefix={<PasswordIcon />} className="w-full" placeholder="New Password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match!"));
                },
              }),
            ]}
          >
            <PasswordInput prefix={<PasswordIcon />} className="w-full" placeholder="Confirm Password" />
          </Form.Item>

          <Form.Item>
            <Button loading={isLoading} className="w-full" type="primary" htmlType="submit">
              Reset Password
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Flex>
  );
};

export default ResetPasswordPage;