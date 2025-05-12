import VerifyOtpPage from "@/components/screens/VerifyOtp";
import AuthLayout from "@/layouts/AuthLayout";

const Page = () => {
  return (
    <AuthLayout isBack={true}>
      <VerifyOtpPage />
    </AuthLayout>
  );
};

export default Page;
