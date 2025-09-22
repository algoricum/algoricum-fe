"use client";
import { AddAppointmentModal } from "@/components/appointments/add-appointment-modal";
import { DeleteConfirmationModal } from "@/components/appointments/delete-confirmation-modal";
import { EditAppointmentModal } from "@/components/appointments/edit-appointment-modal";
import { StatCard } from "@/components/appointments/stat-card";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { useDropdown } from "@/hooks/useDropdown";
import { usePagination } from "@/hooks/usePagination"; // Import the usePagination hook
import DashboardLayout from "@/layouts/DashboardLayout";
import { appointmentHelper, type AppointmentStatus, type MeetingSchedule } from "@/utils/appointment-helper";
import { createClient } from "@/utils/supabase/config/client";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import { Form, Pagination, Select } from "antd";
import dayjs from "dayjs";
import { Calendar, Edit, Mail, MoreVertical, PhoneIcon, Plus, SearchIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import "react-phone-number-input/style.css";
import { appointmentStatsConfig } from "./statsUtil";

export default function AppointmentsPage() {
  const [appointmentsData, setAppointmentsData] = useState<MeetingSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusStats, setStatusStats] = useState<AppointmentStatus[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showEditAppointmentModal, setShowEditAppointmentModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<MeetingSchedule | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [, setPhoneError] = useState<string>("");
  const [form] = Form.useForm();
  const { activeDropdown, dropdownPosition, dropdownRef, toggleDropdown, closeDropdown } = useDropdown({
    dropdownWidth: 192,
    dropdownHeight: 120,
    offset: 8,
  });

  // Initialize pagination with default page size of 10
  const { currentPage, pageSize, paginationConfig, setTotal, setCurrentPage } = usePagination(10);

  const supabase = createClient();

  // Load appointments data from Supabase with pagination
  const loadAppointments = async () => {
    if (!clinicId) return;
    setIsLoading(true);
    setStatsLoading(true);
    try {
      const {
        data: meetings,
        error,
        count,
      } = await supabase
        .from("meeting_schedule")
        .select("*", { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;

      // Set both data and total count from single query
      setAppointmentsData(meetings || []);
      setTotal(count || 0);
    } catch (error) {
      console.error("Error loading appointments:", error);
      ErrorToast("Failed to load appointments. Please try again.");
    } finally {
      setIsLoading(false);
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [clinicId, currentPage, pageSize, setTotal]);

  // Get clinic ID when component mounts
  useEffect(() => {
    const fetchClinicId = async () => {
      try {
        const clinic_id = await getCurrentUserClinic();
        if (!clinic_id) {
          ErrorToast("No clinic found. Please make sure you have a clinic set up.");
          return;
        }
        setClinicId(clinic_id);
      } catch (error) {
        console.error("Error fetching clinic ID:", error);
        ErrorToast("Failed to fetch clinic information.");
      }
    };
    fetchClinicId();
  }, []);

  useEffect(() => {
    if (clinicId) {
      loadStatusStats();
    }
  }, [clinicId, appointmentsData]);

  // Clear copied link indicator after 2 seconds
  useEffect(() => {
    if (copiedLink) {
      const timer = setTimeout(() => {
        setCopiedLink(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedLink]);

  const loadStatusStats = async () => {
    if (!clinicId) return;
    try {
      setStatsLoading(true);
      const stats = await appointmentHelper.getStatusStats(clinicId);
      setStatusStats(stats);
    } catch (err) {
      console.error("Error loading status stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAddAppointment = async () => {
    if (!clinicId) {
      ErrorToast("No clinic found. Please make sure you have a clinic set up.");
      return;
    }
    setShowAddAppointmentModal(true);
  };

  const handleSubmitMeeting = async (values: any) => {
    try {
      setIsSubmitting(true);
      let fullDateTime = null;
      if (values.preferred_meeting_date && values.preferred_meeting_time) {
        const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
        const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
        fullDateTime = `${date} ${time}`;
      }

      const { error } = await supabase.from("meeting_schedule").upsert(
        [
          {
            username: `${values.first_name} ${values.last_name}`.trim(),
            email: values.email,
            phone_number: values.phone_number || phoneNumber,
            preferred_meeting_time: fullDateTime,
            meeting_notes: values.meeting_notes || null,
            clinic_id: clinicId,
          },
        ],
        { onConflict: "email" },
      );

      const { data: leadSourceData, error: leadSourceError } = await supabase
        .from("lead_source")
        .select("id")
        .eq("name", "Others")
        .single();

      const { error: leadError } = await supabase.from("lead").upsert(
        [
          {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            email: values.email,
            phone: values.phone_number || phoneNumber,
            status: "Booked",
            interest_level: "medium",
            clinic_id: clinicId,
            source_id: leadSourceData?.id,
          },
        ],
        { onConflict: "email,clinic_id" },
      );

      if (error || leadError || leadSourceError) {
        if (error?.code === "23505") {
          ErrorToast("This email is already registered for a meeting");
        } else {
          throw error;
        }
        return;
      }

      await loadAppointments();

      SuccessToast("Meeting schedule saved successfully!");
      form.resetFields();
      setPhoneNumber("");
      setPhoneError("");
      setShowAddAppointmentModal(false);
    } catch (error: any) {
      console.error("Error saving meeting schedule:", error);
      ErrorToast(error.message || "Failed to save meeting schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAppointment = async (formData: any) => {
    if (!selectedAppointment) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedMeeting = await appointmentHelper.updateMeeting(selectedAppointment.id, formData);

      // Update local state
      setAppointmentsData(prev => prev.map(apt => (apt.id === selectedAppointment.id ? updatedMeeting : apt)));
      setShowEditAppointmentModal(false);
      setSelectedAppointment(null);
      SuccessToast("Appointment updated successfully!");
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      ErrorToast(error.message || "Failed to update appointment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;

    setIsSubmitting(true);
    try {
      await appointmentHelper.deleteMeeting(selectedAppointment.id);

      // Calculate if current page will be empty after deletion
      const newTotalItems = appointmentsData.length - 1;
      const totalPages = Math.ceil(newTotalItems / pageSize);

      // If current page is now beyond total pages, go to the previous page
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(currentPage - 1); // This will trigger useEffect
      } else if (newTotalItems === 0) {
        setCurrentPage(1); // This will trigger useEffect
      }

      setShowDeleteConfirmation(false);
      setSelectedAppointment(null);
      SuccessToast("Appointment deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting appointment:", error);
      ErrorToast(error.message || "Failed to delete appointment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (appointment: MeetingSchedule) => {
    setSelectedAppointment(appointment);
    setShowEditAppointmentModal(true);
    closeDropdown();
  };

  const openDeleteConfirmation = (appointment: MeetingSchedule) => {
    setSelectedAppointment(appointment);
    setShowDeleteConfirmation(true);
    closeDropdown();
  };

  // Filter appointments based on search and status
  const filteredAppointments = appointmentsData.filter(appointment => {
    const matchesSearch =
      searchQuery === "" ||
      appointment.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (appointment.meeting_notes && appointment.meeting_notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Format date and time for display
  const formatAppointmentDateTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return { date: "Not scheduled", time: "Not scheduled" };
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  // Loading state
  if (isLoading || statsLoading) {
    return (
      <DashboardLayout header={<Header title="Appointments" description="Manage patient appointments and scheduling." showHamburgerMenu />}>
        <div className="flex min-h-[400px] items-center justify-center">
          <LoadingSpinner message="Loading appointments..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={<Header title="Appointments" description="Manage patient appointments and scheduling." showHamburgerMenu />}>
      <div className="space-y-6 px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {appointmentStatsConfig.map(stat => (
            <StatCard key={stat.key} icon={stat.icon} iconBg={stat.iconBg} title={stat.title} value={stat.getValue(statusStats)} />
          ))}
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Filter and Add Button */}
          <div className="flex gap-3">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-auto min-w-[120px]"
              size="middle"
              style={{
                borderRadius: "8px",
              }}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="confirmed">Confirmed</Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
            </Select>

            {/* Add Appointment Button */}
            <button
              onClick={handleAddAppointment}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Add Appointment
            </button>
          </div>
        </div>

        {/* Enhanced Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Patient</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Date & Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Meeting Notes</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      {appointmentsData.length === 0 ? (
                        <div className="flex flex-col items-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                            <Calendar className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="mb-2 text-lg font-medium text-gray-700">No appointments yet</p>
                          <p className="text-sm text-gray-500">Create your first appointment to get started</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                            <SearchIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="mb-2 text-lg font-medium text-gray-700">No appointments match your filters</p>
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setStatusFilter("all");
                            }}
                            className="mt-2 text-sm font-medium text-purple-600 transition-colors hover:text-purple-800 underline underline-offset-2"
                          >
                            Clear filters to see all appointments
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appointment, index) => {
                    const { date, time } = formatAppointmentDateTime(appointment.preferred_meeting_time);
                    return (
                      <tr
                        key={appointment.id}
                        className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 hover:shadow-sm ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                        }`}
                      >
                        {/* Patient */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-purple-100 font-semibold text-blue-700 shadow-sm ring-2 ring-white">
                              {appointment.username
                                .split(" ")
                                .map(n => n[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <p className="font-medium text-gray-900 group-hover:text-gray-800">{appointment.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 mr-3">
                              <Mail className="h-4 w-4 text-gray-500" />
                            </div>
                            <span className="truncate text-gray-700 font-medium">{appointment.email}</span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 mr-3">
                              <PhoneIcon className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="text-gray-700 font-medium">{appointment.phone_number || "No phone"}</span>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
                              <p className="font-medium text-gray-900">{date}</p>
                            </div>
                            <p className="text-sm text-gray-500 ml-4">{time}</p>
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="px-6 py-4">
                          <div className="max-w-[220px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-200">
                              <p className="truncate text-sm text-gray-700" title={appointment.meeting_notes || ""}>
                                {appointment.meeting_notes || "No notes"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
                              appointment.status === "confirmed"
                                ? "bg-green-50 text-green-700 ring-green-600/20"
                                : "bg-amber-50 text-amber-700 ring-amber-600/20"
                            }`}
                          >
                            <div
                              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                                appointment.status === "confirmed" ? "bg-green-600" : "bg-amber-600"
                              }`}
                            ></div>
                            {appointment.status === "confirmed" ? "CONFIRMED" : "PENDING"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 static">
                          <div className="dropdown-container relative">
                            <button
                              onClick={e => toggleDropdown(e, appointment.id)}
                              className="rounded-lg p-2.5 transition-all duration-200 hover:bg-gray-100 hover:shadow-sm border border-transparent hover:border-gray-200"
                              type="button"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Dropdown Menu Portal - Outside table container */}
          {activeDropdown && (
            <div className="fixed inset-0 z-[9999]">
              {filteredAppointments.map(appointment => {
                if (appointment.id !== activeDropdown) return null;

                return (
                  <div
                    key={appointment.id}
                    ref={dropdownRef}
                    className="absolute w-48 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                    }}
                  >
                    <div className="py-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openEditModal(appointment);
                          closeDropdown();
                        }}
                        className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-700"
                        type="button"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 mr-3">
                          <Edit className="h-3 w-3 text-blue-600" />
                        </div>
                        Edit Status
                      </button>
                      <hr className="my-1 border-gray-200" />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openDeleteConfirmation(appointment);
                        }}
                        className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-50"
                        type="button"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-100 mr-3">
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </div>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-center py-4">
          <div className="bg-white rounded-lg px-6 py-4 shadow-sm border border-gray-200">
            <Pagination {...paginationConfig} />
          </div>
        </div>

        {/* Modals */}
        <AddAppointmentModal
          isOpen={showAddAppointmentModal}
          onClose={() => {
            setShowAddAppointmentModal(false);
            form.resetFields();
            setPhoneNumber("");
            setPhoneError("");
          }}
          onSubmit={handleSubmitMeeting}
          isSubmitting={isSubmitting}
          clinicId={clinicId}
        />

        <EditAppointmentModal
          isOpen={showEditAppointmentModal}
          onClose={() => {
            setShowEditAppointmentModal(false);
            setSelectedAppointment(null);
          }}
          onSubmit={handleEditAppointment}
          isSubmitting={isSubmitting}
          appointment={selectedAppointment}
        />

        <DeleteConfirmationModal
          isOpen={showDeleteConfirmation}
          onClose={() => {
            setShowDeleteConfirmation(false);
            setSelectedAppointment(null);
          }}
          onConfirm={handleDeleteAppointment}
          isSubmitting={isSubmitting}
          appointment={selectedAppointment}
        />
      </div>
    </DashboardLayout>
  );
}
