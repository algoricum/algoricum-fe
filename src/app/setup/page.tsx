"use client";
import { Header } from "@/components/common";
import SetupPage from "@/components/screens/Setup/SetupPage";
import DashboardLayout from "@/layouts/DashboardLayout";

const Setup = () => {
  return (
    <DashboardLayout
      header={
        <Header
          title={"Manage Your API Keys"}
          description={"Securely create, view, and manage your API keys to integrate and authenticate your applications effortlessly."}
        />
      }
    >
      <SetupPage />
    </DashboardLayout>
  );
};

export default Setup;
