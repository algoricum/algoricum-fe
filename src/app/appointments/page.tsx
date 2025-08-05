"use client";
import type React from "react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Calendar,
  CheckCircle,
  Clock,
  X,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  User,
  Mail,
  Link,
  ExternalLink,
  Copy,
  Check,
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
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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
      let fullDateTime = null;
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

  // Show loading spinner while data is being fetched
  if (isLoading) {
    return (
      <DashboardLayout header={<Header title="Appointments" description="Manage patient appointments and scheduling." />}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner message="Loading appointments..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={<Header title="Appointments" description="Manage patient appointments and scheduling." />}>
      <div>
        {/* Message Display */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{message.text}</p>
              <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Appointment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Confirmed</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.filter(apt => apt.status === "confirmed").length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">{appointmentsData.filter(apt => apt.status === "pending").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, email, or notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-80"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
              {/* Filter Status Indicator */}
              {(searchQuery || statusFilter !== "all") && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {filteredAppointments.length} of {appointmentsData.length} appointments
                  </span>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleAddAppointment}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Appointment
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Patient</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Time</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Meeting Link</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Meeting Notes</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-gray-500">
                    {appointmentsData.length === 0 ? (
                      <div className="flex flex-col items-center">
                        <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-lg font-medium text-gray-600 mb-2">No appointments yet</p>
                        <p className="text-sm text-gray-500">Create your first appointment to get started</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Search className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-lg font-medium text-gray-600 mb-2">No appointments match your filters</p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                          }}
                          className="text-purple-600 hover:text-purple-800 underline text-sm"
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
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
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
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-900">{appointment.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-gray-900">{date}</p>
                          <p className="text-sm text-gray-500">{time}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {appointment.meeting_link ? (
                          <div className="flex items-center space-x-2">
                            <a
                              href={appointment.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <Link className="w-4 h-4 mr-1" />
                              <span className="text-sm">Join Meeting</span>
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                            <button
                              onClick={() => copyToClipboard(appointment.meeting_link!, appointment.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Copy link"
                            >
                              {copiedLink === appointment.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No link</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-xs">
                          <p className="text-sm text-gray-900 truncate" title={appointment.meeting_notes || ""}>
                            {appointment.meeting_notes || "No notes"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            appointment.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {appointment.status === "confirmed" ? "CONFIRMED" : "PENDING"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative dropdown-container">
                          <button
                            onClick={e => toggleDropdown(e, appointment.id)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            type="button"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>

                          {/* Dropdown Menu */}
                          {activeDropdown === appointment.id && (
                            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openEditModal(appointment);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 rounded-t-lg"
                                type="button"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Status
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openDeleteConfirmation(appointment);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 rounded-b-lg"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
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

        {/* Add Appointment Modal - Schedule Meeting Form */}
        {showAddAppointmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
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
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 mb-6">Fill out the form below to schedule your meeting with us</p>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="flex items-start">
                            <span className="w-1 h-1 bg-red-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
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
                {/* Name and Email Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4" />
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={newMeeting.username}
                      onChange={e => setNewMeeting({ ...newMeeting, username: e.target.value })}
                      placeholder="Enter your name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4" />
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={100}
                      value={newMeeting.email}
                      onChange={e => setNewMeeting({ ...newMeeting, email: e.target.value })}
                      placeholder="Enter your email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Date and Time Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4" />
                      Preferred Meeting Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={getTodayDate()}
                      value={newMeeting.preferred_meeting_date}
                      onChange={e => setNewMeeting({ ...newMeeting, preferred_meeting_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4" />
                      Preferred Meeting Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={newMeeting.preferred_meeting_time}
                      onChange={e => setNewMeeting({ ...newMeeting, preferred_meeting_time: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Meeting Link */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Link className="w-4 h-4" />
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={newMeeting.meeting_link}
                    onChange={e => setNewMeeting({ ...newMeeting, meeting_link: e.target.value })}
                    placeholder="https://meet.google.com/... or https://zoom.us/..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Add a video meeting link (Google Meet, Zoom, etc.)</p>
                </div>

                {/* Meeting Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Notes</label>
                  <textarea
                    rows={4}
                    value={newMeeting.meeting_notes}
                    onChange={e => setNewMeeting({ ...newMeeting, meeting_notes: e.target.value })}
                    placeholder="Add any additional notes or topics you'd like to discuss..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    disabled={isSubmitting}
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">{newMeeting.meeting_notes.length} characters</div>
                </div>

                {/* Submit Button */}
                <div className="flex space-x-3 pt-4">
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
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Appointment Status</h3>
                <button
                  onClick={() => {
                    setShowEditStatusModal(false);
                    setSelectedAppointment(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Patient</p>
                <p className="font-medium text-gray-900">{selectedAppointment.username}</p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Email</p>
                <p className="text-gray-900">{selectedAppointment.email}</p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Date & Time</p>
                <p className="text-gray-900">{formatMeetingDate(selectedAppointment.preferred_meeting_time)}</p>
                <p className="text-sm text-gray-600 mt-2 mb-1">Meeting Notes</p>
                <p className="text-gray-900 text-sm">{selectedAppointment.meeting_notes || "No notes"}</p>
              </div>

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Updating status..." size="sm" />
                </div>
              )}

              <form onSubmit={handleEditStatus} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={selectedAppointment.status}
                    onChange={e =>
                      setSelectedAppointment({
                        ...selectedAppointment,
                        status: e.target.value as MeetingStatus,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditStatusModal(false);
                      setSelectedAppointment(null);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Appointment</h3>
                <p className="text-gray-600 mb-4">Are you sure you want to delete this appointment? This action cannot be undone.</p>

                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <p className="text-sm text-gray-600 mb-1">Patient</p>
                  <p className="font-medium text-gray-900 mb-2">{selectedAppointment.username}</p>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <p className="text-gray-900 mb-2">{selectedAppointment.email}</p>
                  <p className="text-sm text-gray-600 mb-1">Date & Time</p>
                  <p className="text-gray-900 mb-2">{formatMeetingDate(selectedAppointment.preferred_meeting_time)}</p>
                  <p className="text-sm text-gray-600 mb-1">Meeting Notes</p>
                  <p className="text-gray-900 text-sm">{selectedAppointment.meeting_notes || "No notes"}</p>
                </div>
              </div>

              {isSubmitting && (
                <div className="mb-4">
                  <LoadingSpinner message="Deleting appointment..." size="sm" />
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmation(false);
                    setSelectedAppointment(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAppointment}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
