"use client";
import { Header } from "@/components/common";
import SettingsTabs from "@/components/screens/Settings/SettingsTabs";
import DashboardLayout from "@/layouts/DashboardLayout";

const Page = () => {
  return (
    <DashboardLayout
      header={<Header title="Profile Settings" description="Manage your profile and application settings." showHamburgerMenu={true} />}
    >
      <SettingsTabs />
    </DashboardLayout>
  );
};

export default Page;
