"use client";
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { UserPlus, CheckCircle, Clock, Search, ChevronDown } from "lucide-react";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { LeadsTableSkeleton, StatsCardsSkeleton } from "@/components/common/Loaders/skeleton-loader";
import { Modal } from "antd";
import LeadGenerationForm from "@/components/Leads/LeadGenerationForm"; // adjust path if needed
// Import your helper functions
import {
  fetchLeadsForClinic,
  getCurrentUserClinic,
  updateLeadStatus,
  formatStatus,
  getStatusColor,
  getInterestColor,
  LEAD_STATUSES,
  INTEREST_LEVELS,
} from "@/utils/supabase/leads-helper";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  interest_level: string | null;
  created_at: string;
  updated_at: string;
}

export default function LeadsPage() {
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadStatus, setSelectedLeadStatus] = useState("all");
  const [selectedInterestLevel, setSelectedInterestLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);

  // State for dropdown status updates
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load leads data
  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's clinic
      const currentClinicId = await getCurrentUserClinic();

      // Fetch leads for this clinic
      const leads = await fetchLeadsForClinic(currentClinicId);
      setLeadsData(leads);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    if (updatingStatus === leadId) return;

    try {
      setUpdatingStatus(leadId);
      setOpenDropdownId(null);

      // Update status in database
      await updateLeadStatus(leadId, { status: newStatus });

      // Update local state
      setLeadsData(prevLeads =>
        prevLeads.map(lead => (lead.id === leadId ? { ...lead, status: newStatus, updated_at: new Date().toISOString() } : lead)),
      );
    } catch (err) {
      console.error("Error updating status:", err);
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Toggle dropdown
  const toggleDropdown = (leadId: string) => {
    setOpenDropdownId(openDropdownId === leadId ? null : leadId);
  };

  // Filter leads based on current filters
  const filteredLeads = leadsData.filter(lead => {
    if (selectedLeadStatus !== "all" && lead.status !== selectedLeadStatus) return false;
    if (selectedInterestLevel !== "all" && lead.interest_level !== selectedInterestLevel) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        lead.name.toLowerCase().includes(query) ||
        (lead.email && lead.email.toLowerCase().includes(query)) ||
        (lead.phone && lead.phone.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Calculate stats from real data
  const totalLeads = leadsData.length;
  const bookedLeads = leadsData.filter(lead => lead.status.toLowerCase() === "booked").length;
  const newLeads = leadsData.filter(lead => lead.status.toLowerCase() === "new").length;
  const convertedLeads = leadsData.filter(lead => lead.status.toLowerCase() === "converted").length;

  if (loading) {
    return (
      <DashboardLayout
        header={<Header title="Lead Management" description="Manage and track your leads through the conversion process." />}
      >
        <div>
          <StatsCardsSkeleton />
          <LeadsTableSkeleton />

          {/* Centered loading spinner overlay */}
          <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <LoadingSpinner message="Loading your leads..." size="lg" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        header={<Header title="Lead Management" description="Manage and track your leads through the conversion process." />}
      >
        <div className="flex flex-col items-center justify-center h-64">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center mx-auto"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={<Header title="Lead Management" description="Manage and track your leads through the conversion process." />}>
      <div>
        {/* Lead Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-2xl font-semibold text-gray-900">{totalLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Booked</p>
                <p className="text-2xl font-semibold text-gray-900">{bookedLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">New</p>
                <p className="text-2xl font-semibold text-gray-900">{newLeads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Converted</p>
                <p className="text-2xl font-semibold text-gray-900">{convertedLeads}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <select
                value={selectedLeadStatus}
                onChange={e => setSelectedLeadStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                {LEAD_STATUSES.map(status => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <select
                value={selectedInterestLevel}
                onChange={e => setSelectedInterestLevel(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Interest</option>
                {INTEREST_LEVELS.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  const currentClinicId = await getCurrentUserClinic();
                  setClinicId(currentClinicId);
                  setShowLeadForm(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Generate Lead
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Interest</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-gray-500">
                      {leadsData.length === 0 ? "No leads found in database" : "No leads match your filters"}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                            {lead.name
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <p className="font-medium text-gray-900">{lead.name}</p>
                            <p className="text-sm text-gray-500">{lead.email || "No email"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-gray-900">{lead.phone || "No phone"}</td>

                      <td className="py-3 px-4">
                        <div className="relative" ref={openDropdownId === lead.id ? dropdownRef : null}>
                          <button
                            onClick={() => toggleDropdown(lead.id)}
                            disabled={updatingStatus === lead.id}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-all duration-200 disabled:opacity-50 ${getStatusColor(lead.status)}`}
                          >
                            {updatingStatus === lead.id ? (
                              <span className="flex items-center">
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                                Updating...
                              </span>
                            ) : (
                              <>
                                {formatStatus(lead.status)}
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </button>

                          {/* Status Dropdown */}
                          {openDropdownId === lead.id && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              <div className="py-1">
                                {LEAD_STATUSES.map(status => (
                                  <button
                                    key={status}
                                    onClick={() => handleUpdateStatus(lead.id, status)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                                      lead.status === status ? "bg-purple-50 text-purple-700 font-medium" : "text-gray-700"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                        getStatusColor(status).includes("bg-green")
                                          ? "bg-green-500"
                                          : getStatusColor(status).includes("bg-yellow")
                                            ? "bg-yellow-500"
                                            : getStatusColor(status).includes("bg-blue")
                                              ? "bg-blue-500"
                                              : getStatusColor(status).includes("bg-purple")
                                                ? "bg-purple-500"
                                                : getStatusColor(status).includes("bg-red")
                                                  ? "bg-red-500"
                                                  : "bg-gray-500"
                                      }`}
                                    ></span>
                                    {formatStatus(status)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-medium ${getInterestColor(lead.interest_level || "")}`}>
                          {lead.interest_level ? lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1) : "Not set"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-gray-900">{new Date(lead.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showLeadForm} onCancel={() => setShowLeadForm(false)} footer={null} title="Generate New Lead" width={600}>
        {clinicId && <LeadGenerationForm clinicId={clinicId} />}
      </Modal>
    </DashboardLayout>
  );
}
