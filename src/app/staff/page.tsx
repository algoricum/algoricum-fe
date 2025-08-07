"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import { Button, Dropdown } from "antd";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Users, Search, Plus, X, MoreVertical, AlertTriangle } from "lucide-react";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { createStaffUser } from "@/utils/supabase/config/staff";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import type { JSX } from "react/jsx-runtime";
// Fixed import path
import { getClinicStaff, updateStaffMember, deleteStaffMember, type TransformedStaffMember } from "@/utils/supabase/clinic-staff-helper";

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

interface Message {
  type: "success" | "error";
  text: string;
}

interface CreateStaffResponse {
  data?: {
    emailSent?: boolean;
    tempPassword?: string;
  };
  error?: {
    message?: string;
  };
}

export default function StaffPage(): JSX.Element {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [staffData, setStaffData] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);
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

  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  // Helper function to convert database status to frontend status
  const mapDatabaseStatusToFrontend = (dbStatus: string): string => {
    if (dbStatus === "Active" || dbStatus === "TRUE") {
      return "active";
    }
    return "inactive";
  };

  // Helper function to convert frontend status to database boolean
  const mapFrontendStatusToDatabase = (frontendStatus: string): boolean => {
    return frontendStatus === "active";
  };
  
  // Add this useEffect after your existing state declarations and before the existing useEffects
  useEffect(() => {
    if (message) {
      // Set different timeouts based on message type
      const timeout = message.type === 'success' ? 5000 : 7000; // 5s for success, 7s for error
      
      const timer = setTimeout(() => {
        setMessage(null);
      }, timeout);

      // Cleanup function to clear timeout if component unmounts or message changes
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load staff data from Supabase
  useEffect(() => {
    const loadStaffData = async (): Promise<void> => {
      try {
        setIsLoading(true);
        // Get current user's clinic ID
        const currentClinicId: string | null = await getCurrentUserClinic();
        if (!currentClinicId) {
          setMessage({ type: "error", text: "No clinic found. Please make sure you have a clinic set up." });
          return;
        }
        setClinicId(currentClinicId);

        // Fetch staff data using your Supabase query
        const { data: staffMembers, error } = await getClinicStaff(currentClinicId);
        if (error) {
          console.error("Error loading staff data:", error);
          setMessage({ type: "error", text: "Failed to load staff data. Please try again." });
          return;
        }

        // Transform the data to match your Staff interface
        const transformedStaff: Staff[] =
          staffMembers?.map((member: TransformedStaffMember) => ({
            id: member.user_id,
            name: member.staff_member,
            email: member.email,
            role: member.role,
            createdBy: member.created_by,
            password: "••••••••", // Always masked
            avatar: getInitials(member.staff_member),
            joinedDate: member.joined_date,
            status: mapDatabaseStatusToFrontend(member.status), // Convert database status
          })) || [];

        setStaffData(transformedStaff);
      } catch (error: any) {
        console.error("Error loading staff data:", error);
        setMessage({ type: "error", text: "Failed to load staff data. Please try again." });
      } finally {
        setIsLoading(false);
      }
    };

    loadStaffData();
  }, []);

  // Helper function to get initials from name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  };

  // Filter staff data based on search term and selected role
  const filteredStaffData = useMemo(() => {
    return staffData.filter(staff => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.createdBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = selectedRole === "all" || staff.role.toLowerCase() === selectedRole.toLowerCase();

      // Add status filtering
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" && staff.status === "active") ||
        (selectedStatus === "inactive" && staff.status === "inactive");

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffData, searchTerm, selectedRole, selectedStatus]);

  // Get unique roles for dropdown
  const availableRoles = useMemo(() => {
    const roles = [...new Set(staffData.map(staff => staff.role))];
    return roles.map(role => ({
      value: role.toLowerCase(),
      label: role.charAt(0).toUpperCase() + role.slice(1),
    }));
  }, [staffData]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  // Handle role filter change
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedRole(e.target.value);
  };

  // Add handler for status filter change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedStatus(e.target.value);
  };

  // Clear search
  const clearSearch = (): void => {
    setSearchTerm("");
  };

  // Handle edit staff
  const handleEditStaff = (staff: Staff): void => {
    console.log("Edit staff clicked:", staff);
    setSelectedStaffForEdit(staff);
    setEditStaff({
      id: staff.id,
      name: staff.name,
      status: staff.status || "active",
    });
    setShowEditStaffModal(true);
  };

  // Fixed handleEditSubmit function
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!editStaff.name.trim()) {
      setMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    if (!clinicId) {
      setMessage({ type: "error", text: "No clinic found. Please try again." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null); // Clear previous messages

    try {
      console.log("Updating staff with data:", {
        userId: editStaff.id,
        clinicId,
        name: editStaff.name,
        is_active: mapFrontendStatusToDatabase(editStaff.status),
      });

      // Update staff member in Supabase
      const result = await updateStaffMember(editStaff.id, clinicId, {
        name: editStaff.name,
        is_active: mapFrontendStatusToDatabase(editStaff.status),
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      // Update local state only if Supabase update was successful
      setStaffData(prev =>
        prev.map(staff =>
          staff.id === editStaff.id
            ? {
                ...staff,
                name: editStaff.name,
                status: editStaff.status,
                avatar: getInitials(editStaff.name),
              }
            : staff,
        ),
      );

      setMessage({
        type: "success",
        text: `✅ Staff member "${editStaff.name}" has been updated successfully.`,
      });

      setShowEditStaffModal(false);
      setSelectedStaffForEdit(null);

      // Refresh the data from server to ensure consistency
      await refreshStaffData();
    } catch (error: any) {
      console.error("Error updating staff:", error);
      setMessage({ type: "error", text: "Failed to update staff member. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete staff
  const handleDeleteStaff = (staff: Staff): void => {
    console.log("Delete staff clicked:", staff);
    setSelectedStaffForDelete(staff);
    setShowDeleteConfirmModal(true);
  };

  // Fixed confirmDeleteStaff function
  const confirmDeleteStaff = async (): Promise<void> => {
    if (!selectedStaffForDelete || !clinicId) {
      setMessage({ type: "error", text: "Missing required information. Please try again." });
      return;
    }

    setIsDeleting(true);
    setMessage(null); // Clear previous messages

    try {
      console.log("Deleting staff with data:", {
        userId: selectedStaffForDelete.id,
        clinicId,
      });

      // Delete staff member from Supabase
      const result = await deleteStaffMember(selectedStaffForDelete.id, clinicId);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      // Remove staff from local state only if Supabase deletion was successful
      setStaffData(prev => prev.filter(staff => staff.id !== selectedStaffForDelete.id));

      setMessage({
        type: "success",
        text: `✅ Staff member "${selectedStaffForDelete.name}" has been removed successfully.`,
      });

      setShowDeleteConfirmModal(false);
      setSelectedStaffForDelete(null);

      // Refresh the data from server to ensure consistency
      await refreshStaffData();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      setMessage({ type: "error", text: "Failed to remove staff member. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Refresh staff data after adding new staff
  const refreshStaffData = async (): Promise<void> => {
    if (!clinicId) return;

    try {
      const { data: staffMembers, error } = await getClinicStaff(clinicId);
      if (error) {
        console.error("Error refreshing staff data:", error);
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
          status: mapDatabaseStatusToFrontend(member.status), // Convert database status
        })) || [];

      setStaffData(transformedStaff);
    } catch (error: any) {
      console.error("Error refreshing staff data:", error);
    }
  };

  const handleAddStaff = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newStaff.email.trim()) {
      setMessage({ type: "error", text: "Please enter staff email" });
      return;
    }
    if (!newStaff.name.trim()) {
      setMessage({ type: "error", text: "Please enter staff name" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const clinic_id: string | null = await getCurrentUserClinic();
      if (!clinic_id) {
        setMessage({ type: "error", text: "No clinic found. Please make sure you have a clinic set up." });
        return;
      }

      // Create staff user via API route
      const response: CreateStaffResponse = await createStaffUser({
        email: newStaff.email,
        name: newStaff.name,
        clinicId: clinic_id,
        roleId: "074a8cb5-03ea-422c-8786-da5ef8fd5d00", // Make this dynamic later`
      });
        
      if (response.error) {
  
        setMessage({ type: "error", text: response.error.message || "Failed to create staff member" });
        console.error("Staff creation error:", response.error);
        return;
      }

      if (response.data) {
        setMessage({
          type: "success",
          text: `✅ Staff member created successfully! ${
            response.data.emailSent
              ? "Login credentials have been sent to " + newStaff.email
              : "Please share the credentials manually: " + response.data.tempPassword
          }`,
        });

        // Reset form
        setNewStaff({ email: "", name: "" });
        setShowAddStaffModal(false);

        // Refresh staff data after successful creation
        await refreshStaffData();
        console.log("Staff created:", response.data);
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setMessage({ type: "error", text: "An unexpected error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Handle input changes
  const handleInputChange = (field: keyof NewStaff, value: string): void => {
    setNewStaff(prev => ({ ...prev, [field]: value }));
  };

  // Handle edit input changes
  const handleEditInputChange = (field: keyof EditStaff, value: string): void => {
    setEditStaff(prev => ({ ...prev, [field]: value }));
  };

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <DashboardLayout header={<Header title="Staff Management" description="Manage your healthcare team and staff information." />}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner message="Loading staff data..." size="md" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={<Header title="Staff Management" description="Manage your healthcare team and staff information." />}>
      <div>
        {/* Success/Error Messages */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Total Staff Stats */}
        <div className="mb-8">
          <div className="card w-fit">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-semibold text-gray-900">{filteredStaffData.length}</p>
                {searchTerm || selectedRole !== "all" ? <p className="text-xs text-gray-500">of {staffData.length} total</p> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {/* Enhanced Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Enhanced Role Filter */}
              <select
                value={selectedRole}
                onChange={handleRoleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[120px]"
              >
                <option value="all">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {/* Filter Status Indicator */}
              {(searchTerm || selectedRole !== "all" || selectedStatus !== "all") && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {filteredStaffData.length} of {staffData.length} staff
                  </span>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedRole("all");
                      setSelectedStatus("all");
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Beautiful Ant Design Button */}
            <Button
              type="primary"
              size="large"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddStaffModal(true)}
              style={{
                backgroundColor: "#9564e9",
                borderColor: "#9564e9",
                boxShadow: "0 4px 12px rgba(149, 100, 233, 0.3)",
                borderRadius: "8px",
                height: "44px",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              className="hover:!bg-[#8554d6] hover:!border-[#8554d6] hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              Add Staff Member
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Staff Member</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created By</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-gray-500">
                      {searchTerm || selectedRole !== "all" || selectedStatus !== "all"
                        ? `No staff members found matching your search criteria.`
                        : "No staff members found. Add your first staff member to get started."}
                      {(searchTerm || selectedRole !== "all" || selectedStatus !== "all") && (
                        <div className="mt-2">
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setSelectedRole("all");
                              setSelectedStatus("all");
                            }}
                            className="text-purple-600 hover:text-purple-800 underline text-sm"
                          >
                            Clear filters to see all staff
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredStaffData.map((staff: Staff) => (
                    <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                            {staff.avatar}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{staff.name}</p>
                            <p className="text-sm text-gray-500">{staff.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{staff.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`badge ${
                            staff.role === "doctor" ? "badge-info" : staff.role === "nurse" ? "badge-success" : "badge-warning"
                          }`}
                        >
                          {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{formatDate(staff.joinedDate)}</td>
                      <td className="py-3 px-4 text-gray-900">{staff.createdBy}</td>
                      <td className="py-3 px-4">
                        <span className={`badge ${staff.status === "active" ? "badge-success" : "badge-warning"}`}>
                          {staff.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: "edit",
                                label: "Edit",
                                icon: null,
                              },
                              {
                                key: "delete",
                                label: "Delete",
                                icon: null,
                                danger: true,
                              },
                            ],
                            onClick: ({ key }) => {
                              if (key === "edit") {
                                handleEditStaff(staff);
                              } else if (key === "delete") {
                                handleDeleteStaff(staff);
                              }
                            },
                          }}
                          trigger={["click"]}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            icon={<MoreVertical className="w-4 h-4" />}
                            className="hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
                          />
                        </Dropdown>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Staff Modal */}
        {showAddStaffModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add New Staff Member</h3>
                <button onClick={() => setShowAddStaffModal(false)} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              {/* Add message display inside the modal */}
              {message && (
                <div
                  className={`mb-4 p-3 rounded-lg ${
                    message.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-75">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Creating staff member..." size="sm" />
                </div>
              )}

              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newStaff.name}
                    onChange={e => handleInputChange("name", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter full name"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={e => handleInputChange("email", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter email address"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">A secure temporary password will be auto-generated and sent to this email.</p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    className="flex-1 btn btn-secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "#9564e9",
                      borderColor: "#9564e9",
                      borderRadius: "6px",
                      height: "40px",
                      fontWeight: "600",
                      flex: 1,
                    }}
                    className="hover:!bg-[#8554d6] hover:!border-[#8554d6] transition-all duration-200"
                  >
                    {isSubmitting ? "Creating..." : "Create Staff"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Staff Modal */}
        {showEditStaffModal && selectedStaffForEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Staff Member</h3>
                <button
                  onClick={() => {
                    setShowEditStaffModal(false);
                    setSelectedStaffForEdit(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Updating staff member..." size="sm" />
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStaff.name}
                    onChange={e => handleEditInputChange("name", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter full name"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editStaff.status}
                    onChange={e => handleEditInputChange("status", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditStaffModal(false);
                      setSelectedStaffForEdit(null);
                    }}
                    className="flex-1 btn btn-secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "#9564e9",
                      borderColor: "#9564e9",
                      borderRadius: "6px",
                      height: "40px",
                      fontWeight: "600",
                      flex: 1,
                    }}
                    className="hover:!bg-[#8554d6] hover:!border-[#8554d6] transition-all duration-200"
                  >
                    {isSubmitting ? "Updating..." : "Update Staff"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && selectedStaffForDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-red-100 mr-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Staff Member</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>

              {isDeleting && (
                <div className="mb-4">
                  <LoadingSpinner message="Deleting staff member..." size="sm" />
                </div>
              )}

              <div className="mb-6">
                <p className="text-gray-700">
                  Are you sure you want to delete <span className="font-semibold">{selectedStaffForDelete.name}</span>? This will
                  permanently remove their access and all associated data.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setSelectedStaffForDelete(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  disabled={isDeleting}
                >
                  No, Cancel
                </button>
                <Button
                  onClick={confirmDeleteStaff}
                  loading={isDeleting}
                  disabled={isDeleting}
                  style={{
                    backgroundColor: "#dc2626",
                    borderColor: "#dc2626",
                    borderRadius: "6px",
                    height: "40px",
                    fontWeight: "600",
                    flex: 1,
                  }}
                  className="hover:!bg-[#b91c1c] hover:!border-[#b91c1c] transition-all duration-200"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
