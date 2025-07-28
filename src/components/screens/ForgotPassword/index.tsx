"use client";
import { Button, Input } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { MailIcon } from "@/icons";
import { ForgotProps } from "@/interfaces/services_type";
import { resetPasswordRequest } from "@/utils/supabase/auth-helper";
import { Flex, Form, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";

const { Title, Text } = Typography;

const ForgotPasswordPage = () => {
  const { push } = useRouter();
  const [form] = Form.useForm();

  const { mutate, isLoading } = useMutation((data: ForgotProps) => resetPasswordRequest(data.email), {
    onSuccess: () => {
      SuccessToast("Password reset instructions sent to your email");
      push("/login");
    },
    onError: (error: any) => {
      ErrorToast(error?.message || "Failed to process password reset request");
    },
  });

  const onFinish = (values: any) => {
    mutate(values);
  };

  return (
    <Flex vertical gap={36} className="w-full mx-auto">
      <Flex vertical gap={12} align="start">
        <Title level={2}>Forgot Password</Title>
        <Text className="text-Gray600 text-center">
          Enter your email address below and we&apos;ll send you instructions to reset your password.
        </Text>
      </Flex>

      <Form form={form} name="forgot-password" layout="vertical" className="w-full" onFinish={onFinish}>
        <Flex vertical gap={24}>
          <Form.Item
            name="email"
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
            <Input prefix={<MailIcon />} className="w-full" placeholder="Email" />
          </Form.Item>

          <Form.Item>
            <Button loading={isLoading} className="bg-brand-primary hover:!bg-brand-secondary text-white w-full" type="primary" htmlType="submit">
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
        </Flex>
      </Form>
    </Flex>
  );
};

export default ForgotPasswordPage;