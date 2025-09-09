"use client";

import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { DeleteLeadModal } from "@/components/Leads/DeleteLeadModal";
import { EditLeadModal } from "@/components/Leads/EditLeadModal";
import LeadGenerationForm from "@/components/Leads/LeadGenerationForm";
import { StatCard } from "@/components/Leads/StatCard";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  fetchLeadsForClinic,
  formatStatus,
  getCurrentUserClinic,
  getStatusColor,
  INTEREST_LEVELS,
  LEAD_STATUSES,
} from "@/utils/supabase/leads-helper";
import { Modal } from "antd";
import { Edit, MoreVertical, SearchIcon, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { leadsStatsConfig } from "./statsUtil";

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
  notes: string | null;
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

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleClose = (newLead?: any) => {
    setShowLeadForm(false);
    if (newLead) {
      const formattedLead = {
        id: newLead.id,
        first_name: newLead.first_name,
        last_name: newLead.last_name,
        name: newLead.first_name || "Unknown",
        email: newLead.email,
        phone: newLead.phone,
        status: newLead.status,
        interest_level: newLead.interest_level,
        urgency: newLead.urgency,
        notes: newLead.notes,
        created_at: newLead.created_at,
        updated_at: newLead.updated_at,
      };
      setLeadsData(prev => [formattedLead, ...prev]);
    }
  };

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentClinicId = await getCurrentUserClinic();
      setClinicId(currentClinicId);
      const leads = await fetchLeadsForClinic(currentClinicId);
      setLeadsData(leads);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const toggleActionMenu = (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    if (activeDropdown === leadId) {
      setActiveDropdown(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 120; // Approximate dropdown height
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = rect.bottom + 8;
      let left = rect.right - 192; // 192px is dropdown width (w-48)

      // Check if dropdown would go below viewport
      if (rect.bottom + dropdownHeight > viewportHeight) {
        // Position above the button instead
        top = rect.top - dropdownHeight - 8;
      }

      // Check if dropdown would go off-screen horizontally
      if (left < 8) {
        left = 8;
      } else if (left + 192 > viewportWidth - 8) {
        left = viewportWidth - 200;
      }

      setDropdownPosition({ top, left });
      setActiveDropdown(leadId);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setEditModalOpen(true);
    setActiveDropdown(null);
  };

  const handleDeleteLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDeleteModalOpen(true);
    setActiveDropdown(null);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeadsData(prev => prev.map(lead => (lead.id === updatedLead.id ? updatedLead : lead)));
  };

  const handleConfirmDelete = (leadId: string) => {
    setLeadsData(prev => prev.filter(lead => lead.id !== leadId));
  };

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

  const FiltersBar = () => (
    <div className="pt-4 px-4 pb-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4 md:pr-4">
          <div className="relative md:w-[320px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-10 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={selectedLeadStatus}
            onChange={e => setSelectedLeadStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[220px]"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 md:w-[220px]"
          >
            <option value="all">All Interest</option>
            {INTEREST_LEVELS.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowLeadForm(true)}
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-purple-700 md:h-10 md:w-auto"
        >
          Generate Lead
        </button>
      </div>
    </div>
  );

  const ErrorBlock = () => (
    <div className="flex h-64 flex-col items-center justify-center">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-red-800">Something went wrong</h3>
        <p className="mb-4 text-red-600">{error}</p>
        <button
          onClick={loadData}
          className="mx-auto flex items-center rounded-lg bg-red-600 px-6 py-2 text-white transition-colors duration-200 hover:bg-red-700"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );

  if (loading) {
    return (
      <DashboardLayout
        header={
          <Header title="Lead Management" description="Manage and track your leads through the conversion process." showHamburgerMenu />
        }
      >
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="rounded-lg bg-white/60 p-3">
            <LoadingSpinner message="Loading your leads..." size="lg" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        header={
          <Header title="Lead Management" description="Manage and track your leads through the conversion process." showHamburgerMenu />
        }
      >
        <ErrorBlock />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      header={
        <Header title="Lead Management" description="Manage and track your leads through the conversion process." showHamburgerMenu />
      }
    >
      <div>
        <div className="my-6 px-4 w-full">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full">
            {leadsStatsConfig.map(stat => (
              <StatCard key={stat.key} icon={stat.icon} iconBg={stat.iconBg} title={stat.title} value={stat.getValue(leadsData)} />
            ))}
          </div>
        </div>

        <FiltersBar />

        <div className="mx-4 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Lead</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Created</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {leadsData.length === 0 ? "No leads found in database" : "No leads match your filters"}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, index) => (
                    <tr
                      key={lead.id}
                      className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 hover:shadow-sm ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-100 to-blue-100 font-semibold text-purple-600 shadow-sm ring-2 ring-white">
                            {lead.name
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="ml-4 min-w-0">
                            <p className="truncate font-medium text-gray-900 group-hover:text-gray-800">{lead.name}</p>
                            <p className="truncate text-sm text-gray-500">{lead.email || "No email"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{lead.phone || "No phone"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${getStatusColor(lead.status)}`}
                        >
                          {formatStatus(lead.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={e => toggleActionMenu(e, lead.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors duration-200"
                            type="button"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {activeDropdown && (
          <div className="fixed inset-0 z-[9999]" onClick={() => setActiveDropdown(null)}>
            {filteredLeads.map(lead => {
              if (lead.id !== activeDropdown) return null;
              return (
                <div
                  key={lead.id}
                  ref={dropdownRef}
                  className="absolute w-48 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      onClick={() => handleEditLead(lead)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                      type="button"
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                      Edit Lead
                    </button>
                    <button
                      onClick={() => handleDeleteLead(lead)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      Delete Lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal open={showLeadForm} onCancel={() => setShowLeadForm(false)} footer={null} width={800}>
          {clinicId && <LeadGenerationForm clinicId={clinicId} onSuccess={handleClose} />}
        </Modal>

        <EditLeadModal
          lead={selectedLead}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedLead(null);
          }}
          onUpdate={handleUpdateLead}
        />

        <DeleteLeadModal
          lead={selectedLead}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedLead(null);
          }}
          onDelete={handleConfirmDelete}
        />
      </div>
    </DashboardLayout>
  );
}
