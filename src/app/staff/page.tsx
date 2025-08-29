// "use client";

// import type React from "react";
// import { useState, useEffect, useMemo } from "react";
// import { Button, Dropdown } from "antd";
// import DashboardLayout from "@/layouts/DashboardLayout";
// import { Users, Search, Plus, X, MoreVertical, AlertTriangle } from "lucide-react";
// import { Header } from "@/components/common";
// import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
// import { createStaffUser } from "@/utils/supabase/config/staff";
// import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
// import type { JSX } from "react/jsx-runtime";
// import { getClinicStaff, updateStaffMember, deleteStaffMember, type TransformedStaffMember } from "@/utils/supabase/clinic-staff-helper";

// interface Staff {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   createdBy: string;
//   password: string;
//   avatar: string;
//   joinedDate: string;
//   status?: string;
// }
// interface NewStaff {
//   email: string;
//   name: string;
// }
// interface EditStaff {
//   id: string;
//   name: string;
//   status: string;
// }
// interface Message {
//   type: "success" | "error";
//   text: string;
// }
// interface CreateStaffResponse {
//   data?: { emailSent?: boolean; tempPassword?: string };
//   error?: { message?: string };
// }

// export default function StaffPage(): JSX.Element {
//   const [selectedStatus, setSelectedStatus] = useState<string>("all");
//   const [staffData, setStaffData] = useState<Staff[]>([]);
//   const [isLoading, setIsLoading] = useState<boolean>(true);
//   const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
//   const [showEditStaffModal, setShowEditStaffModal] = useState<boolean>(false);
//   const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
//   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
//   const [isDeleting, setIsDeleting] = useState<boolean>(false);
//   const [message, setMessage] = useState<Message | null>(null);
//   const [clinicId, setClinicId] = useState<string | null>(null);
//   const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<Staff | null>(null);
//   const [selectedStaffForDelete, setSelectedStaffForDelete] = useState<Staff | null>(null);
//   const [newStaff, setNewStaff] = useState<NewStaff>({
//     email: "",
//     name: "",
//   });
//   const [editStaff, setEditStaff] = useState<EditStaff>({
//     id: "",
//     name: "",
//     status: "active",
//   });

//   // Filters
//   const [searchTerm, setSearchTerm] = useState<string>("");
//   const [selectedRole, setSelectedRole] = useState<string>("all");

//   const mapDatabaseStatusToFrontend = (dbStatus: string): string => {
//     if (dbStatus === "Active" || dbStatus === "TRUE") return "active";
//     return "inactive";
//   };
//   const mapFrontendStatusToDatabase = (frontendStatus: string): boolean => {
//     return frontendStatus === "active";
//   };

//   useEffect(() => {
//     if (message) {
//       const timeout = message.type === "success" ? 5000 : 7000;
//       const timer = setTimeout(() => setMessage(null), timeout);
//       return () => clearTimeout(timer);
//     }
//   }, [message]);

//   // Load staff data
//   useEffect(() => {
//     const loadStaffData = async (): Promise<void> => {
//       try {
//         setIsLoading(true);
//         const currentClinicId: string | null = await getCurrentUserClinic();
//         if (!currentClinicId) {
//           setMessage({ type: "error", text: "No clinic found. Please make sure you have a clinic set up." });
//           return;
//         }
//         setClinicId(currentClinicId);

//         const { data: staffMembers, error } = await getClinicStaff(currentClinicId);
//         if (error) {
//           console.error("Error loading staff data:", error);
//           setMessage({ type: "error", text: "Failed to load staff data. Please try again." });
//           return;
//         }

//         const transformedStaff: Staff[] =
//           staffMembers?.map((member: TransformedStaffMember) => ({
//             id: member.user_id,
//             name: member.staff_member,
//             email: member.email,
//             role: member.role,
//             createdBy: member.created_by,
//             password: "••••••••",
//             avatar: getInitials(member.staff_member),
//             joinedDate: member.joined_date,
//             status: mapDatabaseStatusToFrontend(member.status),
//           })) || [];

//         setStaffData(transformedStaff);
//       } catch (error: any) {
//         console.error("Error loading staff data:", error);
//         setMessage({ type: "error", text: "Failed to load staff data. Please try again." });
//       } finally {
//         setIsLoading(false);
//       }
//     };
//     loadStaffData();
//   }, []);

//   const getInitials = (name: string): string =>
//     name
//       .split(" ")
//       .map(w => w.charAt(0).toUpperCase())
//       .join("")
//       .substring(0, 2);

//   // Filtered data
//   const filteredStaffData = useMemo(() => {
//     return staffData.filter(staff => {
//       const q = searchTerm.toLowerCase();
//       const matchesSearch =
//         staff.name.toLowerCase().includes(q) ||
//         staff.email.toLowerCase().includes(q) ||
//         staff.role.toLowerCase().includes(q) ||
//         staff.createdBy.toLowerCase().includes(q);

//       const matchesRole = selectedRole === "all" || staff.role.toLowerCase() === selectedRole.toLowerCase();
//       const matchesStatus =
//         selectedStatus === "all" ||
//         (selectedStatus === "active" && staff.status === "active") ||
//         (selectedStatus === "inactive" && staff.status === "inactive");

//       return matchesSearch && matchesRole && matchesStatus;
//     });
//   }, [staffData, searchTerm, selectedRole, selectedStatus]);

//   const availableRoles = useMemo(() => {
//     const roles = [...new Set(staffData.map(s => s.role))];
//     return roles.map(role => ({
//       value: role.toLowerCase(),
//       label: role.charAt(0).toUpperCase() + role.slice(1),
//     }));
//   }, [staffData]);

//   // Handlers
//   const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
//   const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRole(e.target.value);
//   const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStatus(e.target.value);
//   const clearSearch = () => setSearchTerm("");

//   const handleEditStaff = (staff: Staff) => {
//     setSelectedStaffForEdit(staff);
//     setEditStaff({ id: staff.id, name: staff.name, status: staff.status || "active" });
//     setShowEditStaffModal(true);
//   };

//   const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (!editStaff.name.trim()) {
//       setMessage({ type: "error", text: "Please fill in all required fields." });
//       return;
//     }
//     if (!clinicId) {
//       setMessage({ type: "error", text: "No clinic found. Please try again." });
//       return;
//     }
//     setIsSubmitting(true);
//     setMessage(null);
//     try {
//       const result = await updateStaffMember(editStaff.id, clinicId, {
//         name: editStaff.name,
//         is_active: mapFrontendStatusToDatabase(editStaff.status),
//       });
//       if (result.error) {
//         setMessage({ type: "error", text: result.error });
//         return;
//       }
//       setStaffData(prev =>
//         prev.map(s =>
//           s.id === editStaff.id ? { ...s, name: editStaff.name, status: editStaff.status, avatar: getInitials(editStaff.name) } : s,
//         ),
//       );
//       setMessage({ type: "success", text: `✅ Staff member "${editStaff.name}" has been updated successfully.` });
//       setShowEditStaffModal(false);
//       setSelectedStaffForEdit(null);
//       await refreshStaffData();
//     } catch (error: any) {
//       console.error("Error updating staff:", error);
//       setMessage({ type: "error", text: "Failed to update staff member. Please try again." });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDeleteStaff = (staff: Staff) => {
//     setSelectedStaffForDelete(staff);
//     setShowDeleteConfirmModal(true);
//   };

//   const confirmDeleteStaff = async () => {
//     if (!selectedStaffForDelete || !clinicId) {
//       setMessage({ type: "error", text: "Missing required information. Please try again." });
//       return;
//     }
//     setIsDeleting(true);
//     setMessage(null);
//     try {
//       const result = await deleteStaffMember(selectedStaffForDelete.id, clinicId);
//       if (result.error) {
//         setMessage({ type: "error", text: result.error });
//         return;
//       }
//       setStaffData(prev => prev.filter(s => s.id !== selectedStaffForDelete.id));
//       setMessage({ type: "success", text: `✅ Staff member "${selectedStaffForDelete.name}" has been removed successfully.` });
//       setShowDeleteConfirmModal(false);
//       setSelectedStaffForDelete(null);
//       await refreshStaffData();
//     } catch (error: any) {
//       console.error("Error deleting staff:", error);
//       setMessage({ type: "error", text: "Failed to remove staff member. Please try again." });
//     } finally {
//       setIsDeleting(false);
//     }
//   };

//   const refreshStaffData = async () => {
//     if (!clinicId) return;
//     try {
//       const { data: staffMembers, error } = await getClinicStaff(clinicId);
//       if (error) return;
//       const transformed: Staff[] =
//         staffMembers?.map((m: TransformedStaffMember) => ({
//           id: m.user_id,
//           name: m.staff_member,
//           email: m.email,
//           role: m.role,
//           createdBy: m.created_by,
//           password: "••••••••",
//           avatar: getInitials(m.staff_member),
//           joinedDate: m.joined_date,
//           status: mapDatabaseStatusToFrontend(m.status),
//         })) || [];
//       setStaffData(transformed);
//     } catch (e) {
//       console.error("Error refreshing staff data:", e);
//     }
//   };

//   const handleAddStaff = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (!newStaff.email.trim()) {
//       setMessage({ type: "error", text: "Please enter staff email" });
//       return;
//     }
//     if (!newStaff.name.trim()) {
//       setMessage({ type: "error", text: "Please enter staff name" });
//       return;
//     }
//     setIsSubmitting(true);
//     setMessage(null);
//     try {
//       const clinic_id: string | null = await getCurrentUserClinic();
//       if (!clinic_id) {
//         setMessage({ type: "error", text: "No clinic found. Please make sure you have a clinic set up." });
//         return;
//       }
//       const response: CreateStaffResponse = await createStaffUser({
//         email: newStaff.email,
//         name: newStaff.name,
//         clinicId: clinic_id,
//         roleId: "074a8cb5-03ea-422c-8786-da5ef8fd5d00",
//       });
//       if (response.error) {
//         setMessage({ type: "error", text: response.error.message || "Failed to create staff member" });
//         return;
//       }
//       if (response.data) {
//         setMessage({
//           type: "success",
//           text: `✅ Staff member created successfully! ${
//             response.data.emailSent
//               ? "Login credentials have been sent to " + newStaff.email
//               : "Please share the credentials manually: " + response.data.tempPassword
//           }`,
//         });
//         setNewStaff({ email: "", name: "" });
//         setShowAddStaffModal(false);
//         await refreshStaffData();
//       }
//     } catch (error: any) {
//       console.error("Unexpected error:", error);
//       setMessage({ type: "error", text: "An unexpected error occurred. Please try again." });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formatDate = (dateString: string): string => {
//     const date = new Date(dateString);
//     return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
//   };

//   const handleInputChange = (field: keyof NewStaff, value: string) => setNewStaff(p => ({ ...p, [field]: value }));
//   const handleEditInputChange = (field: keyof EditStaff, value: string) => setEditStaff(p => ({ ...p, [field]: value }));

//   if (isLoading) {
//     return (
//       <DashboardLayout
//         header={<Header title="Staff Management" description="Manage your healthcare team and staff information." showHamburgerMenu />}
//       >
//         <div className="flex min-h-[400px] items-center justify-center">
//           <LoadingSpinner message="Loading staff data..." size="md" />
//         </div>
//       </DashboardLayout>
//     );
//   }

//   return (
//     <DashboardLayout
//       header={<Header title="Staff Management" description="Manage your healthcare team and staff information." showHamburgerMenu />}
//     >
//       <div>
//         {/* Success/Error messages */}
//         {message && (
//           <div
//             className={`mb-6 rounded-lg p-4 ${
//               message.type === "success"
//                 ? "border border-green-200 bg-green-50 text-green-800"
//                 : "border border-red-200 bg-red-50 text-red-800"
//             }`}
//           >
//             <div className="flex items-center justify-between">
//               <span className="text-sm">{message.text}</span>
//               <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-75">
//                 <X className="h-4 w-4" />
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Stats card: single-line layout on mobile */}
//         <div className="mb-8">
//           <div className="w-full rounded-lg bg-white p-4 shadow sm:p-5 md:w-fit">
//             <div className="flex items-center justify-start gap-2 whitespace-nowrap md:justify-between md:gap-3">
//               <div className="flex min-w-0 items-center gap-2 md:gap-3">
//                 <div className="rounded-full bg-purple-100 p-2 md:p-3">
//                   <Users className="h-5 w-5 text-purple-600 md:h-6 md:w-6" />
//                 </div>
//                 <p className="truncate text-sm font-medium text-gray-600">Total Staff</p>
//               </div>
//               <p className="shrink-0 text-xl font-semibold text-gray-900 md:ml-auto md:text-2xl">{filteredStaffData.length}</p>
//             </div>
//             {(searchTerm || selectedRole !== "all" || selectedStatus !== "all") && (
//               <p className="mt-1 text-xs text-gray-500">of {staffData.length} total</p>
//             )}
//           </div>
//         </div>

//         {/* Table + Filters */}
//         <div className="rounded-lg bg-white p-4 shadow sm:p-6">
//           {/* Filters toolbar: stacked 100% on mobile, compact on md+ */}
//           <div className="mb-4 md:mb-6">
//             <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
//               {/* Left group */}
//               <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4 md:pr-4">
//                 {/* Search */}
//                 <div className="relative md:w-[256px] lg:w-[288px]">
//                   <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
//                   <input
//                     type="text"
//                     placeholder="Search staff..."
//                     value={searchTerm}
//                     onChange={handleSearchChange}
//                     className="w-full rounded-lg border border-gray-300 px-10 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
//                   />
//                   {searchTerm && (
//                     <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                       <X className="h-4 w-4" />
//                     </button>
//                   )}
//                 </div>

//                 {/* Role */}
//                 <select
//                   value={selectedRole}
//                   onChange={handleRoleChange}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[160px]"
//                 >
//                   <option value="all">All Roles</option>
//                   {availableRoles.map(role => (
//                     <option key={role.value} value={role.value}>
//                       {role.label}
//                     </option>
//                   ))}
//                 </select>

//                 {/* Status */}
//                 <select
//                   value={selectedStatus}
//                   onChange={handleStatusChange}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[160px]"
//                 >
//                   <option value="all">All Status</option>
//                   <option value="active">Active</option>
//                   <option value="inactive">Inactive</option>
//                 </select>
//               </div>

//               {/* Add button */}
//               <Button
//                 type="primary"
//                 size="large"
//                 icon={<Plus className="h-4 w-4" />}
//                 onClick={() => setShowAddStaffModal(true)}
//                 style={{
//                   backgroundColor: "#9564e9",
//                   borderColor: "#9564e9",
//                   boxShadow: "0 4px 12px rgba(149, 100, 233, 0.3)",
//                   borderRadius: 8,
//                   height: 44,
//                   fontWeight: 600,
//                   fontSize: 14,
//                   display: "flex",
//                   alignItems: "center",
//                   gap: 8,
//                 }}
//                 className="w-full transform transition-all duration-200 hover:!scale-105 hover:!border-[#8554d6] hover:!bg-[#8554d6] md:w-auto"
//               >
//                 Add Staff Member
//               </Button>
//             </div>

//             {(searchTerm || selectedRole !== "all" || selectedStatus !== "all") && (
//               <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
//                 <span>
//                   {filteredStaffData.length} of {staffData.length} staff
//                 </span>
//                 <button
//                   onClick={() => {
//                     setSearchTerm("");
//                     setSelectedRole("all");
//                     setSelectedStatus("all");
//                   }}
//                   className="text-purple-600 underline hover:text-purple-800"
//                 >
//                   Clear filters
//                 </button>
//               </div>
//             )}
//           </div>

//           {/* Table wrapper: horizontal scroll on small screens */}
//           <div className="-mx-4 overflow-x-auto sm:mx-0">
//             <table className="w-full min-w-[980px] sm:min-w-0">
//               <thead>
//                 <tr className="border-b border-gray-200">
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Staff Member</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Joined Date</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Created By</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
//                   <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredStaffData.length === 0 ? (
//                   <tr>
//                     <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
//                       {searchTerm || selectedRole !== "all" || selectedStatus !== "all"
//                         ? `No staff members found matching your search criteria.`
//                         : "No staff members found. Add your first staff member to get started."}
//                       {(searchTerm || selectedRole !== "all" || selectedStatus !== "all") && (
//                         <div className="mt-2">
//                           <button
//                             onClick={() => {
//                               setSearchTerm("");
//                               setSelectedRole("all");
//                               setSelectedStatus("all");
//                             }}
//                             className="text-sm text-purple-600 underline hover:text-purple-800"
//                           >
//                             Clear filters to see all staff
//                           </button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredStaffData.map((staff: Staff) => (
//                     <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50">
//                       <td className="px-4 py-3">
//                         <div className="flex items-center">
//                           <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-semibold text-green-600">
//                             {staff.avatar}
//                           </div>
//                           <div className="ml-3 min-w-0">
//                             <p className="truncate font-medium text-gray-900">{staff.name}</p>
//                             <p className="truncate text-sm text-gray-500">{staff.role}</p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 text-gray-900">
//                         <span className="block max-w-[220px] truncate">{staff.email}</span>
//                       </td>
//                       <td className="px-4 py-3">
//                         <span
//                           className={`badge ${
//                             staff.role === "doctor" ? "badge-info" : staff.role === "nurse" ? "badge-success" : "badge-warning"
//                           }`}
//                         >
//                           {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-gray-900">{formatDate(staff.joinedDate)}</td>
//                       <td className="px-4 py-3 text-gray-900">
//                         <span className="block max-w-[180px] truncate">{staff.createdBy}</span>
//                       </td>
//                       <td className="px-4 py-3">
//                         <span className={`badge ${staff.status === "active" ? "badge-success" : "badge-warning"}`}>
//                           {staff.status === "active" ? "Active" : "Inactive"}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3">
//                         <Dropdown
//                           menu={{
//                             items: [
//                               { key: "edit", label: "Edit" },
//                               { key: "delete", label: "Delete", danger: true },
//                             ],
//                             onClick: ({ key }) => {
//                               if (key === "edit") handleEditStaff(staff);
//                               else if (key === "delete") handleDeleteStaff(staff);
//                             },
//                           }}
//                           trigger={["click"]}
//                           placement="bottomRight"
//                           getPopupContainer={() => document.body}
//                         >
//                           <Button
//                             type="text"
//                             icon={<MoreVertical className="h-4 w-4" />}
//                             className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
//                           />
//                         </Dropdown>
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {/* Add Staff Modal */}
//         {showAddStaffModal && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
//             <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
//               <div className="mb-4 flex items-center justify-between">
//                 <h3 className="text-lg font-semibold">Add New Staff Member</h3>
//                 <button onClick={() => setShowAddStaffModal(false)} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
//                   <X className="h-6 w-6" />
//                 </button>
//               </div>

//               {message && (
//                 <div
//                   className={`mb-4 rounded-lg p-3 ${
//                     message.type === "success"
//                       ? "border border-green-200 bg-green-50 text-green-800"
//                       : "border border-red-200 bg-red-50 text-red-800"
//                   }`}
//                 >
//                   <div className="flex items-center justify-between">
//                     <span className="text-sm">{message.text}</span>
//                     <button onClick={() => setMessage(null)} className="text-current opacity-50 hover:opacity-75">
//                       <X className="h-4 w-4" />
//                     </button>
//                   </div>
//                 </div>
//               )}

//               {isSubmitting && (
//                 <div className="mb-4">
//                   <LoadingSpinner message="Creating staff member..." size="sm" />
//                 </div>
//               )}

//               <form onSubmit={handleAddStaff} className="space-y-4">
//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
//                   <input
//                     type="text"
//                     required
//                     value={newStaff.name}
//                     onChange={e => handleInputChange("name", e.target.value)}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
//                     placeholder="Enter full name"
//                     disabled={isSubmitting}
//                   />
//                 </div>
//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
//                   <input
//                     type="email"
//                     required
//                     value={newStaff.email}
//                     onChange={e => handleInputChange("email", e.target.value)}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
//                     placeholder="Enter email address"
//                     disabled={isSubmitting}
//                   />
//                   <p className="mt-1 text-xs text-gray-500">A secure temporary password will be auto-generated and sent to this email.</p>
//                 </div>

//                 <div className="flex flex-col gap-3 pt-4 md:flex-row">
//                   <button
//                     type="button"
//                     onClick={() => setShowAddStaffModal(false)}
//                     className="btn btn-secondary flex-1"
//                     disabled={isSubmitting}
//                   >
//                     Cancel
//                   </button>
//                   <Button
//                     type="primary"
//                     htmlType="submit"
//                     loading={isSubmitting}
//                     disabled={isSubmitting}
//                     style={{
//                       backgroundColor: "#9564e9",
//                       borderColor: "#9564e9",
//                       borderRadius: 6,
//                       height: 40,
//                       fontWeight: 600,
//                       flex: 1,
//                     }}
//                     className="hover:!border-[#8554d6] hover:!bg-[#8554d6] transition-all duration-200"
//                   >
//                     {isSubmitting ? "Creating..." : "Create Staff"}
//                   </Button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}

//         {/* Edit Staff Modal */}
//         {showEditStaffModal && selectedStaffForEdit && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
//             <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
//               <div className="mb-4 flex items-center justify-between">
//                 <h3 className="text-lg font-semibold">Edit Staff Member</h3>
//                 <button
//                   onClick={() => {
//                     setShowEditStaffModal(false);
//                     setSelectedStaffForEdit(null);
//                   }}
//                   className="text-gray-400 hover:text-gray-600"
//                   disabled={isSubmitting}
//                 >
//                   <X className="h-6 w-6" />
//                 </button>
//               </div>

//               {isSubmitting && (
//                 <div className="mb-4">
//                   <LoadingSpinner message="Updating staff member..." size="sm" />
//                 </div>
//               )}

//               <form onSubmit={handleEditSubmit} className="space-y-4">
//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
//                   <input
//                     type="text"
//                     required
//                     value={editStaff.name}
//                     onChange={e => handleEditInputChange("name", e.target.value)}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
//                     placeholder="Enter full name"
//                     disabled={isSubmitting}
//                   />
//                 </div>
//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
//                   <select
//                     value={editStaff.status}
//                     onChange={e => handleEditInputChange("status", e.target.value)}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
//                     disabled={isSubmitting}
//                   >
//                     <option value="active">Active</option>
//                     <option value="inactive">Inactive</option>
//                   </select>
//                 </div>

//                 <div className="flex flex-col gap-3 pt-4 md:flex-row">
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setShowEditStaffModal(false);
//                       setSelectedStaffForEdit(null);
//                     }}
//                     className="btn btn-secondary flex-1"
//                     disabled={isSubmitting}
//                   >
//                     Cancel
//                   </button>
//                   <Button
//                     type="primary"
//                     htmlType="submit"
//                     loading={isSubmitting}
//                     disabled={isSubmitting}
//                     style={{
//                       backgroundColor: "#9564e9",
//                       borderColor: "#9564e9",
//                       borderRadius: 6,
//                       height: 40,
//                       fontWeight: 600,
//                       flex: 1,
//                     }}
//                     className="hover:!border-[#8554d6] hover:!bg-[#8554d6] transition-all duration-200"
//                   >
//                     {isSubmitting ? "Updating..." : "Update Staff"}
//                   </Button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}

//         {/* Delete Confirmation Modal */}
//         {showDeleteConfirmModal && selectedStaffForDelete && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
//             <div className="w-full max-w-md rounded-lg bg-white p-6">
//               <div className="mb-4 flex items-center">
//                 <div className="mr-4 rounded-full bg-red-100 p-3">
//                   <AlertTriangle className="h-6 w-6 text-red-600" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-semibold text-gray-900">Delete Staff Member</h3>
//                   <p className="text-sm text-gray-500">This action cannot be undone</p>
//                 </div>
//               </div>

//               {isDeleting && (
//                 <div className="mb-4">
//                   <LoadingSpinner message="Deleting staff member..." size="sm" />
//                 </div>
//               )}

//               <div className="mb-6">
//                 <p className="text-gray-700">
//                   Are you sure you want to delete <span className="font-semibold">{selectedStaffForDelete.name}</span>? This will
//                   permanently remove their access and all associated data.
//                 </p>
//               </div>

//               <div className="flex flex-col gap-3 md:flex-row">
//                 <button
//                   onClick={() => {
//                     setShowDeleteConfirmModal(false);
//                     setSelectedStaffForDelete(null);
//                   }}
//                   className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
//                   disabled={isDeleting}
//                 >
//                   No, Cancel
//                 </button>
//                 <Button
//                   onClick={confirmDeleteStaff}
//                   loading={isDeleting}
//                   disabled={isDeleting}
//                   style={{
//                     backgroundColor: "#dc2626",
//                     borderColor: "#dc2626",
//                     borderRadius: 6,
//                     height: 40,
//                     fontWeight: 600,
//                     flex: 1,
//                   }}
//                   className="hover:!bg-[#b91c1c] hover:!border-[#b91c1c] transition-all duration-200"
//                 >
//                   {isDeleting ? "Deleting..." : "Yes, Delete"}
//                 </Button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </DashboardLayout>
//   );
// }

import StaffPageRefactored from "@/components/staff/staff-page-refactored";

export default function Page() {
  return <StaffPageRefactored />;
}
