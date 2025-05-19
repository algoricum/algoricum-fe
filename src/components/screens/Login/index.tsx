"use client"
import { Button, Input } from "@/components/elements"
import PasswordInput from "@/components/elements/PasswordInput"
import { ErrorToast } from "@/helpers/toast"
import { MailIcon, PasswordIcon } from "@/icons"
import type { LoginProps } from "@/interfaces/services_type"
import { Flex, Form, Typography } from "antd"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "react-query"
import { createClient } from "@/utils/supabase/config/client"
import { AuthSeparator, SocialButton } from "@/components/common"
import { signInWithPassword } from "@/utils/supabase/auth-helper"
import { useClinicCheck } from "@/hooks/useClinicCheck"
import { setClinicData } from "@/utils/supabase/clinic-helper"
import { setUserData } from "@/utils/supabase/user-helper"

const { Text } = Typography

const LoginPage = () => {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirectUrl") || "/dashboard"
  const [form] = Form.useForm()
  const { checkAndRedirectIfNoClinic } = useClinicCheck();
  const { mutate, isLoading } = useMutation((data: LoginProps) => signInWithPassword(data.email, data.password), {
    onSuccess: (data: any) => {
      setUserData(data?.user)

      // Check if email is verified
      if (!data?.user?.is_email_verified) {
        push(`/verify-otp?redirectUrl=${redirectUrl}`)
        return
      }

      const supabase = createClient()

      // Step 1: Get clinic_id from user_clinic
      checkAndRedirectIfNoClinic(
        supabase, 
        data.user.id, 
        { push }, // Pass router.push
        redirectUrl, 
        setClinicData // Pass your clinic data setter
      );
    },
    onError: (error: any) => {
      ErrorToast(error?.message || error?.error_description || "Invalid email or password")
    },
  })

  const onFinish = (values: any) => {
    mutate(values)
  }

  const handleSocialLogin = async (provider: "google" | "apple") => {
    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectUrl=${redirectUrl}`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      ErrorToast(error?.message || `Failed to sign in with ${provider}`)
    }
  }

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
          >
            <Input prefix={<MailIcon />} className="w-full rounded-md py-2" placeholder="Type here" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please input your password" }]}
          >
            <PasswordInput prefix={<PasswordIcon />} className="w-full rounded-md py-2" placeholder="Type here" />
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
      <Flex gap={12} className="flex-col justify-center items-center sm:flex-row w-full">
        <SocialButton
        isGoogle={true}
        label="Continue With Google"
        onClick={() => handleSocialLogin("google")}
        />
      </Flex>


      <div className="text-center mt-2">
        <Text className="text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/signup" className="!text-brand-primary font-medium hover:underline">
            Sign Up
          </Link>
        </Text>
      </div>
    </Flex>
  )
}

export default LoginPage
