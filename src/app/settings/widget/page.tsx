"use client";
import { Header } from "@/components/common";
import WidgetSettingsPage from "@/components/screens/Settings/WidgetSetup/WidgetSettingsPage";
// import WidgetSetupPage from "@/components/screens/Settings/WidgetSetup/WidgetSettingsPage";
import DashboardLayout from "@/layouts/DashboardLayout";

const Page = () => {
  return (
    <DashboardLayout
      header={
        <Header
          title="Widget Settings"
          description="Customize the design and settings of your widget."
        />
      }
    >
      <WidgetSettingsPage />
    </DashboardLayout>
  );
};

export default Page;
