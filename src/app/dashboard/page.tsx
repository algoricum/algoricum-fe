"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
// import { handleCsvUpload } from "@/utils/csvUtils"
import { Button } from "antd";

import DashboardLayout from "@/layouts/DashboardLayout";
import SimpleBarChart from "@/components/common/charts/simple-bar-chart";
import ConversionFunnel from "@/components/common/charts/conversion-funnel";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import StatsGrid from "./StatsGrid";
import TodayTasks from "./TodayTasks";
// import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys"

import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";

import { X, CheckCircle, Bot } from "lucide-react";
// import CsvUploadModal from "@/components/common/CSV/CsvUploadModal";
import AiActivityLog from "./AiActivityLogs";
import ChatbotTrainingModal from "@/components/common/TrainingChatbotModal/chatbot-training-modal";

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
  // const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);

  const [showPipedriveBanner, setShowPipedriveBanner] = useState(false);
  const [showHubspotBanner, setShowHubspotBanner] = useState(false);
  // const [showCsvBanner] = useState(true)

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
      <div className="space-y-8 p-0 sm:p-4">
        {/* Integration Banners */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* HubSpot */}
          {showHubspotBanner && (
            <div
              className={`rounded-xl border-2 p-6 shadow-sm transition-all hover:shadow-md ${hubspotConnected ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center font-semibold text-gray-900 mb-2">
                    <span>HubSpot Integration</span>
                    {hubspotConnected && <CheckCircle className="ml-2 h-4 w-4 text-green-600" />}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {hubspotConnected
                      ? "HubSpot is connected and syncing data successfully."
                      : "Connect your HubSpot account to sync leads and contacts automatically."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-3 md:self-center md:shrink-0">
                  {!hubspotConnected && (
                    <button
                      onClick={() => setHubspotConnected(true)}
                      className="btn btn-primary btn-sm w-full md:w-auto px-4 py-2 rounded-lg"
                    >
                      Connect HubSpot
                    </button>
                  )}
                  <button
                    onClick={() => setShowHubspotBanner(false)}
                    className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors md:w-auto"
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
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center font-semibold text-gray-900 mb-2">
                    <span>Pipedrive Integration</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {pipedriveActive
                      ? "Pipedrive integration is active and working properly."
                      : "Pipedrive integration is currently inactive."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-3 md:self-center md:shrink-0">
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
                    className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors md:w-auto"
                    aria-label="Dismiss Pipedrive banner"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ChatBot Training Banner */}
          <div className="max-w-[800px]  rounded-xl border-2 p-6 bg-purple-50 border-purple-200 shadow-sm transition-all hover:shadow-md md:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {/* Left: icon + title + desc */}
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg p-3 bg-purple-100 border border-purple-200">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center font-semibold text-gray-900 mb-2">
                    <span>Train Your ChatBot Now</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Upload training documents to enhance your ChatBot&apos;s knowledge and improve patient interactions.
                  </p>
                </div>
              </div>

              {/* Right: actions – stacked on mobile, inline on md+ */}
              <div className="grid grid-cols-1 gap-3 md:flex md:items-center md:gap-3 md:self-center md:shrink-0">
                <Button
                  type="primary"
                  onClick={() => setShowTrainingModal(true)}
                  icon={<Bot className="h-4 w-4" />}
                  className="w-full md:w-auto"
                  style={{
                    backgroundColor: "#9D5EE3",
                    borderColor: "#9D5EE3",
                    height: "44px",
                    paddingLeft: "24px",
                    paddingRight: "24px",
                    fontWeight: "900",
                    borderRadius: "8px",

                  }}
                  aria-label="Open ChatBot training modal"
                >
                  Train Now
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid - Pass leadsData directly for real-time updates */}
        <div className="mt-8">
          <StatsGrid clinicId={clinicId} leadsData={leadsData} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mt-8">
          <div className="lg:col-span-2 bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Appointment Trends</h3>
              <select
                className="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                value={appointmentFilter}
                onChange={e => setAppointmentFilter(e.target.value as typeof appointmentFilter)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="mt-4">
              <SimpleBarChart appointmentsData={filteredLeadsForChart} filter={appointmentFilter} />
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
            <TodayTasks clinicId={clinicId} />
          </div>
        </div>

        {/* Conversion Funnel and AI Activity Log - Horizontal Layout */}
        {clinicId && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mt-8">
            {/* Left Side - Conversion Funnel */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">Conversion Funnel</h3>
              <div className="mt-4">
                <ConversionFunnel clinicId={clinicId} />
              </div>
            </div>

            {/* Right Side - AI Activity Log */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
              <AiActivityLog clinicId={clinicId} />
            </div>
          </div>
        )}
      </div>

      {/* Add Task Modal (kept for parity; closed by default) */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white border-2 border-gray-200 shadow-xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add New Task</h3>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close add task modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Your form implementation can go here */}
              <p className="text-sm text-gray-600">Add Task form placeholder…</p>
            </div>
          </div>
        </div>
      )}

      {/* <CsvUploadModal
        open={showManualLeadsModal}
        onOk={handleCsvUploadComplete}
        onCancel={() => setShowManualLeadsModal(false)}
      /> */}

      <ChatbotTrainingModal open={showTrainingModal} onClose={() => setShowTrainingModal(false)} />
    </DashboardLayout>
  );
}
