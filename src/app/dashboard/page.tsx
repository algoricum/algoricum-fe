"use client";
import { Header } from "@/components/common";
import DashboardLayout from "@/layouts/DashboardLayout";

const Page = () => {
  return (
    <DashboardLayout
    header={
        <Header
          title="Dashboard"
          description="Here dashboard details will be shown"
        />
      }
    >
      <div className="flex justify-center h-screen items-center bg-green-200">
      Dashboard here
    </div>
    </DashboardLayout>
  );
};

export default Page;
