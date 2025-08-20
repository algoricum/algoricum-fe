// Better approach: Direct state updates and proper data flow

"use client";

import type React from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleCsvUpload } from "@/utils/csvUtils";

import DashboardLayout from "@/layouts/DashboardLayout";
import SimpleBarChart from "@/components/common/charts/simple-bar-chart";
import ConversionFunnel from "@/components/common/charts/conversion-funnel";
import LeadSourcesLineChart from "@/components/common/charts/lead-sources-line-chart";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import StatsGrid from "./StatsGrid";
import TodayTasks from "./TodayTasks";
import { SuccessToast } from "@/helpers/toast";
import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys";

import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";

import { X, CheckCircle, Upload } from "lucide-react";
import CsvUploadModal from "@/components/common/CSV/CsvUploadModal";
import AiActivityLog from "./AiActivityLogs";

type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  date: string;
  source_id: string | null;
  sourceName: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Loading/UI state
  const [loading, setLoading] = useState(true);
  const [appointmentFilter, setAppointmentFilter] = useState<"today" | "week" | "month" | "year">("month");

  // Integrations state
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [pipedriveActive, setPipedriveActive] = useState(true);
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);

  const [showPipedriveBanner, setShowPipedriveBanner] = useState(false);
  const [showHubspotBanner, setShowHubspotBanner] = useState(false);
  const [showCsvBanner] = useState(true);

  // Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Data
  const [leadsData, setLeadsData] = useState<LeadRow[]>([]);
  const [clinicId, setClinicId] = useState<string>("");

  // Fetch clinic info
  useEffect(() => {
    const fetchClinicId = async () => {
      try {
        const data = await getClinicData();
        if (data?.id) setClinicId(data.id);
        if (data?.uses_hubspot) setShowHubspotBanner(true);
        if (data?.use_pipedrive) setShowPipedriveBanner(true);
      } catch (e) {
        console.error("Error fetching clinic data:", e);
      }
    };
    fetchClinicId();
  }, []);

  // Centralized function to fetch leads data
  const fetchLeads = useCallback(async () => {
    if (!clinicId) return;

    try {
      const { data, error } = await supabase
        .from("lead")
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          created_at,
          source_id:source_id(id),
          source:source_id(name)
        `,
        )
        .eq("clinic_id", clinicId);

      if (error) {
        console.error("Leads fetch error:", error);
        return;
      }

      const formatted: LeadRow[] =
        data?.map((lead: any) => ({
          id: lead.id,
          name: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim(),
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          date: lead.created_at,
          source_id: lead.source_id ?? "Unknown",
          sourceName: lead.source ?? "Unknown",
        })) ?? [];

      setLeadsData(formatted);
    } catch (e) {
      console.error("Unexpected error fetching leads:", e);
    }
  }, [clinicId, supabase]);

  // Fetch leads when clinic ID is available
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Gate unauthenticated or first-time staff to reset-password
  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          console.error("User fetch error:", error);
          return;
        }
        const loggedFirst = user.user_metadata?.logged_first;
        const isStaff = user.user_metadata?.is_staff;
        if (loggedFirst === true && isStaff) {
          router.push("/reset-password");
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        // simulate small delay for dashboard data readiness
        setTimeout(() => setLoading(false), 800);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  // Handle CSV upload completion - refetch data after successful upload
  const handleCsvUploadComplete = async (leads: any) => {
    try {
      setShowManualLeadsModal(false);

      // Process the CSV upload
      await handleCsvUpload(leads, true);

      if (localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) && leads) {
        SuccessToast("Leads uploaded successfully");
      }

      // Refetch leads data to get the updated information
      await fetchLeads();
    } catch (error) {
      console.error("Error handling CSV upload:", error);
    }
  };

  // Filtered leads for charts
  const filteredLeadsForChart = useMemo(
    () => leadsData.filter(lead => ["booked", "converted"].includes((lead.status ?? "").toLowerCase())),
    [leadsData],
  );

  if (loading) {
    return (
      <DashboardLayout
        header={
          <Header
            title="Dashboard Overview"
            description="Welcome back! Here's what's happening with your clinic today."
            showHamburgerMenu
          />
        }
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner message="Loading your dashboard..." size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      header={
        <Header title="Dashboard Overview" description="Welcome back! Here's what's happening with your clinic today." showHamburgerMenu />
      }
    >
      <div className="space-y-8 p-4 sm:p-6">
        {/* Integration Banners */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* HubSpot */}
          {showHubspotBanner && (
            <div className={`rounded-lg border p-4 ${hubspotConnected ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center font-semibold text-gray-900">
                    <span>HubSpot Integration</span>
                    {hubspotConnected && <CheckCircle className="ml-2 h-4 w-4 text-green-600" />}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {hubspotConnected
                      ? "HubSpot is connected and syncing data successfully."
                      : "Connect your HubSpot account to sync leads and contacts automatically."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:self-center md:shrink-0">
                  {!hubspotConnected && (
                    <button onClick={() => setHubspotConnected(true)} className="btn btn-primary btn-sm w-full md:w-auto">
                      Connect HubSpot
                    </button>
                  )}
                  <button
                    onClick={() => setShowHubspotBanner(false)}
                    className="inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 md:w-auto"
                    aria-label="Dismiss HubSpot banner"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pipedrive */}
          {showPipedriveBanner && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center font-semibold text-gray-900">
                    <span>Pipedrive Integration</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {pipedriveActive
                      ? "Pipedrive integration is active and working properly."
                      : "Pipedrive integration is currently inactive."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:self-center md:shrink-0">
                  <button
                    onClick={() => setPipedriveActive(p => !p)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      pipedriveActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                    aria-pressed={pipedriveActive}
                    aria-label="Toggle Pipedrive"
                    type="button"
                  >
                    <span
                      className={`inline-block h-6 w-6 translate-x-1 rounded-full bg-white transition-transform ${
                        pipedriveActive ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => setShowPipedriveBanner(false)}
                    className="inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 md:w-auto"
                    aria-label="Dismiss Pipedrive banner"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload – responsive banner */}
          {showCsvBanner && (
            <div className="rounded-lg border p-4 bg-purple-50 border-purple-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                {/* Left: icon + title + desc */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md p-1.5 bg-purple-100">
                    <Upload className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center font-semibold text-gray-900">
                      <span>CSV Upload</span>
                    </div>
                  </div>
                </div>

                {/* Right: actions – stacked on mobile, inline on md+ */}
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:self-center md:shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowManualLeadsModal(true)}
                    className="btn btn-secondary btn-sm w-full md:w-auto"
                    aria-label="View CSV upload guide"
                  >
                    Upload Now
                  </button>

                  <label className="btn btn-primary btn-sm w-full cursor-pointer md:w-auto"></label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid - Pass leadsData directly for real-time updates */}
        <StatsGrid clinicId={clinicId} leadsData={leadsData} />

        {/* Charts Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Appointment Trends</h3>
              <select
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm"
                value={appointmentFilter}
                onChange={e => setAppointmentFilter(e.target.value as typeof appointmentFilter)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <SimpleBarChart appointmentsData={filteredLeadsForChart} filter={appointmentFilter} />
          </div>

          <TodayTasks clinicId={clinicId} />
        </div>

        {/* Lead Sources and Conversion */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-6 text-lg font-semibold">Conversion Funnel</h3>
            <ConversionFunnel leadsData={leadsData} />
          </div>
          <div className="card">
            <h3 className="mb-6 text-lg font-semibold">Lead Sources Trends</h3>
            <LeadSourcesLineChart leadsData={leadsData} />
          </div>
        </div>

        {/* AI Activity Log */}
        <AiActivityLog clinicId={clinicId} />
      </div>

      {/* Add Task Modal (kept for parity; closed by default) */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Task</h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close add task modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {/* Your form implementation can go here */}
            <p className="text-sm text-gray-600">Add Task form placeholder…</p>
          </div>
        </div>
      )}

      <CsvUploadModal open={showManualLeadsModal} onOk={handleCsvUploadComplete} onCancel={() => setShowManualLeadsModal(false)} />
    </DashboardLayout>
  );
}
