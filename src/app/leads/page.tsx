"use client";
import type React from "react";
import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { UserPlus, CheckCircle, Clock, Search } from "lucide-react";
import {Header} from "@/components/common"
// Import your helper functions
import {
  fetchLeadsForClinic,
  getCurrentUserClinic,
  formatStatus,
  getStatusColor,
  getInterestColor,
  getUrgencyColor,
  LEAD_STATUSES,
  INTEREST_LEVELS,
  URGENCY_LEVELS,
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
  urgency: string | null;
  created_at: string;
  updated_at: string;
}

export default function LeadsPage() {
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadStatus, setSelectedLeadStatus] = useState("all");
  const [selectedInterestLevel, setSelectedInterestLevel] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load leads data
  useEffect(() => {
    loadData();
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

  // Filter leads based on current filters
  const filteredLeads = leadsData.filter(lead => {
    if (selectedLeadStatus !== "all" && lead.status !== selectedLeadStatus) return false;
    if (selectedInterestLevel !== "all" && lead.interest_level !== selectedInterestLevel) return false;
    if (selectedUrgency !== "all" && lead.urgency !== selectedUrgency) return false;
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
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading leads...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-red-600 text-lg mb-4">Error: {error}</div>
          <button onClick={loadData} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={<Header title="Lead Management" description="Manage and track your leads through the conversion process." />}>
      <div>

        {/* Lead Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
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

          <div className="bg-white rounded-lg shadow p-6">
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

          <div className="bg-white rounded-lg shadow p-6">
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

          <div className="bg-white rounded-lg shadow p-6">
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

              <select
                value={selectedUrgency}
                onChange={e => setSelectedUrgency(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Urgency</option>
                {URGENCY_LEVELS.map(urgency => (
                  <option key={urgency} value={urgency}>
                    {urgency.replace("_", " ").charAt(0).toUpperCase() + urgency.replace("_", " ").slice(1)}
                  </option>
                ))}
              </select>
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Urgency</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-gray-500">
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
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                          {formatStatus(lead.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${getInterestColor(lead.interest_level || "")}`}>
                          {lead.interest_level ? lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1) : "Not set"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${getUrgencyColor(lead.urgency || "")}`}>
                          {lead.urgency
                            ? lead.urgency.replace("_", " ").charAt(0).toUpperCase() + lead.urgency.replace("_", " ").slice(1)
                            : "Not set"}
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
    </DashboardLayout>
  );
}
