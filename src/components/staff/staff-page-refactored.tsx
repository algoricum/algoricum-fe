"use client";

import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import DashboardLayout from "@/layouts/DashboardLayout";
import { getRoleId } from "@/redux/slices/clinic.slice";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import {
  deleteStaffMember,
  getClinicStaff,
  updateStaffMember,
  type TransformedStaffMember,
} from "../../utils/supabase/clinic-staff-helper";
import { createStaffUser } from "../../utils/supabase/config/staff";
import { getCurrentUserClinic } from "../../utils/supabase/leads-helper";
// Component imports

import { AddStaffModal } from "@/components/staff/add-staff-modal";
import { DeleteConfirmModal } from "@/components/staff/delete-confirm-modal";
import { EditStaffModal } from "@/components/staff/edit-staff-modal";
import { StaffFilters } from "@/components/staff/staff-filters";
import { StaffStats } from "@/components/staff/staff-stats";
import { StaffTable } from "@/components/staff/staff-table";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  createdBy: string;
  password: string;
  avatar: string;
  joinedDate: string;
  status?: string;
}

interface NewStaff {
  email: string;
  name: string;
}

interface EditStaff {
  id: string;
  name: string;
  status: string;
}

interface CreateStaffResponse {
  data?: { emailSent?: boolean; tempPassword?: string };
  error?: { message?: string };
}

export default function StaffPageRefactored(): JSX.Element {
  // State management
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [staffData, setStaffData] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<Staff | null>(null);
  const [selectedStaffForDelete, setSelectedStaffForDelete] = useState<Staff | null>(null);
  const [newStaff, setNewStaff] = useState<NewStaff>({
    email: "",
    name: "",
  });
  const [editStaff, setEditStaff] = useState<EditStaff>({
    id: "",
    name: "",
    status: "active",
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  // Utility functions
  const mapDatabaseStatusToFrontend = (dbStatus: string): string => {
    if (dbStatus === "Active" || dbStatus === "TRUE") return "active";
    return "inactive";
  };

  const mapFrontendStatusToDatabase = (frontendStatus: string): boolean => {
    return frontendStatus === "active";
  };

  const getInitials = (name: string): string =>
    name
      .split(" ")
      .map(w => w.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);

  // Effects
  useEffect(() => {
    const loadStaffData = async (): Promise<void> => {
      try {
        setIsLoading(true);
        const currentClinicId: string | null = await getCurrentUserClinic();
        if (!currentClinicId) {
          ErrorToast("No clinic found. Please make sure you have a clinic set up.");
          return;
        }
        setClinicId(currentClinicId);

        const { data: staffMembers, error } = await getClinicStaff(currentClinicId);
        if (error) {
          console.error("Error loading staff data:", error);
          ErrorToast("Failed to load staff data. Please try again.");
          return;
        }

        const transformedStaff: Staff[] =
          staffMembers?.map((member: TransformedStaffMember) => ({
            id: member.user_id,
            name: member.staff_member,
            email: member.email,
            role: member.role,
            createdBy: member.created_by,
            password: "••••••••",
            avatar: getInitials(member.staff_member),
            joinedDate: member.joined_date,
            status: mapDatabaseStatusToFrontend(member.status),
          })) || [];

        setStaffData(transformedStaff);
      } catch (error: any) {
        console.error("Error loading staff data:", error);
        ErrorToast("Failed to load staff data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    loadStaffData();
  }, []);

  // Computed values
  const filteredStaffData = useMemo(() => {
    return staffData.filter(staff => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        staff.name.toLowerCase().includes(q) ||
        staff.email.toLowerCase().includes(q) ||
        staff.role.toLowerCase().includes(q) ||
        staff.createdBy.toLowerCase().includes(q);

      const matchesRole = selectedRole === "all" || staff.role.toLowerCase() === selectedRole.toLowerCase();
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" && staff.status === "active") ||
        (selectedStatus === "inactive" && staff.status === "inactive");

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffData, searchTerm, selectedRole, selectedStatus]);

  const availableRoles = useMemo(() => {
    const roles = [...new Set(staffData.map(s => s.role))];
    return roles.map(role => ({
      value: role.toLowerCase(),
      label: role.charAt(0).toUpperCase() + role.slice(1),
    }));
  }, [staffData]);

  // Event handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRole(e.target.value);
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStatus(e.target.value);
  const clearSearch = () => setSearchTerm("");

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRole("all");
    setSelectedStatus("all");
  };

  const handleInputChange = (field: keyof NewStaff, value: string) => setNewStaff(p => ({ ...p, [field]: value }));
  const handleEditInputChange = (field: keyof EditStaff, value: string) => setEditStaff(p => ({ ...p, [field]: value }));

  const refreshStaffData = async () => {
    if (!clinicId) return;
    try {
      const { data: staffMembers, error } = await getClinicStaff(clinicId);
      if (error) return;
      const transformed: Staff[] =
        staffMembers?.map((m: TransformedStaffMember) => ({
          id: m.user_id,
          name: m.staff_member,
          email: m.email,
          role: m.role,
          createdBy: m.created_by,
          password: "••••••••",
          avatar: getInitials(m.staff_member),
          joinedDate: m.joined_date,
          status: mapDatabaseStatusToFrontend(m.status),
        })) || [];
      setStaffData(transformed);
    } catch (e) {
      console.error("Error refreshing staff data:", e);
    }
  };

  const handleAddStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newStaff.email.trim()) {
      ErrorToast("Please enter staff email");
      return;
    }
    if (!newStaff.name.trim()) {
      ErrorToast("Please enter staff name");
      return;
    }
    setIsSubmitting(true);
    try {
      const clinic_id: string | null = await getCurrentUserClinic();
      if (!clinic_id) {
        ErrorToast("No clinic found. Please make sure you have a clinic set up.");
        return;
      }

      const roleId = await getRoleId("receptionist"); // Fetch role ID from Redux store or other source

      if (!roleId) {
        ErrorToast("No role found. Please make sure roles are set up correctly.");
        return;
      }

      const response: CreateStaffResponse = await createStaffUser({
        email: newStaff.email,
        name: newStaff.name,
        clinicId: clinic_id,
        roleId,
      });
      if (response.error) {
        ErrorToast(response.error.message || "Failed to create staff member");
        return;
      }
      if (response.data) {
        const successMessage = `Staff member created successfully! ${
          response.data.emailSent
            ? `Login credentials have been sent to ${newStaff.email}`
            : `Please share the credentials manually: ${response.data.tempPassword}`
        }`;
        SuccessToast(successMessage);
        setNewStaff({ email: "", name: "" });
        setShowAddStaffModal(false);
        await refreshStaffData();
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      ErrorToast("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = (staff: Staff) => {
    setShowEditStaffModal(true);
    setSelectedStaffForEdit(staff);
    setEditStaff({ id: staff.id, name: staff.name, status: staff.status || "active" });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editStaff.name.trim()) {
      ErrorToast("Please fill in all required fields.");
      return;
    }
    if (!clinicId) {
      ErrorToast("No clinic found. Please try again.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await updateStaffMember(editStaff.id, clinicId, {
        name: editStaff.name,
        is_active: mapFrontendStatusToDatabase(editStaff.status),
      });
      if (result.error) {
        ErrorToast(result.error);
        return;
      }
      setStaffData(prev =>
        prev.map(s =>
          s.id === editStaff.id ? { ...s, name: editStaff.name, status: editStaff.status, avatar: getInitials(editStaff.name) } : s,
        ),
      );
      SuccessToast(`Staff member "${editStaff.name}" has been updated successfully.`);
      setShowEditStaffModal(false);
      setSelectedStaffForEdit(null);
      await refreshStaffData();
    } catch (error: any) {
      console.error("Error updating staff:", error);
      ErrorToast("Failed to update staff member. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = (staff: Staff) => {
    setSelectedStaffForDelete(staff);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteStaff = async () => {
    if (!selectedStaffForDelete || !clinicId) {
      ErrorToast("Missing required information. Please try again.");
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteStaffMember(selectedStaffForDelete.id, clinicId);
      if (result.error) {
        ErrorToast(result.error);
        return;
      }
      setStaffData(prev => prev.filter(s => s.id !== selectedStaffForDelete.id));
      SuccessToast(`Staff member "${selectedStaffForDelete.name}" has been removed successfully.`);
      setShowDeleteConfirmModal(false);
      setSelectedStaffForDelete(null);
      await refreshStaffData();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      ErrorToast("Failed to remove staff member. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout
        header={<Header title="Staff Management" description="Manage your healthcare team and staff information." showHamburgerMenu />}
      >
        <div className="flex min-h-[400px] items-center justify-center">
          <LoadingSpinner message="Loading staff data..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      header={<Header title="Staff Management" description="Manage your healthcare team and staff information." showHamburgerMenu />}
    >
      <div>
        {/* Stats */}
        <StaffStats
          totalStaff={staffData.length}
          filteredStaff={filteredStaffData.length}
          hasFilters={searchTerm !== "" || selectedRole !== "all" || selectedStatus !== "all"}
        />

        {/* Table + Filters */}
        <div className="rounded-lg bg-white p-4 shadow sm:p-6">
          <StaffFilters
            searchTerm={searchTerm}
            selectedRole={selectedRole}
            selectedStatus={selectedStatus}
            availableRoles={availableRoles}
            totalStaff={staffData.length}
            filteredStaff={filteredStaffData.length}
            onSearchChange={handleSearchChange}
            onRoleChange={handleRoleChange}
            onStatusChange={handleStatusChange}
            onClearSearch={clearSearch}
            onClearFilters={clearFilters}
            onAddStaff={() => setShowAddStaffModal(true)}
          />

          <StaffTable
            staffData={filteredStaffData}
            searchTerm={searchTerm}
            selectedRole={selectedRole}
            selectedStatus={selectedStatus}
            onEdit={handleEditStaff}
            onDelete={handleDeleteStaff}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Modals */}
        <AddStaffModal
          isOpen={showAddStaffModal}
          isSubmitting={isSubmitting}
          newStaff={newStaff}
          onClose={() => setShowAddStaffModal(false)}
          onSubmit={handleAddStaff}
          onInputChange={handleInputChange}
        />

        <EditStaffModal
          isOpen={showEditStaffModal}
          isSubmitting={isSubmitting}
          selectedStaff={selectedStaffForEdit}
          editStaff={editStaff}
          onClose={() => {
            setShowEditStaffModal(false);
            setSelectedStaffForEdit(null);
          }}
          onSubmit={handleEditSubmit}
          onInputChange={handleEditInputChange}
        />

        <DeleteConfirmModal
          isOpen={showDeleteConfirmModal}
          isDeleting={isDeleting}
          selectedStaff={selectedStaffForDelete}
          onClose={() => {
            setShowDeleteConfirmModal(false);
            setSelectedStaffForDelete(null);
          }}
          onConfirm={confirmDeleteStaff}
        />
      </div>
    </DashboardLayout>
  );
}
