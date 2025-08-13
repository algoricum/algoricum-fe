"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Radio, Select, Card, Space, Typography, Modal, Alert, Spin, Form, TreeSelect } from "antd";
import { CheckCircleOutlined, LinkOutlined, ThunderboltOutlined, CalendarOutlined } from "@ant-design/icons";
import { getUserData } from "@/utils/supabase/user-helper";
import { createClient } from "@/utils/supabase/config/client";
import { SuccessToast, ErrorToast, InfoToast, WarningToast } from "@/helpers/toast";
import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import CsvUploadModal from "@/components/common/CSV/CsvUploadModal";
import Papa from "papaparse";
// import {handleCsvUpload} from "@/utils/csvUtils";

const { Title, Text } = Typography;

interface IntegrationsStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
  isSubmitting?: boolean;
}

export default function IntegrationsStep({ onNext, onPrev, initialData = {}, isSubmitting = false }: IntegrationsStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [showPipedriveModal, setShowPipedriveModal] = useState(false);
  const [showGoogleFormModal, setShowGoogleFormModal] = useState(false);
  const [showGoogleLeadFormModal, setShowGoogleLeadFormModal] = useState(false);
  const [showFacebookLeadFormModal, setShowFacebookLeadFormModal] = useState(false);
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [googleFormStatus, setGoogleFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [googleLeadFormStatus, setGoogleLeadFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [facebookLeadFormStatus, setFacebookLeadFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [pipedriveStatus, setPipedriveStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hubspotAccountInfo, setHubspotAccountInfo] = useState<any>(null);
  const [googleFormAccountInfo, setGoogleFormAccountInfo] = useState<any>(null);
  const [googleLeadFormAccountInfo, setGoogleLeadFormAccountInfo] = useState<any>(null);
  const [facebookLeadFormAccountInfo, setFacebookLeadFormAccountInfo] = useState<any>(null);
  const [pipedriveAccountInfo, setPipedriveAccountInfo] = useState<any>(null);
  const [pipedriveForm] = Form.useForm();
  const [autoProgressing, setAutoProgressing] = useState(false);
  const [showCustomCrmModal, setShowCustomCrmModal] = useState(false);
  const [googleFormTreeData, setGoogleFormTreeData] = useState([]);
  const [selectedGoogleFormWorksheets, setSelectedGoogleFormWorksheets] = useState([]);
  const [googleFormLeadsSynced, setGoogleFormLeadsSynced] = useState(false);

  const [formData, setFormData] = useState({
    selectedCrm: initialData.selectedCrm || "",
    adsConnections: initialData.adsConnections || "",
    leadCaptureForms: initialData.leadCaptureForms || "",
    uploadLeads: initialData.uploadLeads || "",
  });
  const supabase = createClient();
  const [showCompletionButtons, setShowCompletionButtons] = useState(false);

  const getClinicId = async () => {
    const clinic = await getClinicData();
    return clinic?.id || null;
  };

  const handleClick = async () => {
    console.log("Starting Google OAuth flow...", await getClinicId());
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-leads/start-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: await getClinicId() }),
      });

      if (!res.ok) throw new Error("Failed to start Google auth");

      const data = await res.json();
      if (!data.auth_url) throw new Error("No auth URL returned");

      window.location.href = data.auth_url;
    } catch (err) {
      console.error("Error starting Google auth:", err);
      ErrorToast("Failed to start Google OAuth flow");
    }
  };

  const handleFacebookClick = async () => {
    localStorage.setItem("oauth_form_data", JSON.stringify(formData));
    window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${await getClinicId()}`;
  };

  const questions = [
    {
      id: "selectedCrm",
      type: "select",
      question: "Do you use a CRM to manage your leads?",
      options: ["HubSpot", "Pipedrive", "None of these"],
    },
    {
      id: "adsConnections",
      type: "select",
      question: "Are you running ads that generate leads?",
      options: ["Facebook Lead Ads", "Google Ads Lead Forms", "None of these"],
    },
    {
      id: "leadCaptureForms",
      type: "select",
      question: "Do you collect leads through lead capture forms?",
      options: ["Google Forms", "None of these"],
    },
    {
      id: "uploadLeads",
      type: "radio",
      question: "Do you want to upload your existing leads via CSV?",
      options: ["Yes", "No"],
    },
  ];

  const filteredQuestions =
    formData.selectedCrm === "Hubspot" || formData.selectedCrm === "Pipedrive" ? [questions[0], questions[3]] : questions;

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const currentValue = formData[currentQuestion?.id as keyof typeof formData];

  useEffect(() => {
    return () => {
      const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
      const savedPipedriveStatus = localStorage.getItem("pipedrive_oauth_status");
      const savedGoogleFormStatus = localStorage.getItem("google_form_oauth_status");
      const savedGoogleLeadFormStatus = localStorage.getItem("google_lead_form_oauth_status");
      const savedFacebookLeadFormStatus = localStorage.getItem("facebook_lead_form_oauth_status");
      if (
        savedHubspotStatus !== "connecting" &&
        savedPipedriveStatus !== "connecting" &&
        savedGoogleFormStatus !== "connecting" &&
        savedGoogleLeadFormStatus !== "connecting" &&
        savedFacebookLeadFormStatus !== "connecting"
      ) {
        // Preserve oauth_form_data for "No CRM" case
      }
    };
  }, []);

  useEffect(() => {
    if (googleFormStatus === "connected") {
      fetchGoogleFormSheets();
    }
  }, [googleFormStatus]);

  const fetchGoogleFormSheets = async () => {
    try {
      const clinicId = await getClinicId();
      const { data: connection } = await supabase
        .from("google_form_connections")
        .select("id")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      console.log("Connection data:", connection);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/list-spreadsheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          clinic_id: clinicId,
          connection_id: connection?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Google Sheets");
      }

      const data = await response.json();
      setGoogleFormTreeData(
        (data.spreadsheets || []).map((spreadsheet: any) => ({
          title: spreadsheet.spreadsheet_title,
          value: spreadsheet.spreadsheet_id,
          selectable: false,
          children: (spreadsheet.sheets || []).map((sheet: any) => ({
            title: sheet.sheet_title,
            value: `${spreadsheet.spreadsheet_id}:${sheet.sheet_id}`,
            isLeaf: true,
          })),
        })),
      );
    } catch (error) {
      ErrorToast("Failed to fetch Google Sheets");
      console.error(error);
    }
  };
  const handleCsvUpload = async (leadsData: any) => {
    try {
      if (!leadsData) {
        WarningToast("No CSV file selected");
        return;
      }

      const user = await getUserData();
      if (!user) {
        throw new Error("User not found. Please log in again.");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `leads-${user.id}-${timestamp}.csv`;
      const filePath = `${user.id}/${fileName}`;

      let csvData;
      if (Array.isArray(leadsData)) {
        csvData = Papa.unparse(leadsData);
      } else {
        csvData = leadsData;
      }

      const { error } = await supabase.storage.from("lead-uploads").upload(filePath, csvData, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload CSV: ${error.message}`);
      }

      localStorage.setItem(ONBOARDING_LEADS_FILE_NAME, filePath);
      SuccessToast("CSV file uploaded successfully");
    } catch (error) {
      console.error("Error uploading CSV:", error);
      ErrorToast("Failed to upload CSV file");
    }
  };

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const autoProgressToNext = useCallback(() => {
    if (autoProgressing) return;
    setAutoProgressing(true);
    setTimeout(() => {
      if (currentQuestionIndex < filteredQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setShowHubspotModal(false);
        setShowPipedriveModal(false);
        setShowGoogleFormModal(false);
        setShowGoogleLeadFormModal(false);
        setShowFacebookLeadFormModal(false);
      } else {
        const finalData = {
          ...formData,
          hubspotConnected: hubspotStatus === "connected",
          pipedriveConnected: pipedriveStatus === "connected",
          googleFormConnected: googleFormStatus === "connected",
          googleLeadFormConnected: googleLeadFormStatus === "connected",
          facebookLeadFormConnected: facebookLeadFormStatus === "connected",
          hubspotAccountInfo,
          pipedriveAccountInfo,
          googleFormAccountInfo,
          googleLeadFormAccountInfo,
          facebookLeadFormAccountInfo,
          csvUploaded: localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) !== null,
        };
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
        onNext(finalData);
      }
      setAutoProgressing(false);
    }, 1500);
  }, [
    autoProgressing,
    currentQuestionIndex,
    filteredQuestions.length,
    formData,
    hubspotStatus,
    pipedriveStatus,
    googleFormStatus,
    googleLeadFormStatus,
    facebookLeadFormStatus,
    hubspotAccountInfo,
    pipedriveAccountInfo,
    googleFormAccountInfo,
    googleLeadFormAccountInfo,
    facebookLeadFormAccountInfo,
    onNext,
  ]);
  const syncPipedriveLeads = async () => {
    const clinicId = await getClinicId();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No valid session found. Please log in again.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive/sync-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clinic_id: clinicId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync leads");
      }

      const result = await response.json();
      console.log("✅ Leads synced:", result);

      if (result.synced_count > 0) {
        SuccessToast(`Successfully synced ${result.synced_count} leads from Pipedrive!`);
      } else {
        InfoToast("No new leads to sync from Pipedrive");
      }
    } catch (error) {
      console.error("Lead sync failed:", error);
      WarningToast("Failed to sync leads from Pipedrive");
    }
  };
  useEffect(() => {
    const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
    const savedPipedriveStatus = localStorage.getItem("pipedrive_oauth_status");
    const savedGoogleFormStatus = localStorage.getItem("google_form_oauth_status");
    const savedGoogleLeadFormStatus = localStorage.getItem("google_lead_form_oauth_status");
    const savedFacebookLeadFormStatus = localStorage.getItem("facebook_lead_form_oauth_status");
    const savedQuestionIndex = localStorage.getItem("oauth_question_index");
    const savedFormData = localStorage.getItem("oauth_form_data");
    const savedHubspotAccountInfo = localStorage.getItem("hubspot_oauth_account_info");
    const savedPipedriveAccountInfo = localStorage.getItem("pipedrive_oauth_account_info");
    const savedGoogleFormAccountInfo = localStorage.getItem("google_form_oauth_account_info");
    const savedGoogleLeadFormAccountInfo = localStorage.getItem("google_lead_form_oauth_account_info");
    const savedFacebookLeadFormAccountInfo = localStorage.getItem("facebook_lead_form_oauth_account_info");

    if (savedHubspotStatus) {
      setHubspotStatus(savedHubspotStatus as "disconnected" | "connecting" | "connected");
    }
    if (savedPipedriveStatus) {
      setPipedriveStatus(savedPipedriveStatus as "disconnected" | "connecting" | "connected");
    }
    if (savedGoogleFormStatus) {
      setGoogleFormStatus(savedGoogleFormStatus as "disconnected" | "connecting" | "connected");
    }
    if (savedGoogleLeadFormStatus) {
      setGoogleLeadFormStatus(savedGoogleLeadFormStatus as "disconnected" | "connecting" | "connected");
    }
    if (savedFacebookLeadFormStatus) {
      setFacebookLeadFormStatus(savedFacebookLeadFormStatus as "disconnected" | "connecting" | "connected");
    }
    if (savedQuestionIndex && !isNaN(Number.parseInt(savedQuestionIndex))) {
      setCurrentQuestionIndex(Number.parseInt(savedQuestionIndex));
    }
    if (savedFormData) {
      try {
        const parsedFormData = JSON.parse(savedFormData);
        setFormData(parsedFormData);
      } catch (error) {
        console.error("Error parsing saved form data:", error);
      }
    }
    if (savedHubspotAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedHubspotAccountInfo);
        setHubspotAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved hubspot account info:", error);
      }
    }
    if (savedPipedriveAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedPipedriveAccountInfo);
        setPipedriveAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved pipedrive account info:", error);
      }
    }
    if (savedGoogleFormAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedGoogleFormAccountInfo);
        setGoogleFormAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved google form account info:", error);
      }
    }
    if (savedGoogleLeadFormAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedGoogleLeadFormAccountInfo);
        setGoogleLeadFormAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved google lead form account info:", error);
      }
    }
    if (savedFacebookLeadFormAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedFacebookLeadFormAccountInfo);
        setFacebookLeadFormAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved facebook lead form account info:", error);
      }
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === "hubspot_success") {
        setHubspotStatus("connected");
        setHubspotAccountInfo(event.data.accountInfo);
        setFormData(prev => ({
          ...prev,
          selectedCrm: "HubSpot",
        }));
        localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "HubSpot" }));
        // clearOAuthState();
        autoProgressToNext();
      } else if (event.data.type === "hubspot_error") {
        setHubspotStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to HubSpot. Please try again."}`);
        clearOAuthState();
      } else if (event.data.type === "pipedrive_success") {
        setPipedriveStatus("connected");
        setPipedriveAccountInfo(event.data.accountInfo);
        setFormData(prev => ({
          ...prev,
          selectedCrm: "Pipedrive",
        }));
        localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "Pipedrive" }));
        clearOAuthState();
        setTimeout(() => syncPipedriveLeads(), 1000);
        autoProgressToNext();
      } else if (event.data.type === "pipedrive_error") {
        setPipedriveStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to Pipedrive. Please try again."}`);
        clearOAuthState();
      } else if (event.data.type === "google_form_success") {
        setGoogleFormStatus("connected");
        setGoogleFormAccountInfo(event.data.accountInfo);
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
        clearOAuthState();
        setShowGoogleFormModal(true);
      } else if (event.data.type === "google_form_error") {
        setGoogleFormStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to Google Form. Please try again."}`);
        clearOAuthState();
      } else if (event.data.type === "google_lead_form_success") {
        setGoogleLeadFormStatus("connected");
        setGoogleLeadFormAccountInfo(event.data.accountInfo);
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
        clearOAuthState();
        autoProgressToNext();
      } else if (event.data.type === "google_lead_form_error") {
        setGoogleLeadFormStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to Google Lead Form. Please try again."}`);
        clearOAuthState();
      } else if (event.data.type === "facebook_lead_form_success") {
        setFacebookLeadFormStatus("connected");
        setFacebookLeadFormAccountInfo(event.data.accountInfo);
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
        clearOAuthState();
        autoProgressToNext();
      } else if (event.data.type === "facebook_lead_form_error") {
        setFacebookLeadFormStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to Facebook Lead Form. Please try again."}`);
        clearOAuthState();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    currentQuestionIndex,
    formData,
    hubspotAccountInfo,
    pipedriveAccountInfo,
    googleFormAccountInfo,
    googleLeadFormAccountInfo,
    facebookLeadFormAccountInfo,
    autoProgressToNext,
    filteredQuestions.length,
  ]);

  useEffect(() => {
    const handleOAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hubspotStatus = urlParams.get("hubspot_status");
      const pipedriveStatus = urlParams.get("pipedrive_status");
      const googleFormStatus = urlParams.get("google_form_status");
      const googleLeadFormStatus = urlParams.get("google_lead_form_status");
      const facebookLeadFormStatus = urlParams.get("facebook_lead_form_status");
      const errorMessage = urlParams.get("error_message");
      const accountName = urlParams.get("account_name");
      const contactCount = urlParams.get("contact_count");
      const dealCount = urlParams.get("deal_count");

      if (hubspotStatus === "success") {
        console.log("✅ HubSpot OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };
        setHubspotStatus("connected");
        setHubspotAccountInfo(accountInfo);
        setFormData(prev => ({
          ...prev,
          selectedCrm: "HubSpot",
        }));
        // localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "HubSpot" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (hubspotStatus === "error") {
        console.log("❌ HubSpot OAuth error detected from URL:", errorMessage);
        setHubspotStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (pipedriveStatus === "success") {
        console.log("✅ Pipedrive OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: parseInt(dealCount || "0"),
        };
        setPipedriveStatus("connected");
        setPipedriveAccountInfo(accountInfo);
        setFormData(prev => ({
          ...prev,
          selectedCrm: "Pipedrive",
        }));
        // localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "Pipedrive" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => syncPipedriveLeads(), 1000);
        autoProgressToNext();
      } else if (pipedriveStatus === "error") {
        console.log("❌ Pipedrive OAuth error detected from URL:", errorMessage);
        setPipedriveStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (googleFormStatus === "success") {
        console.log("✅ Google Form OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };
        setGoogleFormStatus("connected");
        setGoogleFormAccountInfo(accountInfo);
        // localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Google Forms" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        setShowGoogleFormModal(true);
      } else if (googleFormStatus === "error") {
        console.log("❌ Google Form OAuth error detected from URL:", errorMessage);
        setGoogleFormStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (googleLeadFormStatus === "success") {
        console.log("✅ Google Lead Form OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };
        setGoogleLeadFormStatus("connected");
        setGoogleLeadFormAccountInfo(accountInfo);
        // localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "Google Ads Lead Forms" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (googleLeadFormStatus === "error") {
        console.log("❌ Google Lead Form OAuth error detected from URL:", errorMessage);
        setGoogleLeadFormStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (facebookLeadFormStatus === "success") {
        console.log("✅ Facebook Lead Form OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };
        setFacebookLeadFormStatus("connected");
        setFacebookLeadFormAccountInfo(accountInfo);
        // localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "Facebook Lead Ads" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (facebookLeadFormStatus === "error") {
        console.log("❌ Facebook Lead Form OAuth error detected from URL:", errorMessage);
        setFacebookLeadFormStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthRedirect();
  }, [autoProgressToNext, currentQuestionIndex, filteredQuestions.length, formData]);

  const getCurrentUserId = async () => {
    const user = await getUserData();
    return user?.id;
  };

  const clearOAuthState = () => {
    localStorage.removeItem("hubspot_oauth_status");
    localStorage.removeItem("pipedrive_oauth_status");
    localStorage.removeItem("google_form_oauth_status");
    localStorage.removeItem("google_lead_form_oauth_status");
    localStorage.removeItem("facebook_lead_form_oauth_status");
    localStorage.removeItem("oauth_question_index");
    localStorage.removeItem("hubspot_oauth_account_info");
    localStorage.removeItem("pipedrive_oauth_account_info");
    localStorage.removeItem("google_form_oauth_account_info");
    localStorage.removeItem("google_lead_form_oauth_account_info");
    localStorage.removeItem("facebook_lead_form_oauth_account_info");
    // Preserve oauth_form_data for "No CRM" case
  };

  const saveOAuthState = (type: "hubspot" | "pipedrive" | "google_form" | "google_lead_form" | "facebook_lead_form") => {
    localStorage.setItem(`${type}_oauth_status`, "connecting");
    localStorage.setItem("oauth_question_index", currentQuestionIndex.toString());
    localStorage.setItem("oauth_form_data", JSON.stringify(formData));
    if (type === "hubspot" && hubspotAccountInfo) {
      localStorage.setItem("hubspot_oauth_account_info", JSON.stringify(hubspotAccountInfo));
    } else if (type === "pipedrive" && pipedriveAccountInfo) {
      localStorage.setItem("pipedrive_oauth_account_info", JSON.stringify(pipedriveAccountInfo));
    } else if (type === "google_form" && googleFormAccountInfo) {
      localStorage.setItem("google_form_oauth_account_info", JSON.stringify(googleFormAccountInfo));
    } else if (type === "google_lead_form" && googleLeadFormAccountInfo) {
      localStorage.setItem("google_lead_form_oauth_account_info", JSON.stringify(googleLeadFormAccountInfo));
    } else if (type === "facebook_lead_form" && facebookLeadFormAccountInfo) {
      localStorage.setItem("facebook_lead_form_oauth_account_info", JSON.stringify(facebookLeadFormAccountInfo));
    }
  };

  const handleInputChange = (value: string) => {
    // Always update local state first
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    // Save immediately so refresh/redirect works
    const updatedFormData = { ...formData, [currentQuestion.id]: value };
    localStorage.setItem("oauth_form_data", JSON.stringify(updatedFormData));

    // CRM-specific logic
    if (currentQuestion.id === "selectedCrm") {
      clearOAuthState();
      if (value === "HubSpot") {
        setHubspotStatus("disconnected");
        setShowHubspotModal(true);
        setShowCompletionButtons(true);
      } else if (value === "Pipedrive") {
        setPipedriveStatus("disconnected");
        setShowPipedriveModal(true);
        setShowCompletionButtons(true);
      } else if (value === "No CRM") {
        setShowCompletionButtons(true);
        setHubspotStatus("disconnected");
        setPipedriveStatus("disconnected");
      }
    }

    // Ads
    if (currentQuestion.id === "adsConnections") {
      if (value === "Facebook Lead Ads") {
        setShowFacebookLeadFormModal(true);
        setShowCompletionButtons(true);
      } else if (value === "Google Ads Lead Forms") {
        setShowGoogleLeadFormModal(true);
        setShowCompletionButtons(true);
      } else {
        setShowCompletionButtons(true);
      }
    }

    // Lead capture forms
    if (currentQuestion.id === "leadCaptureForms") {
      if (value === "Google Forms") {
        setShowGoogleFormModal(true);
        setShowCompletionButtons(true);
      } else {
        setShowCompletionButtons(true);
      }
    }

    // Upload leads
    if (currentQuestion.id === "uploadLeads") {
      if (value === "Yes") {
        setTimeout(() => setShowManualLeadsModal(true), 500);
      }
      setShowCompletionButtons(true);
    }
  };

  const connectToHubSpot = async () => {
    setHubspotStatus("connecting");
    saveOAuthState("hubspot");
    const clinicId = await getClinicId();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          userId: await getCurrentUserId(),
          clinic_id: clinicId,
          redirectUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      console.log("🚀 Redirecting to HubSpot OAuth:", data.authUrl);
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Connection failed:", error);
      setHubspotStatus("disconnected");
      ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to HubSpot. Please try again"}`);
    }
  };

  const connectToPipedrive = async () => {
    setPipedriveStatus("connecting");
    saveOAuthState("pipedrive");
    const clinicId = await getClinicId();

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      console.log("Session debug:", {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        sessionError: sessionError,
        tokenLength: session?.access_token ? session.access_token.length : 0,
      });

      if (!session?.access_token) {
        throw new Error("No valid session found. Please log in again.");
      }

      console.log("Making request with token:", session.access_token.substring(0, 20) + "...");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: "Functions",
          userId: await getCurrentUserId(),
          clinic_id: clinicId,
          redirectUrl: window.location.href,
        }),
      });

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response body:", responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      if (data.error) {
        throw new Error(data.error);
      }

      console.log("🚀 Redirecting to Pipedrive OAuth:", data.authUrl);
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Connection failed:", error);
      setPipedriveStatus("disconnected");
      ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Pipedrive. Please try again"}`);
    }
  };

  const connectToGoogleForm = async () => {
    setGoogleFormStatus("connecting");
    saveOAuthState("google_form");
    const clinicId = await getClinicId();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/initiate-oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId: await getCurrentUserId(),
          clinic_id: clinicId,
          redirectUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log("Response data:", data);
      if (data.error) {
        throw new Error(data.error);
      }

      console.log("🚀 Redirecting to Google Form OAuth:", data.auth_url);
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Connection failed:", error);
      setGoogleFormStatus("disconnected");
      ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Google Form. Please try again"}`);
    }
  };

  const findSheetDetails = (treeData: any, sheetValue: any) => {
    const [spreadsheetId, sheetId] = sheetValue.split(":");

    const spreadsheetNode = treeData.find((node: any) => node.value === spreadsheetId);
    if (!spreadsheetNode || !spreadsheetNode.children) return null;

    const sheetNode = spreadsheetNode.children.find((child: any) => child.value === sheetValue);
    if (!sheetNode) return null;

    return {
      spreadsheet_id: spreadsheetId,
      spreadsheet_title: spreadsheetNode.title,
      sheet_id: sheetId,
      sheet_title: sheetNode.title,
    };
  };

  const syncGoogleFormLeads = async () => {
    if (selectedGoogleFormWorksheets.length === 0) {
      WarningToast("Please select at least one worksheet");
      return;
    }
    const getConnectionId = async () => {
      try {
        const clinicId = await getClinicId();

        const { data, error } = await supabase
          .from("google_form_connections")
          .select("id")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching connection_id:", error);
          return null;
        }

        return data?.id || null;
      } catch (error) {
        console.error("Unexpected error fetching connection_id:", error);
        return null;
      }
    };
    const connection_id = await getConnectionId();

    try {
      const selectedSheetsObjects = selectedGoogleFormWorksheets.map(value => findSheetDetails(googleFormTreeData, value)).filter(Boolean);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/save-selected-sheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connection_id: connection_id,
          selected_sheets: selectedSheetsObjects,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync leads");
      }

      const result = await response.json();
      console.log("✅ Leads synced:", result);

      if (result.synced_count > 0) {
        SuccessToast(`Successfully synced ${result.synced_count} leads from Google Form!`);
        setGoogleFormAccountInfo((prev: any) => ({ ...prev, responseCount: result.synced_count }));
        setGoogleFormLeadsSynced(true);
        setShowGoogleFormModal(false);
        autoProgressToNext();
      } else {
        InfoToast("No new leads to sync from Google Form");
        setGoogleFormLeadsSynced(true);
        setShowGoogleFormModal(false);
        autoProgressToNext();
      }
    } catch (error) {
      console.error("Lead sync failed:", error);
      WarningToast("Failed to sync leads from Google Form");
    }
  };

  const syncGoogleLeadFormLeads = async () => {
    const clinicId = await getClinicId();
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-lead-form/sync-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          clinic_id: clinicId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync leads");
      }

      const result = await response.json();
      console.log("✅ Leads synced:", result);

      if (result.synced_count > 0) {
        SuccessToast(`Successfully synced ${result.synced_count} leads from Google Lead Form!`);
      } else {
        InfoToast("No new leads to sync from Google Lead Form");
      }
    } catch (error) {
      console.error("Lead sync failed:", error);
      WarningToast("Failed to sync leads from Google Lead Form");
    }
  };

  // const syncFacebookLeadFormLeads = async () => {
  //   const clinicId = await getClinicId();
  //   try {
  //     const response = await fetch(`${SUPABASE_URL}/functions/v1/facebook-lead-form/sync-leads`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  //         apikey: SUPABASE_ANON_KEY,
  //       },
  //       body: JSON.stringify({
  //         clinic_id: clinicId,
  //       }),
  //     });

  //     if (!response.ok) {
  //       throw new Error("Failed to sync leads");
  //     }

  //     const result = await response.json();
  //     console.log("✅ Leads synced:", result);

  //     if (result.synced_count > 0) {
  //       SuccessToast(`Successfully synced ${result.synced_count} leads from Facebook Lead Ads!`);
  //     } else {
  //       InfoToast("No new leads to sync from Facebook Lead Ads");
  //     }
  //   } catch (error) {
  //     console.error("Lead sync failed:", error);
  //     WarningToast("Failed to sync leads from Facebook Lead Ads");
  //   }
  // };

  const handleHubspotModalOk = () => {
    if (hubspotStatus === "connected") {
      setShowHubspotModal(false);
      autoProgressToNext();
    } else {
      setShowHubspotModal(false);
      setShowCompletionButtons(false);
          setHubspotStatus("disconnected");

      setFormData(prev => ({
        ...prev,
        selectedCrm: "",
      }));
      localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
    }
  };

  const handleGoogleFormModalOk = () => {
    if (googleFormStatus === "connected" && selectedGoogleFormWorksheets.length > 0 && googleFormLeadsSynced) {
      setShowGoogleFormModal(false);
      autoProgressToNext();
    } else {
            setShowGoogleFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({
        ...prev,
        leadCaptureForms: "",
      }));
    }
  };

  const handleGoogleLeadFormModalOk = () => {
    if (googleLeadFormStatus === "connected") {
      setShowGoogleLeadFormModal(false);
      autoProgressToNext();
    } else {
      setShowGoogleLeadFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({
        ...prev,
        adsConnections: "",
      }));
      localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
    }
  };

  const handleFacebookLeadFormModalOk = () => {
    if (facebookLeadFormStatus === "connected") {
      setShowFacebookLeadFormModal(false);
      autoProgressToNext();
    } else {
      setShowFacebookLeadFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({
        ...prev,
        adsConnections: "",
      }));
      localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
    }
  };

  const handleHubspotModalCancel = () => {
    setShowHubspotModal(false);
    setShowCompletionButtons(false);
    setHubspotStatus("disconnected");
    setFormData(prev => ({
      ...prev,
      selectedCrm: "",
    }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
  };

  const handleGoogleFormModalCancel = () => {
    setShowGoogleFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({
      ...prev,
      leadCaptureForms: "",
    }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
  };

  const handleGoogleLeadFormModalCancel = () => {
    setShowGoogleLeadFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({
      ...prev,
      adsConnections: "",
    }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
  };

  const handleFacebookLeadFormModalCancel = () => {
    setShowFacebookLeadFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({
      ...prev,
      adsConnections: "",
    }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
  };

  const handlePipedriveModalOk = () => {
    if (pipedriveStatus === "connected") {
      setShowPipedriveModal(false);
      autoProgressToNext();
    } else {
      setShowPipedriveModal(false);
            setShowCompletionButtons(false);

      setFormData(prev => ({
        ...prev,
        selectedCrm: "",
      }));
      localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
    }
  };

  const handlePipedriveModalCancel = () => {
    setShowPipedriveModal(false);
    pipedriveForm.resetFields();
    setShowCompletionButtons(false);
    setFormData(prev => ({
      ...prev,
      selectedCrm: "",
    }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
  };

  const handleNext = () => {
    // Ensure formData is in sync with local storage
    const savedFormData = localStorage.getItem("oauth_form_data");
    if (savedFormData) {
      try {
        const parsedFormData = JSON.parse(savedFormData);
        if (parsedFormData.selectedCrm !== formData.selectedCrm) {
          setFormData(parsedFormData);
        }
      } catch (error) {
        console.error("Error parsing saved form data in handleNext:", error);
      }
    }

    if (currentQuestion.id === "selectedCrm") {
      if (currentValue === "HubSpot" && hubspotStatus !== "connected") {
        setShowHubspotModal(true);
        return;
      } else if (currentValue === "Pipedrive" && pipedriveStatus !== "connected") {
        setShowPipedriveModal(true);
        return;
      } else if (currentValue === "No CRM") {
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
      }
    } else if (currentQuestion.id === "adsConnections") {
      if (currentValue === "Facebook Lead Ads" && facebookLeadFormStatus !== "connected") {
        setShowFacebookLeadFormModal(true);
        return;
      } else if (currentValue === "Google Ads Lead Forms" && googleLeadFormStatus !== "connected") {
        setShowGoogleLeadFormModal(true);
        return;
      }
    } else if (currentQuestion.id === "leadCaptureForms") {
      if (
        currentValue === "Google Forms" &&
        (googleFormStatus !== "connected" || selectedGoogleFormWorksheets.length === 0 || !googleFormLeadsSynced)
      ) {
        setShowGoogleFormModal(true);
        return;
      }
    }

    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      localStorage.setItem("oauth_question_index", (currentQuestionIndex + 1).toString());
    } else {
      const finalData = {
        ...formData,
        hubspotConnected: hubspotStatus === "connected",
        pipedriveConnected: pipedriveStatus === "connected",
        googleFormConnected: googleFormStatus === "connected",
        googleLeadFormConnected: googleLeadFormStatus === "connected",
        facebookLeadFormConnected: facebookLeadFormStatus === "connected",
        hubspotAccountInfo,
        pipedriveAccountInfo,
        googleFormAccountInfo,
        googleLeadFormAccountInfo,
        facebookLeadFormAccountInfo,
        csvUploaded: localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) !== null,
      };
      localStorage.setItem("oauth_form_data", JSON.stringify(formData));
      onNext(finalData);
    }
  };

  const handlePrevious = () => {
    setShowCompletionButtons(false);
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      localStorage.setItem("oauth_question_index", (currentQuestionIndex - 1).toString());
    } else if (onPrev) {
      onPrev();
    }
  };

  const renderPreviousQuestions = () => {
    return filteredQuestions.slice(0, currentQuestionIndex).map(q => {
      const value = formData[q.id as keyof typeof formData];

      return (
        <div key={q.id} className="mb-8">
          <Text className="text-gray-500 text-sm font-normal block mb-2 leading-relaxed">{q.question}</Text>
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">{value || "Not specified"}</Text>
            {q.id === "selectedCrm" && value === "HubSpot" && hubspotStatus === "connected" && (
              <div className="mt-2 p-2 bg-green-100 rounded-lg">
                <Text className="text-green-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {hubspotAccountInfo?.accountName || "HubSpot"}
                </Text>
              </div>
            )}
            {q.id === "selectedCrm" && value === "Pipedrive" && pipedriveStatus === "connected" && (
              <div className="mt-2 p-2 bg-blue-100 rounded-lg">
                <Text className="text-blue-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {pipedriveAccountInfo?.accountName || "Pipedrive"}
                </Text>
              </div>
            )}
            {q.id === "leadCaptureForms" && value === "Google Forms" && googleFormStatus === "connected" && (
              <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
                <Text className="text-yellow-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {googleFormAccountInfo?.accountName || "Google Forms"}
                </Text>
              </div>
            )}
            {q.id === "adsConnections" && value === "Google Ads Lead Forms" && googleLeadFormStatus === "connected" && (
              <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
                <Text className="text-yellow-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {googleLeadFormAccountInfo?.accountName || "Google Ads Lead Forms"}
                </Text>
              </div>
            )}
            {q.id === "adsConnections" && value === "Facebook Lead Ads" && facebookLeadFormStatus === "connected" && (
              <div className="mt-2 p-2 bg-blue-100 rounded-lg">
                <Text className="text-blue-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {facebookLeadFormAccountInfo?.accountName || "Facebook Lead Ads"}
                </Text>
              </div>
            )}
            {q.id === "uploadLeads" && value === "Yes" && localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) && (
              <div className="mt-2 p-2 bg-purple-100 rounded-lg">
                <Text className="text-purple-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  CSV file uploaded successfully
                </Text>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const renderCurrentInput = () => {
    if (currentQuestion?.type === "select") {
      return (
        <div className="mb-6">
          <Select
            value={currentValue || undefined}
            onChange={handleInputChange}
            placeholder="Select an option"
            className="w-full"
            size="large"
            disabled={isSubmitting}
          >
            {currentQuestion.options?.map(option => (
              <Select.Option key={option} value={option}>
                {option}
              </Select.Option>
            ))}
          </Select>
          {currentQuestion.id === "selectedCrm" && currentValue === "Pipedrive" && (
            <Card className="rounded-xl bg-green-50 border-2 border-green-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                  <ThunderboltOutlined className="text-white text-base" />
                </div>
                <Text className="text-lg font-semibold text-green-900">Connect your Pipedrive CRM!</Text>
              </div>
              <Text className="text-green-900 text-base leading-6">
                Great! We can connect your Pipedrive CRM directly to automatically sync your leads, contacts, and deals with our platform
                for seamless workflows.
              </Text>
            </Card>
          )}
          {currentQuestion.id === "selectedCrm" && currentValue === "HubSpot" && (
            <Card className="rounded-xl bg-orange-50 border-2 border-orange-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">H</Text>
                </div>
                <Text className="text-lg font-semibold text-orange-900">Connect your HubSpot CRM!</Text>
              </div>
              <Text className="text-orange-900 text-base leading-6">
                Great! We can connect your HubSpot CRM directly to automatically sync your leads, contacts, and deals with our platform for
                seamless workflows.
              </Text>
            </Card>
          )}
          {currentQuestion.id === "selectedCrm" && currentValue === "No CRM" && (
            <Card className="rounded-xl bg-gray-50 border-2 border-gray-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">N</Text>
                </div>
                <Text className="text-lg font-semibold text-gray-900">No CRM Selected</Text>
              </div>
              <Text className="text-gray-900 text-base leading-6">
                You’ve chosen not to connect a CRM. You can still sync leads via Google Forms, ad platforms, or CSV upload in the next
                steps.
              </Text>
            </Card>
          )}
          {currentQuestion.id === "adsConnections" && currentValue === "Facebook Lead Ads" && (
            <Card className="rounded-xl bg-blue-50 border-2 border-blue-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">F</Text>
                </div>
                <Text className="text-lg font-semibold text-blue-900">Connect your Facebook Lead Ads!</Text>
              </div>
              <Text className="text-blue-900 text-base leading-6">
                Great! We can connect your Facebook Lead Ads directly to automatically sync your leads with our platform for seamless
                workflows.
              </Text>
            </Card>
          )}
          {currentQuestion.id === "adsConnections" && currentValue === "Google Ads Lead Forms" && (
            <Card className="rounded-xl bg-yellow-50 border-2 border-yellow-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">G</Text>
                </div>
                <Text className="text-lg font-semibold text-yellow-900">Connect your Google Ads Lead Forms!</Text>
              </div>
              <Text className="text-yellow-900 text-base leading-6">
                Great! We can connect your Google Ads Lead Forms directly to automatically sync your leads with our platform for seamless
                workflows.
              </Text>
            </Card>
          )}
          {currentQuestion.id === "leadCaptureForms" && currentValue === "Google Forms" && (
            <Card className="rounded-xl bg-yellow-50 border-2 border-yellow-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">G</Text>
                </div>
                <Text className="text-lg font-semibold text-yellow-900">Connect your Google Forms!</Text>
              </div>
              <Text className="text-yellow-900 text-base leading-6">
                Great! We can connect your Google Forms directly to automatically sync your leads with our platform for seamless workflows.
              </Text>
            </Card>
          )}
        </div>
      );
    } else if (currentQuestion?.type === "radio") {
      return (
        <div className="mb-6">
          <Radio.Group value={currentValue} onChange={e => handleInputChange(e.target.value)} className="w-full">
            <Space direction="vertical" size="middle" className="w-full">
              {currentQuestion.options?.map(option => (
                <Card
                  key={option}
                  hoverable
                  className={`rounded-xl border-2 cursor-pointer ${
                    currentValue === option ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"
                  }`}
                  styles={{ body: { padding: "16px" } }}
                  onClick={() => !isSubmitting && handleInputChange(option)}
                >
                  <Radio value={option} className="text-lg text-black" disabled={isSubmitting}>
                    <span className="text-black">{option}</span>
                  </Radio>
                </Card>
              ))}
            </Space>
          </Radio.Group>
          {currentQuestion.id === "uploadLeads" && currentValue === "Yes" && (
            <Card className="rounded-xl bg-purple-50 border-2 border-purple-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">CSV</Text>
                </div>
                <Text className="text-lg font-semibold text-purple-900">Upload your existing leads!</Text>
              </div>
              <Text className="text-purple-900 text-base leading-6">
                Great! You can upload a CSV file with your existing leads to import them directly into our platform. We&apos;ll help you map
                the fields correctly.
              </Text>
            </Card>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl">
      <div>
        <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          Lead Capture Setup
        </Title>
        <Title level={5} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          We can only follow up with leads we can see. Connecting your systems enables us to respond to new inquiries instantly, eliminating
          manual work for your team.
        </Title>
        {renderPreviousQuestions()}
        <Title level={3} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          {currentQuestion?.question}
        </Title>

        {renderCurrentInput()}

        {showCompletionButtons && (
          <div className="flex justify-between mt-8">
            <Button
              onClick={handlePrevious}
              className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto"
              disabled={isSubmitting}
            >
              Previous
            </Button>
            <Button
              type="primary"
              onClick={handleNext}
              className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
              loading={isSubmitting}
            >
              {currentQuestionIndex < filteredQuestions.length - 1 ? "Continue" : "Complete Setup"}
            </Button>
          </div>
        )}

        {!showCompletionButtons && (
          <div className="flex justify-between">
            <Button
              onClick={handlePrevious}
              className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto"
              disabled={(currentQuestionIndex === 0 && !onPrev) || isSubmitting}
            >
              Previous
            </Button>
            <Button
              type="primary"
              onClick={handleNext}
              disabled={(currentQuestion.type === "radio" || currentQuestion.type === "select" ? !currentValue : false) || isSubmitting}
              loading={isSubmitting && currentQuestionIndex === filteredQuestions?.length - 1}
              className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
            >
              {currentQuestionIndex === filteredQuestions?.length - 1
                ? isSubmitting
                  ? "Setting up your clinic..."
                  : "Complete Setup"
                : "Continue"}
            </Button>
          </div>
        )}
      </div>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">H</Text>
            </div>
            <span className="text-xl font-semibold">Connect to HubSpot</span>
          </div>
        }
        open={showHubspotModal}
        onOk={handleHubspotModalOk}
        onCancel={handleHubspotModalCancel}
        okText={hubspotStatus === "connected" ? "Continue" : "Skip for Now"}
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
        }}
        width={500}
        centered
      >
        <div className="py-6">
          {hubspotStatus === "disconnected" && (
            <>
              <Alert
                message="Connect your HubSpot account"
                description="We'll automatically sync your contacts and deals. This takes just one click!"
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="text-center">
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={connectToHubSpot}
                  className="bg-orange-500 border-orange-500 hover:bg-orange-600 h-12 px-8 text-lg font-medium"
                >
                  Connect to HubSpot
                </Button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600">
                    <strong>What happens next:</strong>
                    <br />• You&apos;ll be redirected to HubSpot to sign in
                    <br />• Grant permission to access your contacts
                    <br />• We&apos;ll automatically sync everything
                    <br />• Takes less than 30 seconds!
                  </Text>
                </div>
              </div>
            </>
          )}
          {hubspotStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Connecting to HubSpot...</Text>
                <br />
                <Text className="text-gray-500">Please complete the authorization process</Text>
              </div>
            </div>
          )}
          {hubspotStatus === "connected" && hubspotAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${hubspotAccountInfo.accountName}. Moving to next step...`}
                type="success"
                showIcon
                className="mb-4"
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">P</Text>
            </div>
            <span className="text-xl font-semibold">Connect to Pipedrive</span>
          </div>
        }
        open={showPipedriveModal}
        onOk={handlePipedriveModalOk}
        onCancel={handlePipedriveModalCancel}
        okText={pipedriveStatus === "connected" ? "Continue" : pipedriveStatus === "connecting" ? "Connecting..." : "Skip for Now"}
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
          loading: pipedriveStatus === "connecting",
        }}
        width={600}
        centered
      >
        <div className="py-6">
          {pipedriveStatus === "disconnected" && (
            <>
              <Alert
                message="Connect Pipedrive for CRM Integration"
                description="Connect your Pipedrive CRM to automatically sync your leads, contacts, and deals with our platform."
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="text-center">
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={connectToPipedrive}
                  className="bg-green-600 border-green-600 hover:bg-green-700 h-12 px-8 text-lg font-medium"
                >
                  Connect to Pipedrive
                </Button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600">
                    <strong>What happens next:</strong>
                    <br />• You&apos;ll be redirected to Pipedrive to sign in
                    <br />• Grant permission to access your CRM data
                    <br />• We&apos;ll automatically sync your leads and deals
                    <br />• Takes less than 30 seconds!
                  </Text>
                </div>
              </div>
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 mt-6">
                <div className="flex items-start">
                  <CalendarOutlined className="text-blue-500 mt-1 mr-3" />
                  <div className="flex-1">
                    <Text className="text-blue-800 text-sm font-medium block mb-2">Need Help?</Text>
                    <Text className="text-blue-700 text-sm mb-3">
                      Our team can help you set up the integration and configure your workflows.
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => window.open("https://calendly.com/your-team/pipedrive-setup", "_blank")}
                      className="bg-purple-600 border-purple-600 hover:bg-purple-700"
                    >
                      Book a Support Meeting
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
          {pipedriveStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Connecting to Pipedrive...</Text>
                <br />
                <Text className="text-gray-500">Please complete the authorization process</Text>
              </div>
            </div>
          )}
          {pipedriveStatus === "connected" && pipedriveAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${pipedriveAccountInfo.accountName}. Your CRM integration is ready!`}
                type="success"
                showIcon
                className="mb-4"
              />
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-green-800">
                      Pipedrive Integration Active
                    </Text>
                    <br />
                    <Text className="text-green-600 text-sm">
                      {pipedriveAccountInfo.contactCount} contacts • {pipedriveAccountInfo.dealCount} deals
                    </Text>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="primary"
                      size="small"
                      onClick={syncPipedriveLeads}
                      className="bg-green-600 border-green-600 hover:bg-green-700"
                    >
                      Sync Leads
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        setPipedriveStatus("disconnected");
                        setPipedriveAccountInfo(null);
                        setFormData(prev => ({ ...prev, selectedCrm: "" }));
                        localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
                      }}
                      className="text-red-500"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Text className="text-gray-600">⚡ Your CRM integration is ready! Need further help? Book a support meeting.</Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/pipedrive-setup", "_blank")}
                  className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">G</Text>
            </div>
            <span className="text-xl font-semibold">Connect to Google Forms</span>
          </div>
        }
        open={showGoogleFormModal}
        onOk={handleGoogleFormModalOk}
        onCancel={handleGoogleFormModalCancel}
        okText={googleFormStatus === "connected" ? "Continue" : "Skip for Now"}
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
        }}
        width={500}
        centered
      >
        <div className="py-6">
          {googleFormStatus === "disconnected" && (
            <>
              <Alert
                message="Connect your Google Forms"
                description="We can automatically sync leads from your Google Forms to our platform."
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="text-center">
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={connectToGoogleForm}
                  className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 h-12 px-8 text-lg font-medium"
                >
                  Connect to Google Forms
                </Button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600">
                    <strong>What happens next:</strong>
                    <br />• You&apos;ll be redirected to Google to sign in
                    <br />• Grant permission to access your form responses
                    <br />• We&apos;ll automatically sync your leads
                    <br />• Takes less than 30 seconds!
                  </Text>
                </div>
              </div>
            </>
          )}
          {googleFormStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Connecting to Google Forms...</Text>
                <br />
                <Text className="text-gray-500">Please complete the authorization process</Text>
              </div>
            </div>
          )}
          {googleFormStatus === "connected" && googleFormAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${googleFormAccountInfo.accountName}. Your form integration is ready!`}
                type="success"
                showIcon
                className="mb-4"
              />
              <div className="mt-4">
                <Text className="block mb-2">Select worksheets to sync leads from:</Text>
                <TreeSelect
                  style={{ width: "100%" }}
                  dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                  placeholder="Select worksheets"
                  treeData={googleFormTreeData}
                  multiple
                  treeCheckable
                  showCheckedStrategy={TreeSelect.SHOW_CHILD}
                  value={selectedGoogleFormWorksheets}
                  onChange={setSelectedGoogleFormWorksheets}
                />
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-yellow-800">
                      Google Forms Integration Active
                    </Text>
                    <br />
                    <Text className="text-yellow-600 text-sm">{googleFormAccountInfo.responseCount || 0} responses synced</Text>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="primary"
                      size="small"
                      onClick={syncGoogleFormLeads}
                      className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                    >
                      Sync Leads
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        setGoogleFormStatus("disconnected");
                        setGoogleFormAccountInfo(null);
                      }}
                      className="text-red-500"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Text className="text-gray-600">⚡ Your Google Forms integration is ready! Need further help? Book a support meeting.</Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/google-form-setup", "_blank")}
                  className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">G</Text>
            </div>
            <span className="text-xl font-semibold">Connect to Google Ads Lead Forms</span>
          </div>
        }
        open={showGoogleLeadFormModal}
        onOk={handleGoogleLeadFormModalOk}
        onCancel={handleGoogleLeadFormModalCancel}
        okText={googleLeadFormStatus === "connected" ? "Continue" : "Skip for Now"}
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
        }}
        width={500}
        centered
      >
        <div className="py-6">
          {googleLeadFormStatus === "disconnected" && (
            <>
              <Alert
                message="Connect your Google Ads Lead Forms"
                description="We can automatically sync leads from your Google Ads Lead Forms to our platform."
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="text-center">
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={handleClick}
                  className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 h-12 px-8 text-lg font-medium"
                >
                  Connect to Google Ads Lead Forms
                </Button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600">
                    <strong>What happens next:</strong>
                    <br />• You&apos;ll be redirected to Google to sign in
                    <br />• Grant permission to access your lead form responses
                    <br />• We&apos;ll automatically sync your leads
                    <br />• Takes less than 30 seconds!
                  </Text>
                </div>
              </div>
            </>
          )}
          {googleLeadFormStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Connecting to Google Ads Lead Forms...</Text>
                <br />
                <Text className="text-gray-500">Please complete the authorization process</Text>
              </div>
            </div>
          )}
          {googleLeadFormStatus === "connected" && googleLeadFormAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${googleLeadFormAccountInfo.accountName}. Your lead form integration is ready!`}
                type="success"
                showIcon
                className="mb-4"
              />
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-yellow-800">
                      Google Ads Lead Forms Integration Active
                    </Text>
                    <br />
                    <Text className="text-yellow-600 text-sm">{googleLeadFormAccountInfo.responseCount} responses synced</Text>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="primary"
                      size="small"
                      onClick={syncGoogleLeadFormLeads}
                      className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                    >
                      Sync Leads
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        setGoogleLeadFormStatus("disconnected");
                        setGoogleLeadFormAccountInfo(null);
                      }}
                      className="text-red-500"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Text className="text-gray-600">
                  ⚡ Your Google Ads Lead Forms integration is ready! Need further help? Book a support meeting.
                </Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/google-lead-form-setup", "_blank")}
                  className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">F</Text>
            </div>
            <span className="text-xl font-semibold">Connect to Facebook Lead Ads</span>
          </div>
        }
        open={showFacebookLeadFormModal}
        onOk={handleFacebookLeadFormModalOk}
        onCancel={handleFacebookLeadFormModalCancel}
        okText={facebookLeadFormStatus === "connected" ? "Continue" : "Skip for Now"}
        cancelText="Cancel"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
        }}
        width={500}
        centered
      >
        <div className="py-6">
          {facebookLeadFormStatus === "disconnected" && (
            <>
              <Alert
                message="Connect your Facebook Lead Ads"
                description="We can automatically sync leads from your Facebook Lead Ads to our platform."
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="text-center">
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={handleFacebookClick}
                  className="bg-blue-600 border-blue-600 hover:bg-blue-700 h-12 px-8 text-lg font-medium"
                >
                  Connect to Facebook Lead Ads
                </Button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-600">
                    <strong>What happens next:</strong>
                    <br />• You&apos;ll be redirected to Facebook to sign in
                    <br />• Grant permission to access your lead form responses
                    <br />• We&apos;ll automatically sync your leads
                    <br />• Takes less than 30 seconds!
                  </Text>
                </div>
              </div>
            </>
          )}
          {facebookLeadFormStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Connecting to Facebook Lead Ads...</Text>
                <br />
                <Text className="text-gray-500">Please complete the authorization process</Text>
              </div>
            </div>
          )}
          {facebookLeadFormStatus === "connected" && facebookLeadFormAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${facebookLeadFormAccountInfo.accountName}. Your lead form integration is ready!`}
                type="success"
                showIcon
                className="mb-4"
              />

              <div className="mt-4 text-center">
                <Text className="text-gray-600">
                  ⚡ Your Facebook Lead Ads integration is ready! Need further help? Book a support meeting.
                </Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/facebook-lead-form-setup", "_blank")}
                  className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <CsvUploadModal
        open={showManualLeadsModal}
        onOk={leads => {
          setShowManualLeadsModal(false);
          handleCsvUpload(leads);
          if (localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) && leads) {
            SuccessToast("Leads saved successfully");
          }
          setShowCompletionButtons(true);
          setTimeout(() => {
            InfoToast("Want to add or remove manual leads upload? Click previous button");
          }, 5000);
        }}
        onCancel={() => setShowManualLeadsModal(false)}
      />

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: "#A068F1" }}>
              <Text className="text-white font-bold text-sm">?</Text>
            </div>
            <span className="text-xl font-semibold">Can&apos;t find your CRM?</span>
          </div>
        }
        open={showCustomCrmModal}
        onOk={() => setShowCustomCrmModal(false)}
        onCancel={() => {
          setShowCustomCrmModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({
            ...prev,
            selectedCrm: "",
          }));
        }}
        okText="Close"
        cancelText="Cancel"
        width={500}
        centered
      >
        <div className="py-6 text-center">
          <Alert
            message="We couldn't find your CRM."
            description="Don't worry! Our team can help you integrate your preferred tool. Book a call with us and we'll guide you through the process."
            type="info"
            showIcon
            className="mb-6 custom-alert-icon"
          />
          <Button
            type="primary"
            icon={<CalendarOutlined />}
            className="text-lg font-medium px-8 py-2 mt-2 border-none"
            style={{
              backgroundColor: "#A068F1",
              color: "#fff",
            }}
            onClick={() => {
              window.open("https://calendly.com/abdullah-salman-hashlogics/30min", "_blank");
              setShowCustomCrmModal(false);
            }}
          >
            Book a Call with Our Team
          </Button>
        </div>
      </Modal>
    </div>
  );
}
