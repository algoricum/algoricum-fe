"use client";
import { AuthSeparator } from "@/components/common";
import { Button, Input } from "@/components/elements";
import PasswordInput from "@/components/elements/PasswordInput";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { MailIcon, PasswordIcon } from "@/icons";
import { SignupProps } from "@/interfaces/services_type";
import { saveUser } from "@/redux/accessors/user.accessors";
import { signUp } from "@/utils/supabase/auth-helper";
// import { createClient } from "@/utils/supabase/config/client";
import { setUserData } from "@/utils/supabase/user-helper";
import { Flex, Form, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";

const { Text } = Typography;
const SignupPage = () => {

  const { push } = useRouter();
  const [form] = Form.useForm();

  const { mutate, isLoading } = useMutation((data: SignupProps) => signUp(data.name, data.email, data.password), {
    onSuccess: (data: any) => {
      if (!data?.user) return;
      saveUser(data.user);
      setUserData(data.user)
      push("/verify-otp");
      SuccessToast("OTP sent successfully. Please verify your email");
    },
    onError: (error: any) => {
      ErrorToast(
        error?.message ||
        error?.error_description ||
        "An error occurred while signing up"
      );
    },
  });

  const onFinish = (values: any) => {
    mutate(values);
  };

  // const handleSocialLogin = async (provider: 'google' | 'apple') => {
  //   try {
  //     // Implement social login with Supabase
  //     const supabase = createClient();

  //     let { error } = await supabase.auth.signInWithOAuth({
  //       provider,
  //       options: {
  //         redirectTo: `${window.location.origin}/auth/oauth-redirect`
  //       }
  //     });

  //     if (error) throw error;

  //   } catch (error: any) {
  //     ErrorToast(error?.message || `Failed to sign in with ${provider}`);
  //   }
  // };

  return (
    <Flex vertical gap={36} className="w-full">
      <div>
        <h1 className="text-2xl font-bold mb-1 font">Create Your Algoricum Account</h1>
        <p className="text-sm text-gray-600">Start optimizing your clinic’s lead flow with AI-powered tools.</p>
      </div>

      <Form form={form} name="signup" layout="vertical" className="w-full" initialValues={{ remember: true }} onFinish={onFinish}>
        <Flex vertical gap={36}>
          <Flex vertical gap={18}>
            <Form.Item
              name="name"
              label="Full Name"
              className="flex-1 w-full"
              rules={[{ required: true, message: "Please input your name" }]}
            >
              <Input className="w-full" placeholder="Name" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              className="flex-1 w-full"
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

            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Please input your password" },
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
              <PasswordInput prefix={<PasswordIcon />} className="w-full" placeholder="Password" />
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
          </Flex>

          <Form.Item>
            <Button loading={isLoading} className="w-full  bg-brand-primary hover:!bg-brand-secondary text-white" type="primary" htmlType="submit">
              Sign Up
            </Button>
          </Form.Item>
          <AuthSeparator />
          {/* <Flex gap={18} className="flex-1 flex-col lg:flex-row justify-center items-center w-full">
            <SocialButton
              isGoogle={true}
              label="Continue With Google"
              onClick={() => handleSocialLogin('google')}
            />
          </Flex> */}
          <Text className="text-center text-sm font-helvetica text-Gray600">
            Already have an account?{"   "}
            <Link href="/login" className="font-helvetica-700 !text-brand-primary">
              Login Here
            </Link>
          </Text>
        </Flex>
      </Form>
    </Flex>
  );
};

export default SignupPage;