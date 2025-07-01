"use client";

import { useState } from "react";
import StaffManagement from "./staff-management"; // Replace with correct relative path
import AddStaffModal from "./add-staff-modal"; // Replace with correct relative path

const StaffManagementWithModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddStaff = () => {
    setIsModalOpen(true);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
  };

  const handleStaffSubmit = (values: any) => {
    console.log("New staff data:", values);
    // Add your API call here
  };

  return (
    <>
      <StaffManagement onAddStaff={handleAddStaff} />
      <AddStaffModal open={isModalOpen} onCancel={handleModalCancel} onSubmit={handleStaffSubmit} />
    </>
  );
};

export default StaffManagementWithModal;
