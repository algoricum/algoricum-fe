"use client";

import { useState } from "react";
import StaffManagement from "./staff-management";
import AddStaffModal from "./add-staff-modal";

interface StaffFormValues {
  name: string;
  email: string;
  role: string;
  password: string;
}

const StaffManagementWithModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddStaff = () => {
    setIsModalOpen(true);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
  };

  const handleStaffSubmit = (values: StaffFormValues) => {
    console.log("New staff data:", values); // ✅ You are using `values` here
    // Add your API call here
    setIsModalOpen(false); // Optionally close modal after submit
  };

  return (
    <>
      <StaffManagement onAddStaff={handleAddStaff} />
      <AddStaffModal open={isModalOpen} onCancel={handleModalCancel} onSubmit={handleStaffSubmit} />
    </>
  );
};

export default StaffManagementWithModal;
