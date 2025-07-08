"use client";

import { Header } from "@/components/common";
import DashboardLayout from "@/layouts/DashboardLayout";
import StatsCards from "@/components/dashboard/stats-cards";
import AnalyticsOverview from "@/components/dashboard/analytics-overview";
import SourceTable from "@/components/dashboard/source-table";

const Page = () => {
  return (
    <DashboardLayout header={<Header title="Dashboard" description="Here dashboard details will be shown" />}>
      <div className="font-semibold text-lg mx-4">
        <h4>Welcome back, [Clinic Name]! 👋</h4>
      </div>
      <StatsCards />
      <AnalyticsOverview />
      <SourceTable />
    </DashboardLayout>
  );
};

export default Page;
