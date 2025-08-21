"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Calendar, CheckCircle, Clock, X, SearchIcon, Plus, MoreVertical, Edit, Trash2, Mail, PhoneIcon } from "lucide-react";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import { appointmentHelper, type MeetingSchedule } from "@/utils/appointment-helper";
import { Form } from "antd";
import { createClient } from "@/utils/supabase/config/client";
import dayjs from "dayjs";
import "react-phone-number-input/style.css";
import { StatCard } from "@/components/appointments/stat-card";
import { AddAppointmentModal } from "@/components/appointments/add-appointment-modal";
import { EditStatusModal } from "@/components/appointments/edit-status-modal";
import { DeleteConfirmationModal } from "@/components/appointments/delete-confirmation-modal";

interface Message {
  type: "error" | "success";
  text: string;
}

export default function AppointmentsPage() {
  const [appointmentsData, setAppointmentsData] = useState<MeetingSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<MeetingSchedule | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState<Message | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [, setPhoneError] = useState<string>("");
  const [form] = Form.useForm();
  const dropdownRef = useRef<HTMLTableCellElement>(null);

  const supabase = createClient();

  // Load appointments data from Supabase
  useEffect(() => {
    const loadAppointments = async () => {
      if (!clinicId) return;
      setIsLoading(true);
      try {
        const meetings = await appointmentHelper.getMeetingsByClinic(clinicId);
        setAppointmentsData(meetings);
      } catch (error) {
        console.error("Error loading appointments:", error);
        setMessage({
          type: "error",
          text: "Failed to load appointments. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadAppointments();
  }, [clinicId]);

  // Get clinic ID when component mounts
  useEffect(() => {
    const fetchClinicId = async () => {
      try {
        const clinic_id = await getCurrentUserClinic();
        if (!clinic_id) {
          setMessage({
            type: "error",
            text: "No clinic found. Please make sure you have a clinic set up.",
          });
          return;
        }
        setClinicId(clinic_id);
      } catch (error) {
        console.error("Error fetching clinic ID:", error);
        setMessage({
          type: "error",
          text: "Failed to fetch clinic information.",
        });
      }
    };
    fetchClinicId();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Clear copied link indicator after 2 seconds
  useEffect(() => {
    if (copiedLink) {
      const timer = setTimeout(() => {
        setCopiedLink(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedLink]);


  const handleAddAppointment = async () => {
    if (!clinicId) {
      setMessage({
        type: "error",
        text: "No clinic found. Please make sure you have a clinic set up.",
      });
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
      
      const { error } = await supabase.from("meeting_schedule").upsert([
        {
          username: `${values.first_name} ${values.last_name}`.trim(),
          email: values.email,
          phone_number: values.phone_number || phoneNumber,
          preferred_meeting_time: fullDateTime,
          meeting_notes: values.meeting_notes || null,
          clinic_id: clinicId,
        },
      ], { onConflict: "email" });

      const { data: leadSourceData, error: leadSourceError } = await supabase
        .from("lead_source")
        .select("id")
        .eq("name", "Others")
        .single();

      const { error: leadError } = await supabase.from("lead").upsert([
        {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email,
          phone: values.phone_number || phoneNumber,
          status: "Booked",
          interest: "medium",
          clinic_id: clinicId,
          source_id: leadSourceData?.id,
        },
      ],{ onConflict: "email,clinic_id" });

      if (error || leadError || leadSourceError) {
        if (error?.code === "23505") {
          setMessage({
            type: "error",
            text: "This email is already registered for a meeting",
          });
        } else {
          throw error;
        }
        return;
      }

      // Reload appointments data
      const meetings = await appointmentHelper.getMeetingsByClinic(clinicId!);
      setAppointmentsData(meetings);

      setMessage({
        type: "success",
        text: "Meeting schedule saved successfully!",
      });
      form.resetFields();
      setPhoneNumber("");
      setPhoneError("");
      setShowAddAppointmentModal(false);
    } catch (error: any) {
      console.error("Error saving meeting schedule:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to save meeting schedule",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      const updatedMeeting = await appointmentHelper.updateMeetingStatus(selectedAppointment.id, selectedAppointment.status);
      // Update local state
      setAppointmentsData(prev => prev.map(apt => (apt.id === selectedAppointment.id ? updatedMeeting : apt)));
      setShowEditStatusModal(false);
      setSelectedAppointment(null);
      setMessage({ type: "success", text: "Appointment status updated successfully!" });
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to update appointment status. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      await appointmentHelper.deleteMeeting(selectedAppointment.id);
      // Update local state
      setAppointmentsData(prev => prev.filter(apt => apt.id !== selectedAppointment.id));
      setShowDeleteConfirmation(false);
      setSelectedAppointment(null);
      setMessage({ type: "success", text: "Appointment deleted successfully!" });
    } catch (error: any) {
      console.error("Error deleting appointment:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to delete appointment. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDropdown = (e: React.MouseEvent, appointmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdown(activeDropdown === appointmentId ? null : appointmentId);
  };

  const openEditModal = (appointment: MeetingSchedule) => {
    setSelectedAppointment(appointment);
    setShowEditStatusModal(true);
    setActiveDropdown(null);
  };

  const openDeleteConfirmation = (appointment: MeetingSchedule) => {
    setSelectedAppointment(appointment);
    setShowDeleteConfirmation(true);
    setActiveDropdown(null);
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
  if (isLoading) {
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
      <div>
        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-lg border p-4 ${
              message.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{message.text}</p>
              <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stats: single row per card on mobile */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-blue-600 md:h-6 md:w-6" />}
            iconBg="bg-blue-100"
            title="Total"
            value={appointmentsData.length}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-600 md:h-6 md:w-6" />}
            iconBg="bg-green-100"
            title="Confirmed"
            value={appointmentsData.filter(apt => apt.status === "confirmed").length}
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-yellow-600 md:h-6 md:w-6" />}
            iconBg="bg-yellow-100"
            title="Pending"
            value={appointmentsData.filter(apt => apt.status === "pending").length}
          />
        </div>

        {/* Filters + Action: mobile stacks 100% width, md+ inline and compact */}
        <div className="rounded-lg bg-white p-4 shadow sm:p-6">
          <div className="mb-4 md:mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: inputs group */}
              <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4 md:pr-4">
                {/* Search */}
                <div className="relative md:w-[320px]">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or notes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-10 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[220px]"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Right: action button */}
              <button
                onClick={handleAddAppointment}
                className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-purple-700 md:h-10 md:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add Appointment
              </button>
            </div>

            {/* Filter Indicator */}
            {(searchQuery || statusFilter !== "all") && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>
                  {filteredAppointments.length} of {appointmentsData.length} appointments
                </span>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-purple-600 underline hover:text-purple-800"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Table wrapper: allows horizontal scroll on small screens */}
          <div className="relative -mx-4 max-w-full overflow-x-auto touch-pan-x overscroll-x-contain md:mx-0 md:overflow-visible">
            <table className="w-full min-w-[900px] sm:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date & Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Meeting Notes</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {appointmentsData.length === 0 ? (
                        <div className="flex flex-col items-center">
                          <Calendar className="mb-4 h-12 w-12 text-gray-300" />
                          <p className="mb-2 text-lg font-medium text-gray-600">No appointments yet</p>
                          <p className="text-sm text-gray-500">Create your first appointment to get started</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <SearchIcon className="mb-4 h-12 w-12 text-gray-300" />
                          <p className="mb-2 text-lg font-medium text-gray-600">No appointments match your filters</p>
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setStatusFilter("all");
                            }}
                            className="text-sm text-purple-600 underline hover:text-purple-800"
                          >
                            Clear filters to see all appointments
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map(appointment => {
                    const { date, time } = formatAppointmentDateTime(appointment.preferred_meeting_time);
                    return (
                      <tr key={appointment.id} className="border-b border-gray-100 hover:bg-gray-50">
                        {/* Patient */}
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                              {appointment.username
                                .split(" ")
                                .map(n => n[0])
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <p className="font-medium text-gray-900">{appointment.username}</p>
                            </div>
                          </div>
                        </td>
                        {/* Email */}
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <Mail className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="truncate text-gray-900">{appointment.email}</span>
                          </div>
                        </td>
                        {/* Phone */}
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <PhoneIcon className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="text-gray-900">{appointment.phone_number || "No phone"}</span>
                          </div>
                        </td>
                        {/* Date & Time */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-900">{date}</p>
                            <p className="text-sm text-gray-500">{time}</p>
                          </div>
                        </td>
                        {/* Notes */}
                        <td className="px-4 py-3">
                          <div className="max-w-[220px]">
                            <p className="truncate text-sm text-gray-900" title={appointment.meeting_notes || ""}>
                              {appointment.meeting_notes || "No notes"}
                            </p>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              appointment.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {appointment.status === "confirmed" ? "CONFIRMED" : "PENDING"}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="relative px-4 py-3" ref={activeDropdown === appointment.id ? dropdownRef : undefined}>
                          <div className="dropdown-container relative">
                            <button
                              onClick={e => toggleDropdown(e, appointment.id)}
                              className="rounded-full p-2 transition-colors duration-200 hover:bg-gray-100"
                              type="button"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-600" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeDropdown === appointment.id && (
                              <div className="absolute z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    openEditModal(appointment);
                                  }}
                                  className="flex w-full items-center rounded-t-lg px-4 py-2 text-sm text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                                  type="button"
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Status
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    openDeleteConfirmation(appointment);
                                  }}
                                  className="flex w-full items-center rounded-b-lg px-4 py-2 text-sm text-red-600 transition-colors duration-200 hover:bg-red-50"
                                  type="button"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Appointment Modal - Enhanced Schedule Meeting Form */}
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

        {/* Edit Status Modal */}
        <EditStatusModal
          isOpen={showEditStatusModal}
          onClose={() => {
            setShowEditStatusModal(false);
            setSelectedAppointment(null);
          }}
          onSubmit={handleEditStatus}
          isSubmitting={isSubmitting}
          appointment={selectedAppointment}
          onStatusChange={status => setSelectedAppointment(prev => (prev ? { ...prev, status } : null))}
        />

        {/* Delete Confirmation Modal */}
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
