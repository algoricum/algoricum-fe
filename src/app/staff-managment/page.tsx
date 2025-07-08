"use client";
import { Header } from "@/components/common";
import StaffManagementWithModal from "@/components/staff-managment/staff-management-with-modal";
import StaffManagmentLayout from "@/layouts/StaffManagmentLayout";

const Page = () => {
  return (
    <StaffManagmentLayout header={<Header title="Staff Management" description="Manage your clinic staff from here." />}>
      <StaffManagementWithModal />
    </StaffManagmentLayout>
  );
};

export default Page;
