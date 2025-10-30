"use client";
import { Header } from "@/components/common";
import SettingsTabs from "@/components/screens/Settings/SettingsTabs";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function SettingsContent() {
  return (
    <DashboardLayout header={<Header title="Profile Settings" description="Manage your profile and application settings." />}>
      <SettingsTabs />
    </DashboardLayout>
  );
}
