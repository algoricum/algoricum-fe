import ForgotPasswordPage from "@/components/screens/ForgotPassword";
import AuthLayout from "@/layouts/AuthLayout";

const Page = () => {
  return (
    <AuthLayout isBack={true}>
      <ForgotPasswordPage />
    </AuthLayout>
  );
};

export default Page;
