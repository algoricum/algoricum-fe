"use client";
import { Header } from "@/components/common";
import ConversionFunnel from "@/components/common/charts/conversion-funnel";
import SimpleBarChart from "@/components/common/charts/simple-bar-chart";
import CsvUploadModal from "@/components/common/CSV/CsvUploadModal";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import ChatbotTrainingModal from "@/components/common/TrainingChatbotModal/chatbot-training-modal";
import DashboardLayout from "@/layouts/DashboardLayout";
import { handleCsvUpload } from "@/utils/csvUtils";
import { createClient } from "@/utils/supabase/config/client";
import Button from "antd/es/button";
import Select from "antd/es/select";
import { Bot, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLeads, useClinicData, useTwilioConfig } from "@/hooks/useDashboard";
import AiActivityLog from "./AiActivityLogs";
import StatsGrid from "./StatsGrid";
import TodayTasks from "./TodayTasks";

import { AppointmentFilter, LOADING_DELAY, IntegrationBannersProps } from "./types";

// Helper functions
const formatTwilioNumber = (phoneNumber: string | undefined): string => {
  return phoneNumber || "";
};

const formatMailgunEmail = (email: string | undefined): string => {
  return email || "Not configured";
};

export default function DashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  // Loading/UI state
  const [loading, setLoading] = useState(true);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("month");

  // Integrations state
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showCsvBanner] = useState(true);

  // Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // React Query hooks
  const { data: clinicData, isLoading: clinicLoading } = useClinicData();
  const clinicId = typeof clinicData === "string" ? clinicData : clinicData?.id || "";

  const { data: leadsData = [], isLoading: leadsLoading, refetch: refetchLeads } = useLeads(clinicId);
  const { data: twilioPhoneNumber = "", isLoading: twilioLoading } = useTwilioConfig(clinicId);

  // Calculate overall loading state
  const isDataLoading = clinicLoading || leadsLoading || twilioLoading;

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
        setTimeout(() => setLoading(false), LOADING_DELAY);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  if (loading || isDataLoading) {
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
        <IntegrationBanners
          showCsvBanner={showCsvBanner}
          onCsvUpload={() => setShowManualLeadsModal(true)}
          onTrainChatbot={() => setShowTrainingModal(true)}
          clinicData={clinicData}
          twilioPhoneNumber={twilioPhoneNumber}
        />

        {/* Stats Grid - Pass leadsData directly for real-time updates */}
        <div className="mt-8">
          <StatsGrid clinicId={clinicId} leadsData={leadsData} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mt-8">
          <div className="lg:col-span-2 bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Appointment Trends</h3>
              <Select
                value={appointmentFilter}
                onChange={value => setAppointmentFilter(value as typeof appointmentFilter)}
                className="w-auto min-w-[140px]"
                size="middle"
                style={{
                  borderRadius: "8px",
                }}
              >
                <Select.Option value="today">Today</Select.Option>
                <Select.Option value="week">This Week</Select.Option>
                <Select.Option value="month">This Month</Select.Option>
                <Select.Option value="year">This Year</Select.Option>
              </Select>
            </div>
            <div className="mt-4">
              <SimpleBarChart leadsData={leadsData} filter={appointmentFilter} />
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all  overflow-y-auto">
            <TodayTasks clinicId={clinicId} />
          </div>
        </div>

        {/* Conversion Funnel and AI Activity Log - Horizontal Layout */}
        {clinicId && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mt-8">
            {/* Left Side - Conversion Funnel */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">Booked Conversion Funnel</h3>
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
      <CsvUploadModal
        open={showManualLeadsModal}
        onOk={async leads => {
          try {
            await handleCsvUpload(leads, true); // The second parameter triggers the upload
            setShowManualLeadsModal(false); // Close modal after successful upload
            refetchLeads(); // Refresh the leads data using React Query
          } catch (error) {
            console.error("Upload failed:", error);
          }
        }}
        onCancel={() => setShowManualLeadsModal(false)}
      />
      <ChatbotTrainingModal open={showTrainingModal} onClose={() => setShowTrainingModal(false)} />
    </DashboardLayout>
  );
}

// Helper Components

function IntegrationBanners({ showCsvBanner, onCsvUpload, onTrainChatbot, clinicData, twilioPhoneNumber }: IntegrationBannersProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showCsvBanner && <CsvUploadBanner onUpload={onCsvUpload} />}
        <ChatbotTrainingBanner onTrain={onTrainChatbot} />
      </div>

      {/* Nurturing Email & SMS Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <NurturingEmailCard email={formatMailgunEmail(clinicData?.mailgun_email)} />
        <NurturingPhoneCard phoneNumber={formatTwilioNumber(twilioPhoneNumber)} />
      </div>
    </div>
  );
}

function CsvUploadBanner({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="w-full rounded-xl border-2 p-4 bg-blue-50 border-blue-200 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg p-3 bg-blue-100 border border-blue-200">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-900 block mb-1">Upload CSV Leads</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              Import your leads data from CSV files to get started quickly with your patient management.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button
            onClick={onUpload}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            aria-label="Open CSV upload modal"
          >
            Upload CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatbotTrainingBanner({ onTrain }: { onTrain: () => void }) {
  return (
    <div className="w-full rounded-xl border-2 p-4 bg-purple-50 border-purple-200 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg p-3 bg-purple-100 border border-purple-200">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-900 block mb-1">Train Your Chatbot Now</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              Upload training documents to enhance your ChatBot&apos;s knowledge and improve patient interactions.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button
            onClick={onTrain}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            aria-label="Open ChatBot training modal"
          >
            <Bot className="h-4 w-4 mr-2" />
            Train Now
          </Button>
        </div>
      </div>
    </div>
  );
}

function NurturingEmailCard({ email }: { email: string }) {
  return (
    <div className="w-full rounded-xl border-2 p-4 bg-green-50 border-green-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-lg p-3 bg-green-100 border border-green-200">
          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <span className="font-semibold text-gray-900 block mb-1">Nurturing Email</span>
          <div className="text-sm text-gray-600">
            <div>{email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NurturingPhoneCard({ phoneNumber }: { phoneNumber: string }) {
  return (
    <div className="w-full rounded-xl border-2 p-4 bg-orange-50 border-orange-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-lg p-3 bg-orange-100 border border-orange-200">
          <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-3.582 9 8z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <span className="font-semibold text-gray-900 block mb-1">Nurturing Phone Number</span>
          <div className="text-sm text-gray-600">
            <div>{phoneNumber}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
