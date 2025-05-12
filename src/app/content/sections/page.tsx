"use client";
import { Header } from "@/components/common";
import SectionPage from "@/components/screens/Section/SectionPage";
import DashboardLayout from "@/layouts/DashboardLayout";

const Section = () => {
  return (
    <DashboardLayout
      header={
        <Header
          title={"Manage Your Sections"}
          description={"Customize the design and settings of your Sections to match your brand’s look and feel."}
        />
      }
    >
      <SectionPage />
    </DashboardLayout>
  );
};

export default Section;
