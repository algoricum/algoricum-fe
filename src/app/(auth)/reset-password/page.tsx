import ResetPasswordPage from "@/components/screens/ResetPassword";
import AuthLayout from "@/layouts/AuthLayout";

const Page = () => {
  return (
    <AuthLayout isBack={true}>
      <ResetPasswordPage />
    </AuthLayout>
  );
};

export default Page;
