"use client";
import { Header } from "@/components/common";
import ClinicSettingsPage from "@/components/screens/Settings/Clinic/clinicSettingsPage";
import DashboardLayout from "@/layouts/DashboardLayout";

const Page = () => {
  return (
    <DashboardLayout
      header={
        <Header
          title="Clinic Settings"
          description="Customize the design and settings of your clinic to match your brand’s look and feel."
        />
      }
    >
      <ClinicSettingsPage />
    </DashboardLayout>
  );
};

export default Page;
