"use client";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast } from "@/helpers/toast";
import DashboardLayout from "@/layouts/DashboardLayout";
import React, { useMemo, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { type TransformedStaffMember } from "../../utils/supabase/clinic-staff-helper";
// Component imports

import { StaffFilters } from "@/components/staff/staff-filters";
import { StatCard } from "@/components/staff/staff-stats";
import { StaffTable } from "@/components/staff/staff-table";

// Component imports
import { AddStaffModal } from "@/components/staff/add-staff-modal";
import { DeleteConfirmModal } from "@/components/staff/delete-confirm-modal";
import { EditStaffModal } from "@/components/staff/edit-staff-modal";
import { getInitials, mapDatabaseStatusToFrontend, mapFrontendStatusToDatabase } from "@/components/staff/staffUtilFunctions";
import { staffStatsConfig } from "@/components/staff/statCardUtils";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUserClinic, useStaffList, useStaffStats, useCreateStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useStaff";
import { Pagination } from "antd";

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

export default function StaffContent(): JSX.Element {
  // Modal and form state management
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
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
  // Initialize pagination with default page size of 10
  const { currentPage, pageSize, paginationConfig, setTotal } = usePagination(10);

  // React Query hooks
  const { data: clinic, isLoading: clinicLoading, error: clinicError } = useCurrentUserClinic();
  const clinicId = clinic?.id || "";
  const { data: staffResponse, isLoading: staffLoading, error: staffError } = useStaffList(clinicId, currentPage, pageSize);
  const { data: statusStats = [], isLoading: statsLoading } = useStaffStats(clinicId);

  // Extract staff data and pagination info
  const staffData = staffResponse?.data || [];
  const totalStaff = staffResponse?.total || 0;

  // React Query mutations
  const createStaffMutation = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

  // Combined loading states
  const isLoading = clinicLoading || staffLoading;
  const isSubmitting = createStaffMutation.isPending || updateStaffMutation.isPending;
  const isDeleting = deleteStaffMutation.isPending;

  // Handle React Query errors
  React.useEffect(() => {
    if (clinicError) {
      ErrorToast("Failed to load clinic data. Please try again.");
    }
    if (staffError) {
      ErrorToast("Failed to load staff data. Please try again.");
    }
  }, [clinicError, staffError]);

  // Transform staff data from API response to component format
  const transformedStaffData: Staff[] = useMemo(() => {
    return (
      staffData?.map((member: TransformedStaffMember) => ({
        id: member.user_id,
        name: member.staff_member,
        email: member.email,
        role: member.role,
        createdBy: member.created_by,
        password: "••••••••",
        avatar: getInitials(member.staff_member),
        joinedDate: member.joined_date,
        status: mapDatabaseStatusToFrontend(member.status),
      })) || []
    );
  }, [staffData]);

  // Update pagination total when staff data changes
  React.useEffect(() => {
    setTotal(totalStaff);
  }, [totalStaff, setTotal]);

  // Computed values
  const filteredStaffData = useMemo(() => {
    return transformedStaffData.filter(staff => {
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
  }, [transformedStaffData, searchTerm, selectedRole, selectedStatus]);

  const availableRoles = useMemo(() => {
    const roles = [...new Set(transformedStaffData.map(s => s.role))];
    return roles.map(role => ({
      value: role.toLowerCase(),
      label: role.charAt(0).toUpperCase() + role.slice(1),
    }));
  }, [transformedStaffData]);

  // Event handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
  const handleRoleChange = (value: string) => setSelectedRole(value);
  const handleStatusChange = (value: string) => setSelectedStatus(value);
  const clearSearch = () => setSearchTerm("");

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRole("all");
    setSelectedStatus("all");
  };

  const handleInputChange = (field: keyof NewStaff, value: string) => setNewStaff(p => ({ ...p, [field]: value }));
  const handleEditInputChange = (field: keyof EditStaff, value: string) => setEditStaff(p => ({ ...p, [field]: value }));

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
    if (!clinicId) {
      ErrorToast("No clinic found. Please make sure you have a clinic set up.");
      return;
    }

    try {
      await createStaffMutation.mutateAsync({
        email: newStaff.email,
        name: newStaff.name,
        clinicId,
      });

      // Reset form and close modal on success
      setNewStaff({ email: "", name: "" });
      setShowAddStaffModal(false);
    } catch (error) {
      // Error handling is done by the mutation
      console.error("Create staff error:", error);
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

    try {
      await updateStaffMutation.mutateAsync({
        userId: editStaff.id,
        clinicId,
        updateData: {
          name: editStaff.name,
          is_active: mapFrontendStatusToDatabase(editStaff.status),
        },
      });

      // Reset form and close modal on success
      setShowEditStaffModal(false);
      setSelectedStaffForEdit(null);
    } catch (error) {
      // Error handling is done by the mutation
      console.error("Update staff error:", error);
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

    try {
      await deleteStaffMutation.mutateAsync({
        userId: selectedStaffForDelete.id,
        clinicId,
      });

      // Reset modal state on success
      setShowDeleteConfirmModal(false);
      setSelectedStaffForDelete(null);
    } catch (error) {
      // Error handling is done by the mutation
      console.error("Delete staff error:", error);
    }
  };

  if (isLoading || statsLoading) {
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
        <div className="px-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {staffStatsConfig.map(stat => (
            <StatCard key={stat.key} icon={stat.icon} iconBg={stat.iconBg} title={stat.title} value={stat.getValue(statusStats)} />
          ))}
        </div>

        {/* Table + Filters */}
        <div className="rounded-lg bg-white p-4 shadow sm:p-6">
          <StaffFilters
            searchTerm={searchTerm}
            selectedRole={selectedRole}
            selectedStatus={selectedStatus}
            availableRoles={availableRoles}
            totalStaff={transformedStaffData.length}
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

        <div className="flex justify-center py-4">
          <div className="bg-white rounded-lg px-6 py-4 shadow-sm border border-gray-200">
            <Pagination {...paginationConfig} />
          </div>
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
