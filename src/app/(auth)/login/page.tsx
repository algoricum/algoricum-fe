import LoginPage from "@/components/screens/Login";
import AuthLayout from "@/layouts/AuthLayout";

const Page = () => {
  console.log("RENDER LOGIN PAGE");

  return (
    <AuthLayout>
      <LoginPage />
    </AuthLayout>
  );
};

export default Page;
