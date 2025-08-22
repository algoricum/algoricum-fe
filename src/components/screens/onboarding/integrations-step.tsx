"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Radio, Select, Card, Space, Typography } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { IntegrationsStepProps, FormData } from "../../../app/types/types";
import {
  getClinicId,
  handleCsvUpload,
  syncPipedriveLeads,
  syncGoogleFormLeads,
  syncGoogleLeadFormLeads,
  syncTypeformLeads,
  clearOAuthState,
  connectToHubSpot,
  connectToPipedrive,
  connectToGoogleForm,
  connectToTypeform,
  findSheetDetails,
  ErrorToast,
  SuccessToast,
  InfoToast,
  createJotformConnection,
  syncJotformLeads,
  connectToGHL,
} from "../../../utils/integration-utils";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ONBOARDING_LEADS_FILE_NAME } from "../../../constants/integration-constants";
import {
  HubspotModal,
  PipedriveModal,
  GoogleFormModal,
  GoogleLeadFormModal,
  FacebookLeadFormModal,
  TypeformModal,
  CustomCrmModal,
  CsvUploadModal,
  JotformModal,
  GoHighLevelLeadFormModal,
} from "../../modals/Modals";
import { createClient } from "@/utils/supabase/config/client";
// import { set } from "lodash";

const { Title, Text } = Typography;

export default function IntegrationsStep({ onNext, onPrev, initialData = {}, isSubmitting = false }: IntegrationsStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [showGoHighLevelModal, setShowGoHighLevelModal] = useState(false);
  const [showPipedriveModal, setShowPipedriveModal] = useState(false);
  const [showGoogleFormModal, setShowGoogleFormModal] = useState(false);
  const [showGoogleLeadFormModal, setShowGoogleLeadFormModal] = useState(false);
  const [showFacebookLeadFormModal, setShowFacebookLeadFormModal] = useState(false);
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [showCustomCrmModal, setShowCustomCrmModal] = useState(false);
  const [showTypeformModal, setShowTypeformModal] = useState(false);
  const [showJotformModal, setShowJotformModal] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [goHighLevelStatus, setGoHighLevelStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [googleFormStatus, setGoogleFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [googleLeadFormStatus, setGoogleLeadFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [facebookLeadFormStatus, setFacebookLeadFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [pipedriveStatus, setPipedriveStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [typeformStatus, setTypeformStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [jotformStatus, setJotformStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hubspotAccountInfo, setHubspotAccountInfo] = useState<any>(null);
  const [googleFormAccountInfo, setGoogleFormAccountInfo] = useState<any>(null);
  const [googleLeadFormAccountInfo, setGoogleLeadFormAccountInfo] = useState<any>(null);
  const [facebookLeadFormAccountInfo, setFacebookLeadFormAccountInfo] = useState<any>(null);
  const [pipedriveAccountInfo, setPipedriveAccountInfo] = useState<any>(null);
  const [typeformAccountInfo, setTypeformAccountInfo] = useState<any>(null);
  const [googleFormTreeData, setGoogleFormTreeData] = useState([]);
  const [TypeformTreeData, setTypeFormTreeData] = useState([]);
  const [jotformTreeData, setJotformTreeData] = useState([]);
  const [selectedGoogleFormWorksheets, setSelectedGoogleFormWorksheets] = useState<any[]>([]);
  const [selectedTypeformForms, setSelectedTypeformForms] = useState<any[]>([]);
  const [selectedJotformForms, setSelectedJotformForms] = useState<any[]>([]);
  const [googleFormLeadsSynced, setGoogleFormLeadsSynced] = useState(false);
  const [typeformLeadsSynced, setTypeformLeadsSynced] = useState(false);
  const [jotformLeadsSynced, setJotformLeadsSynced] = useState(false);
  const [showCompletionButtons, setShowCompletionButtons] = useState(false);
  const [autoProgressing, setAutoProgressing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    selectedCrm: initialData.selectedCrm || "",
    adsConnections: initialData.adsConnections || "",
    leadCaptureForms: initialData.leadCaptureForms || "",
    uploadLeads: initialData.uploadLeads || "",
  });
  const supabase = createClient();

  const questions = [
    {
      id: "selectedCrm",
      type: "select",
      question: "Do you use a CRM to manage your leads?",
      options: ["HubSpot", "Pipedrive", "GoHighLevel", "None of these"],
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
      options: ["Google Forms", "Typeform", "Jotform", "None of these"],
    },
    {
      id: "uploadLeads",
      type: "radio",
      question: "Do you want to upload your existing leads via CSV?",
      subtitle: "Importing your current leads means we can start following up immediately. No waiting, no missed opportunities.",
      options: ["Yes", "No"],
    },
  ];

  const filteredQuestions =
    formData.selectedCrm === "HubSpot" || formData.selectedCrm === "Pipedrive" || formData.selectedCrm === "GoHighLevel"
      ? [questions[0], questions[3]]
      : questions;

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const currentValue = formData[currentQuestion?.id as keyof typeof formData];

  useEffect(() => {
    return () => {
      const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
      const savedGoHighLevelStatus = localStorage.getItem("go_high_level_oauth_status");
      const savedPipedriveStatus = localStorage.getItem("pipedrive_oauth_status");
      const savedGoogleFormStatus = localStorage.getItem("google_form_oauth_status");
      const savedGoogleLeadFormStatus = localStorage.getItem("google_lead_form_oauth_status");
      const savedFacebookLeadFormStatus = localStorage.getItem("facebook_lead_form_oauth_status");
      if (
        savedHubspotStatus !== "connecting" &&
        savedGoHighLevelStatus !== "connecting" &&
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

  useEffect(() => {
    if (typeformStatus === "connected") {
      fetchTypeformForms();
    }
  }, [typeformStatus]);
  useEffect(() => {
    if (jotformStatus === "connected") {
      fetchJotformForms();
    }
  }, [jotformStatus]);

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

  const fetchTypeformForms = async () => {
    try {
      const clinicId = await getClinicId();
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/typeform-integration/getSheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          clinic_id: clinicId,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch Typeform forms");

      const data = await response.json();
      setTypeFormTreeData(
        (data.forms || []).map((form: any) => ({
          title: form.title,
          value: form.id,
          isLeaf: true,
        })),
      );
    } catch (error) {
      ErrorToast("Failed to fetch Typeform forms");
      console.error(error);
    }
  };
  const fetchJotformForms = async () => {
    try {
      const clinicId = await getClinicId();
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/jotform-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "get_forms",
          clinic_id: clinicId,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch Jotform forms");

      const data = await response.json();
      setJotformTreeData(
        (data.content || []).map((form: any) => ({
          title: form.title,
          value: form.id,
          isLeaf: true,
        })),
      );
      console.log("Jotform forms fetched:", jotformTreeData);
    } catch (error) {
      ErrorToast("Failed to fetch Typeform forms");
      console.error(error);
    }
  };
  const autoProgressToNext = useCallback(() => {
    if (autoProgressing) return;
    setAutoProgressing(true);
    setTimeout(() => {
      if (currentQuestionIndex < filteredQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setShowHubspotModal(false);
        setShowGoHighLevelModal(false);
        setShowPipedriveModal(false);
        setShowGoogleFormModal(false);
        setShowGoogleLeadFormModal(false);
        setShowFacebookLeadFormModal(false);
      } else {
        const finalData = {
          ...formData,
          hubspotConnected: hubspotStatus === "connected",
          goHighLevelConnected: goHighLevelStatus === "connected",
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
    goHighLevelStatus,
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

  useEffect(() => {
    const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
    const savedGoHighLevelStatus = localStorage.getItem("go_high_level_oauth_status");
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

    if (savedHubspotStatus) setHubspotStatus(savedHubspotStatus as "disconnected" | "connecting" | "connected");
    if (savedGoHighLevelStatus) setGoHighLevelStatus(savedGoHighLevelStatus as "disconnected" | "connecting" | "connected");
    if (savedPipedriveStatus) setPipedriveStatus(savedPipedriveStatus as "disconnected" | "connecting" | "connected");
    if (savedGoogleFormStatus) setGoogleFormStatus(savedGoogleFormStatus as "disconnected" | "connecting" | "connected");
    if (savedGoogleLeadFormStatus) setGoogleLeadFormStatus(savedGoogleLeadFormStatus as "disconnected" | "connecting" | "connected");
    if (savedFacebookLeadFormStatus) setFacebookLeadFormStatus(savedFacebookLeadFormStatus as "disconnected" | "connecting" | "connected");
    if (savedQuestionIndex && !isNaN(Number.parseInt(savedQuestionIndex))) setCurrentQuestionIndex(Number.parseInt(savedQuestionIndex));
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
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "hubspot_success") {
        setHubspotStatus("connected");
        setHubspotAccountInfo(event.data.accountInfo);
        setFormData(prev => ({ ...prev, selectedCrm: "HubSpot" }));
        localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "HubSpot" }));
        autoProgressToNext();
      } else if (event.data.type === "hubspot_error") {
        setHubspotStatus("disconnected");
        ErrorToast(`Connection Failed: ${event.data.error || "Unable to connect to HubSpot. Please try again."}`);
        clearOAuthState();
      } else if (event.data.type === "pipedrive_success") {
        setPipedriveStatus("connected");
        setPipedriveAccountInfo(event.data.accountInfo);
        setFormData(prev => ({ ...prev, selectedCrm: "Pipedrive" }));
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
      } else if (event.data.type === "goHighLevel_success") {
        setGoHighLevelStatus("connected");
        localStorage.setItem("oauth_form_data", JSON.stringify(formData));
        clearOAuthState();
        autoProgressToNext();
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
      const goHighLevelStatus = urlParams.get("go_high_level_status");
      const pipedriveStatus = urlParams.get("pipedrive_status");
      const googleFormStatus = urlParams.get("google_form_status");
      const googleLeadFormStatus = urlParams.get("google_lead_form_status");
      const facebookLeadFormStatus = urlParams.get("facebook_lead_form_status");
      const typeformStatus = urlParams.get("typeform_status");
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
        setFormData(prev => ({ ...prev, selectedCrm: "HubSpot" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (hubspotStatus === "error") {
        console.log("❌ HubSpot OAuth error detected from URL:", errorMessage);
        setHubspotStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (goHighLevelStatus === "success") {
        console.log("✅ GO High Level OAuth success detected from URL");
        setGoHighLevelStatus("connected");
        setFormData(prev => ({ ...prev, selectedCrm: "goHighLevel" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (goHighLevelStatus === "error") {
        console.log("❌ GO High Level OAuth error detected from URL:", errorMessage);
      } else if (pipedriveStatus === "success") {
        console.log("✅ Pipedrive OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: parseInt(dealCount || "0"),
        };
        setPipedriveStatus("connected");
        setPipedriveAccountInfo(accountInfo);
        setFormData(prev => ({ ...prev, selectedCrm: "Pipedrive" }));
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
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (facebookLeadFormStatus === "error") {
        console.log("❌ Facebook Lead Form OAuth error detected from URL:", errorMessage);
        setFacebookLeadFormStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (typeformStatus === "success") {
        console.log("✅ Typeform OAuth success detected from URL");
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };
        setTypeformStatus("connected");
        setTypeformAccountInfo(accountInfo);
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        setShowTypeformModal(true);
      } else if (typeformStatus === "error") {
        console.log("❌ Typeform OAuth error detected from URL:", errorMessage);
        setTypeformStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.log("No OAuth status detected in URL");
      }
    };

    handleOAuthRedirect();
  }, [autoProgressToNext, currentQuestionIndex, filteredQuestions.length, formData]);

  const handleInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, [currentQuestion.id]: value }));
    const updatedFormData = { ...formData, [currentQuestion.id]: value };
    localStorage.setItem("oauth_form_data", JSON.stringify(updatedFormData));

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
      } else if (value === "GoHighLevel") {
        setGoHighLevelStatus("disconnected");
        setShowGoHighLevelModal(true);
        setShowCompletionButtons(true);
      } else if (value === "No CRM") {
        setShowCompletionButtons(true);
        setHubspotStatus("disconnected");
        setPipedriveStatus("disconnected");
        setGoHighLevelStatus("disconnected");
      }
    }

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

    if (currentQuestion.id === "leadCaptureForms") {
      if (value === "Google Forms") {
        setShowGoogleFormModal(true);
        setShowCompletionButtons(true);
      } else if (value === "Typeform") {
        setShowTypeformModal(true);
        setShowCompletionButtons(true);
      } else if (value === "Jotform") {
        setShowJotformModal(true);
        setShowCompletionButtons(true);
      } else {
        setShowCompletionButtons(true);
      }
    }

    if (currentQuestion.id === "uploadLeads") {
      if (value === "Yes") {
        setTimeout(() => setShowManualLeadsModal(true), 500);
      }
      setShowCompletionButtons(true);
    }
  };

  const handleNext = () => {
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
      } 
      else if(currentValue==="GoHighLevel"&& goHighLevelStatus!=="connected"){
        setShowGoHighLevelModal(true);
        return;
      }
      else if (currentValue === "No CRM") {
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
      if (currentValue === "Google Forms") {
        setShowGoogleFormModal(true);
        setShowCompletionButtons(true);
      } else if (currentValue === "Typeform") {
        setShowTypeformModal(true);
        setShowCompletionButtons(true);
      } else if (currentValue === "Jotform") {
        setShowJotformModal(true);
        setShowCompletionButtons(true);
      } else {
        setShowCompletionButtons(true);
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
        goHighLevelConnected: goHighLevelStatus === "connected",
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
            {q.id === "selectedCrm"  && value === "GoHighLevel" && goHighLevelStatus === "connected" && (
              <div className="mt-2 p-2 bg-green-100 rounded-lg">
                <Text className="text-green-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to Go High 
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
                  <Text className="text-white font-bold text-sm">P</Text>
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
          {currentQuestion.id === "selectedCrm" && currentValue === "GoHighLevel" && (
            <Card className="rounded-xl bg-orange-50 border-2 border-orange-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white font-bold text-sm">H</Text>
                </div>
                <Text className="text-lg font-semibold text-orange-900">Connect your Go High Level CRM!</Text>
              </div>
              <Text className="text-orange-900 text-base leading-6">
                Great! We can connect your Go High Level CRM directly to automatically sync your leads, contacts, and deals with our
                platform for seamless workflows.
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
          {currentQuestion.subtitle && <Text className="text-gray-600 text-sm mb-4 block">{currentQuestion.subtitle}</Text>}
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
          Every lead has a short shelf life. If they sit unseen in an inbox, the odds of booking them drop fast - and usually to zero.
          Connecting your CRM here ensures we can follow up right away, while interest is highest.
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
              {currentQuestionIndex < filteredQuestions.length - 1 ? "Continue" : "Continue"}
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
                  : "Continue"
                : "Continue"}
            </Button>
          </div>
        )}
      </div>

      <HubspotModal
        open={showHubspotModal}
        status={hubspotStatus}
        accountInfo={hubspotAccountInfo}
        onOk={() => {
          if (hubspotStatus === "connected") {
            setShowHubspotModal(false);
            autoProgressToNext();
          } else {
            setShowHubspotModal(false);
            setShowCompletionButtons(false);
            setHubspotStatus("disconnected");
            setFormData(prev => ({ ...prev, selectedCrm: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
          }
        }}
        onCancel={() => {
          setShowHubspotModal(false);
          setShowCompletionButtons(false);
          setHubspotStatus("disconnected");
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        onConnect={connectToHubSpot}
      />
      <GoHighLevelLeadFormModal
        open={showGoHighLevelModal}
        status={goHighLevelStatus}
        // accountInfo={hubspotAccountInfo}
        onOk={() => {
          if (goHighLevelStatus === "connected") {
            setShowGoHighLevelModal(false);
            autoProgressToNext();
          } else {
            setShowGoHighLevelModal(false);
            setShowCompletionButtons(false);
            setGoHighLevelStatus("disconnected");
            setFormData(prev => ({ ...prev, selectedCrm: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
          }
        }}
        onCancel={() => {
          setShowGoHighLevelModal(false);
          setShowCompletionButtons(false);
          setGoHighLevelStatus("disconnected");
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        onConnect={connectToGHL}
      />
      <PipedriveModal
        open={showPipedriveModal}
        status={pipedriveStatus}
        accountInfo={pipedriveAccountInfo}
        onOk={() => {
          if (pipedriveStatus === "connected") {
            setShowPipedriveModal(false);
            autoProgressToNext();
          } else {
            setShowPipedriveModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, selectedCrm: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
          }
        }}
        onCancel={() => {
          setShowPipedriveModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        onConnect={connectToPipedrive}
        onSyncLeads={syncPipedriveLeads}
        onDisconnect={() => {
          setPipedriveStatus("disconnected");
          setPipedriveAccountInfo(null);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
      />

      <GoogleFormModal
        open={showGoogleFormModal}
        status={googleFormStatus}
        accountInfo={googleFormAccountInfo}
        treeData={googleFormTreeData}
        selectedWorksheets={selectedGoogleFormWorksheets}
        onSelectWorksheets={setSelectedGoogleFormWorksheets}
        onOk={() => {
          if (googleFormStatus === "connected" && selectedGoogleFormWorksheets.length > 0 && googleFormLeadsSynced) {
            setShowGoogleFormModal(false);
            autoProgressToNext();
          } else {
            setShowGoogleFormModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
          }
        }}
        onCancel={() => {
          setShowGoogleFormModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
        }}
        onConnect={connectToGoogleForm}
        onSyncLeads={async () => {
          const selectedSheetsObjects = await selectedGoogleFormWorksheets
            .map(value => findSheetDetails(googleFormTreeData, value))
            .filter(Boolean);
          syncGoogleFormLeads(selectedSheetsObjects);
          setGoogleFormLeadsSynced(true);
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Google Forms" }));
          setShowGoogleFormModal(false);
          autoProgressToNext();
        }}
        onDisconnect={() => {
          setGoogleFormStatus("disconnected");
          setGoogleFormAccountInfo(null);
        }}
      />

      <GoogleLeadFormModal
        open={showGoogleLeadFormModal}
        status={googleLeadFormStatus}
        accountInfo={googleLeadFormAccountInfo}
        onOk={() => {
          if (googleLeadFormStatus === "connected") {
            setShowGoogleLeadFormModal(false);
            autoProgressToNext();
          } else {
            setShowGoogleLeadFormModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, adsConnections: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
          }
        }}
        onCancel={() => {
          setShowGoogleLeadFormModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, adsConnections: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
        }}
        onConnect={async () => {
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
        }}
        onSyncLeads={syncGoogleLeadFormLeads}
        onDisconnect={() => {
          setGoogleLeadFormStatus("disconnected");
          setGoogleLeadFormAccountInfo(null);
        }}
      />

      <FacebookLeadFormModal
        open={showFacebookLeadFormModal}
        status={facebookLeadFormStatus}
        accountInfo={facebookLeadFormAccountInfo}
        onOk={() => {
          if (facebookLeadFormStatus === "connected") {
            setShowFacebookLeadFormModal(false);
            autoProgressToNext();
          } else {
            setShowFacebookLeadFormModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, adsConnections: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
          }
        }}
        onCancel={() => {
          setShowFacebookLeadFormModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, adsConnections: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
        }}
        onConnect={async () => {
          localStorage.setItem("oauth_form_data", JSON.stringify(formData));
          window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${await getClinicId()}`;
        }}
      />

      <TypeformModal
        open={showTypeformModal}
        status={typeformStatus}
        accountInfo={typeformAccountInfo}
        treeData={TypeformTreeData}
        selectedForms={selectedTypeformForms}
        onSelectForms={setSelectedTypeformForms}
        onOk={() => {
          if (typeformStatus === "connected" && typeformLeadsSynced) {
            setShowTypeformModal(false);
            autoProgressToNext();
          } else {
            setShowTypeformModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
          }
        }}
        onCancel={() => {
          setShowTypeformModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
        }}
        onConnect={connectToTypeform}
        onSyncLeads={() => {
          syncTypeformLeads(selectedTypeformForms);
          setTypeformLeadsSynced(true);
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Typeform" }));
          setShowTypeformModal(false);
          autoProgressToNext();
        }}
        onDisconnect={() => {
          setTypeformStatus("disconnected");
          setTypeformAccountInfo(null);
        }}
      />
      <JotformModal
        open={showJotformModal}
        status={jotformStatus}
        treeData={jotformTreeData}
        selectedForms={selectedJotformForms}
        onSelectForms={setSelectedJotformForms}
        onConnect={async (token: any) => {
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Jotform" }));
          const res = await createJotformConnection(await getClinicId(), token);
          console.log(res);
          if (!res) {
            ErrorToast("Failed to connect to Jotform. Please try again.");
            return;
          }
          SuccessToast("Jotform connected successfully");
          setJotformStatus("connected");
        }}
        onSyncLeads={() => {
          syncJotformLeads(selectedJotformForms);
          setJotformLeadsSynced(true);
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Jotform" }));
          setShowJotformModal(false);
          autoProgressToNext();
        }}
        onOk={() => {
          if (jotformStatus === "connected" && jotformLeadsSynced) {
            setShowJotformModal(false);
            autoProgressToNext();
          } else {
            setShowJotformModal(false);
            setShowCompletionButtons(false);
            setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
            localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
          }
        }}
        onCancel={() => {
          setShowTypeformModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
        }}
        // onSyncLeads={() => {
        //   syncTypeformLeads(selectedTypeformForms);
        //   setTypeformLeadsSynced(true);
        //   localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Typeform" }));
        //   setShowTypeformModal(false);
        //   autoProgressToNext();
        // }}
        onDisconnect={() => {
          setJotformStatus("disconnected");
        }}
      />
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

      <CustomCrmModal
        open={showCustomCrmModal}
        onOk={() => setShowCustomCrmModal(false)}
        onCancel={() => {
          setShowCustomCrmModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
        }}
      />
    </div>
  );
}
