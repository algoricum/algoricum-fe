"use client";

import type React from "react";
import { useState, useEffect,useRef } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Calendar,
  CheckCircle,
  Clock,
  X,
  SearchIcon,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  User,
  Mail,
  LinkIcon,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import {
  appointmentHelper,
  type MeetingSchedule,
  type CreateMeetingRequest,
  type MeetingStatus,
  formatMeetingDate,
} from "@/utils/appointment-helper";

interface Message {
  type: "error" | "success";
  text: string;
}
interface NewMeetingForm {
  username: string;
  email: string;
  preferred_meeting_date: string;
  preferred_meeting_time: string;
  meeting_notes: string;
  meeting_link: string;
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
  const [newMeeting, setNewMeeting] = useState<NewMeetingForm>({
    username: "",
    email: "",
    preferred_meeting_date: "",
    preferred_meeting_time: "",
    meeting_notes: "",
    meeting_link: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLTableCellElement>(null);

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

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear previous validation errors
    setValidationErrors([]);

    if (!clinicId) {
      setValidationErrors(["No clinic found. Please make sure you have a clinic set up."]);
      return;
    }

    // Client-side validation
    const errors: string[] = [];
    if (!newMeeting.username.trim()) {
      errors.push("Name is required");
    }
    if (!newMeeting.email.trim()) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMeeting.email)) {
      errors.push("Please enter a valid email address");
    }
    if (!newMeeting.preferred_meeting_date) {
      errors.push("Meeting date is required");
    }
    if (!newMeeting.preferred_meeting_time) {
      errors.push("Meeting time is required");
    }
    if (newMeeting.preferred_meeting_date && newMeeting.preferred_meeting_time) {
      const meetingDateTime = new Date(`${newMeeting.preferred_meeting_date} ${newMeeting.preferred_meeting_time}`);
      if (meetingDateTime < new Date()) {
        errors.push("Meeting time cannot be in the past");
      }
    }
    if (newMeeting.meeting_link && !/^https?:\/\/.+/.test(newMeeting.meeting_link)) {
      errors.push("Please enter a valid meeting link URL");
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine date and time into a full datetime
      let fullDateTime: string | null = null;
      if (newMeeting.preferred_meeting_date && newMeeting.preferred_meeting_time) {
        fullDateTime = `${newMeeting.preferred_meeting_date} ${newMeeting.preferred_meeting_time}:00`;
      }
      // Prepare meeting data
      const meetingData: CreateMeetingRequest = {
        username: newMeeting.username,
        email: newMeeting.email,
        preferred_meeting_time: fullDateTime || undefined,
        meeting_notes: newMeeting.meeting_notes || undefined,
        meeting_link: newMeeting.meeting_link || undefined,
        clinic_id: clinicId,
        status: "pending",
      };

      // Check if email already exists
      const emailExists = await appointmentHelper.checkEmailExists(newMeeting.email, clinicId);
      if (emailExists) {
        setValidationErrors(["This email is already registered for a meeting in this clinic"]);
        return;
      }

      // Create the meeting
      const createdMeeting = await appointmentHelper.createMeeting(meetingData);

      // Update local state
      setAppointmentsData(prev => [createdMeeting, ...prev]);
      setMessage({ type: "success", text: "Meeting scheduled successfully!" });
      setNewMeeting({
        username: "",
        email: "",
        preferred_meeting_date: "",
        preferred_meeting_time: "",
        meeting_notes: "",
        meeting_link: "",
      });
      setValidationErrors([]);
      setShowAddAppointmentModal(false);
    } catch (error: any) {
      console.error("Error saving meeting schedule:", error);
      setValidationErrors([error.message || "Failed to schedule meeting"]);
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

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(id);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date & Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Meeting Link</th>
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
                        {/* Date & Time */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-900">{date}</p>
                            <p className="text-sm text-gray-500">{time}</p>
                          </div>
                        </td>
                        {/* Meeting Link */}
                        <td className="px-4 py-3">
                          {appointment.meeting_link ? (
                            <div className="flex items-center space-x-2">
                              <a
                                href={appointment.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-blue-600 transition-colors hover:text-blue-800"
                              >
                                <LinkIcon className="mr-1 h-4 w-4" />
                                <span className="text-sm">Join Meeting</span>
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                              <button
                                onClick={() => copyToClipboard(appointment.meeting_link!, appointment.id)}
                                className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                                title="Copy link"
                              >
                                {copiedLink === appointment.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No link</span>
                          )}
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

        {/* Add Appointment Modal - Schedule Meeting Form */}
        {showAddAppointmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold">Schedule a Meeting</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddAppointmentModal(false);
                    setNewMeeting({
                      username: "",
                      email: "",
                      preferred_meeting_date: "",
                      preferred_meeting_time: "",
                      meeting_notes: "",
                      meeting_link: "",
                    });
                    setValidationErrors([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="mb-6 text-gray-600">Fill out the form below to schedule your meeting with us</p>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="mr-2 h-5 w-5 flex-shrink-0 text-red-600" />
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-red-800">Please fix the following errors:</h4>
                      <ul className="space-y-1 text-sm text-red-700">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2 mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-red-600"></span>
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Scheduling meeting..." size="sm" />
                </div>
              )}

              <form onSubmit={handleSubmitMeeting} className="space-y-6">
                {/* Name and Email */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                      <User className="h-4 w-4" />
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={newMeeting.username}
                      onChange={e => setNewMeeting({ ...newMeeting, username: e.target.value })}
                      placeholder="Enter your name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Mail className="h-4 w-4" />
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={100}
                      value={newMeeting.email}
                      onChange={e => setNewMeeting({ ...newMeeting, email: e.target.value })}
                      placeholder="Enter your email"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Calendar className="h-4 w-4" />
                      Preferred Meeting Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={getTodayDate()}
                      value={newMeeting.preferred_meeting_date}
                      onChange={e => setNewMeeting({ ...newMeeting, preferred_meeting_date: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Clock className="h-4 w-4" />
                      Preferred Meeting Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={newMeeting.preferred_meeting_time}
                      onChange={e => setNewMeeting({ ...newMeeting, preferred_meeting_time: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Meeting Link */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <LinkIcon className="h-4 w-4" />
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={newMeeting.meeting_link}
                    onChange={e => setNewMeeting({ ...newMeeting, meeting_link: e.target.value })}
                    placeholder="https://meet.google.com/... or https://zoom.us/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional: Add a video meeting link (Google Meet, Zoom, etc.)</p>
                </div>

                {/* Meeting Notes */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Meeting Notes</label>
                  <textarea
                    rows={4}
                    value={newMeeting.meeting_notes}
                    onChange={e => setNewMeeting({ ...newMeeting, meeting_notes: e.target.value })}
                    placeholder="Add any additional notes or topics you'd like to discuss..."
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 text-right text-xs text-gray-500">{newMeeting.meeting_notes.length} characters</div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAppointmentModal(false);
                      setNewMeeting({
                        username: "",
                        email: "",
                        preferred_meeting_date: "",
                        preferred_meeting_time: "",
                        meeting_notes: "",
                        meeting_link: "",
                      });
                      setValidationErrors([]);
                    }}
                    className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Status Modal */}
        {showEditStatusModal && selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Appointment Status</h3>
                <button
                  onClick={() => {
                    setShowEditStatusModal(false);
                    setSelectedAppointment(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <p className="mb-1 text-sm text-gray-600">Patient</p>
                <p className="font-medium text-gray-900">{selectedAppointment.username}</p>
                <p className="mt-2 mb-1 text-sm text-gray-600">Email</p>
                <p className="text-gray-900">{selectedAppointment.email}</p>
                <p className="mt-2 mb-1 text-sm text-gray-600">Date & Time</p>
                <p className="text-gray-900">{formatMeetingDate(selectedAppointment.preferred_meeting_time)}</p>
                <p className="mt-2 mb-1 text-sm text-gray-600">Meeting Notes</p>
                <p className="text-sm text-gray-900">{selectedAppointment.meeting_notes || "No notes"}</p>
              </div>

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Updating status..." size="sm" />
                </div>
              )}

              <form onSubmit={handleEditStatus} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={selectedAppointment.status}
                    onChange={e =>
                      setSelectedAppointment({
                        ...selectedAppointment,
                        status: e.target.value as MeetingStatus,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                    disabled={isSubmitting}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditStatusModal(false);
                      setSelectedAppointment(null);
                    }}
                    className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Updating..." : "Update Status"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmation && selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="mb-6 text-center">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Delete Appointment</h3>
                <p className="mb-4 text-gray-600">Are you sure you want to delete this appointment? This action cannot be undone.</p>
                <div className="rounded-lg bg-gray-50 p-4 text-left">
                  <p className="mb-1 text-sm text-gray-600">Patient</p>
                  <p className="mb-2 font-medium text-gray-900">{selectedAppointment.username}</p>
                  <p className="mb-1 text-sm text-gray-600">Email</p>
                  <p className="mb-2 text-gray-900">{selectedAppointment.email}</p>
                  <p className="mb-1 text-sm text-gray-600">Date & Time</p>
                  <p className="mb-2 text-gray-900">{formatMeetingDate(selectedAppointment.preferred_meeting_time)}</p>
                  <p className="mb-1 text-sm text-gray-600">Meeting Notes</p>
                  <p className="text-sm text-gray-900">{selectedAppointment.meeting_notes || "No notes"}</p>
                </div>
              </div>

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Deleting appointment..." size="sm" />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmation(false);
                    setSelectedAppointment(null);
                  }}
                  className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAppointment}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Compact, single-line stat card with responsive icon sizing
function StatCard({ icon, iconBg, title, value }: { icon: React.ReactNode; iconBg: string; title: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow sm:p-5">
      <div className="flex items-center justify-start gap-2 whitespace-nowrap md:justify-between md:gap-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className={`rounded-full p-2 md:p-3 ${iconBg}`}>{icon}</div>
          <p className="truncate text-sm font-medium text-gray-600">{title}</p>
        </div>
        <p className="shrink-0 text-xl font-semibold text-gray-900 md:ml-auto md:text-2xl">{value}</p>
      </div>
    </div>
  );
}
