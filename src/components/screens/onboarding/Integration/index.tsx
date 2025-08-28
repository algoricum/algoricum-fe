"use client";

import { useState, useEffect, useCallback } from "react";
import { Button,  Typography } from "antd";
import { IntegrationsStepProps, FormData } from "../../../../app/types/types";
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
  connectToNextHealth,
  connnectToGravityForm,
  connectToGoogleLeadForm,
  fetchGoogleFormSheets,
  fetchTypeformForms,
  fetchJotformForms,
  handleInput,
  handle_Next,
} from "../../../../utils/integration-utils";

import { SUPABASE_URL, ONBOARDING_LEADS_FILE_NAME } from "../../../../constants/integration-constants";
import { questions } from "@/constants";
const { Title } = Typography;
import {PreviousQuestions} from './PreviousQuestions';
import CurrentInput from "./CurrentInput";
import IntegrationsModals from "./IntegrationModals";




export default function IntegrationsStep({ onNext, onPrev, initialData = {}, isSubmitting = false }: IntegrationsStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [showGoHighLevelModal, setShowGoHighLevelModal] = useState(false);
  const [showNexHealthModal, setShowNexHealthModal] = useState(false);
  const [showGravityFormModal, setShowGravityFormModal] = useState(false);
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
  const [nextHealthStatus, setNextHealthStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [gravityFormStatus, setGravityFormStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
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


  const filteredQuestions =
    formData.selectedCrm === "HubSpot" ||
    formData.selectedCrm === "Pipedrive" ||
    formData.selectedCrm === "GoHighLevel" ||
    formData.selectedCrm === "NextHealth"
      ? [questions[0], questions[3]]
      : questions;

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const currentValue = formData[currentQuestion?.id as keyof typeof formData];

  useEffect(() => {
    return () => {
      const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
      const savedGoHighLevelStatus = localStorage.getItem("go_high_level_oauth_status");
      const savedNextHealthStatus = localStorage.getItem("next_health_oauth_status");
      const savedGravityFormStatus = localStorage.getItem("gravity_form_oauth_status");
      const savedPipedriveStatus = localStorage.getItem("pipedrive_oauth_status");
      const savedGoogleFormStatus = localStorage.getItem("google_form_oauth_status");
      const savedGoogleLeadFormStatus = localStorage.getItem("google_lead_form_oauth_status");
      const savedFacebookLeadFormStatus = localStorage.getItem("facebook_lead_form_oauth_status");
      if (
        savedHubspotStatus !== "connecting" &&
        savedGoHighLevelStatus !== "connecting" &&
        savedNextHealthStatus !== "connecting" &&
        savedGravityFormStatus !== "connecting" &&
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
      fetchGoogleFormSheets(setGoogleFormTreeData);
    }
  }, [googleFormStatus]);

  useEffect(() => {
    if (typeformStatus === "connected") {
      fetchTypeformForms(setTypeFormTreeData);
    }
  }, [typeformStatus]);
  useEffect(() => {
    if (jotformStatus === "connected") {
      fetchJotformForms(setJotformTreeData);
    }
  }, [jotformStatus]);

  const autoProgressToNext = useCallback(() => {
    if (autoProgressing) return;
    setAutoProgressing(true);
    setTimeout(() => {
      if (currentQuestionIndex < filteredQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setShowHubspotModal(false);
        setShowGoHighLevelModal(false);
        setShowNexHealthModal(false);
        setShowPipedriveModal(false);
        setShowGoogleFormModal(false);
        setShowGoogleLeadFormModal(false);
        setShowFacebookLeadFormModal(false);
      } else {
        const finalData = {
          ...formData,
          hubspotConnected: hubspotStatus === "connected",
          goHighLevelConnected: goHighLevelStatus === "connected",
          nextHealthConnected: nextHealthStatus === "connected",
          gravityFormConnected: gravityFormStatus === "connected",
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
    nextHealthStatus,
    gravityFormStatus,
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
    const savedNextHealthStatus = localStorage.getItem("next_health_oauth_status");
    const savedGravityFormStatus = localStorage.getItem("gravity_form_oauth_status");
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
    if (savedNextHealthStatus) setNextHealthStatus(savedNextHealthStatus as "disconnected" | "connecting" | "connected");
    if (savedGravityFormStatus) setGravityFormStatus(savedGravityFormStatus as "disconnected" | "connecting" | "connected");
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
    const handleOAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hubspotStatus = urlParams.get("hubspot_status");
      const goHighLevelStatus = urlParams.get("go_high_level_status");
      const nextHealthStatus = urlParams.get("next_health_status");
      const gravityFormStatus = urlParams.get("gravity_form_status");
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
      } else if (nextHealthStatus === "success") {
        console.log("✅ NextHealth OAuth success detected from URL");
        setNextHealthStatus("connected");
        setFormData(prev => ({ ...prev, selectedCrm: "NextHealth" }));
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (nextHealthStatus === "error") {
        console.log("❌ NextHealth OAuth error detected from URL:", errorMessage);
        setNextHealthStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (gravityFormStatus === "success") {
        console.log("✅ Gravity Form OAuth success detected from URL");
        setFormData(prev => ({ ...prev, leadCaptureForms: "Gravity Forms" }));
        setGravityFormStatus("connected");

        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
        autoProgressToNext();
      } else if (gravityFormStatus === "error") {
        console.log("❌ Gravity Form OAuth error detected from URL:", errorMessage);
        setGravityFormStatus("disconnected");
        clearOAuthState();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.log("No OAuth status detected in URL");
      }
    };

    handleOAuthRedirect();
  }, [autoProgressToNext, currentQuestionIndex, filteredQuestions.length, formData]);

  const handleInputChange = (value: any) => {
 handleInput({
    value,
    currentQuestion,
    formData,
    setFormData,
    clearOAuthState,
    setHubspotStatus,
    setPipedriveStatus,
    setGoHighLevelStatus,
    setNextHealthStatus,
    setShowHubspotModal,
    setShowPipedriveModal,
    setShowGoHighLevelModal,
    setShowNexHealthModal,
    setShowFacebookLeadFormModal,
    setShowGoogleLeadFormModal,
    setShowGoogleFormModal,
    setShowTypeformModal,
    setShowJotformModal,
    setShowGravityFormModal,
    setShowManualLeadsModal,
    setShowCompletionButtons,
  })
  };

  const handleNext = () => {
    handle_Next({
    currentQuestion,
    currentValue,
    currentQuestionIndex,
    filteredQuestions,
    formData,
    setFormData,
    hubspotStatus,
    pipedriveStatus,
    goHighLevelStatus,
    nextHealthStatus,
    gravityFormStatus,
    googleFormStatus,
    googleLeadFormStatus,
    facebookLeadFormStatus,
    setShowHubspotModal,
    setShowPipedriveModal,
    setShowGoHighLevelModal,
    setShowNexHealthModal,
    setShowFacebookLeadFormModal,
    setShowGoogleLeadFormModal,
    setShowGoogleFormModal,
    setShowTypeformModal,
    setShowJotformModal,
    setShowGravityFormModal,
    setShowCompletionButtons,
    setCurrentQuestionIndex,
    hubspotAccountInfo,
    pipedriveAccountInfo,
    googleFormAccountInfo,
    googleLeadFormAccountInfo,
    facebookLeadFormAccountInfo,
    onNext,
  })
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
        {
          <PreviousQuestions
            filteredQuestions={filteredQuestions}
            currentQuestionIndex={currentQuestionIndex}
            formData={formData}
            hubspotStatus={hubspotStatus}
            hubspotAccountInfo={hubspotAccountInfo}
            pipedriveStatus={pipedriveStatus}
            pipedriveAccountInfo={pipedriveAccountInfo}
            goHighLevelStatus={goHighLevelStatus}
            nextHealthStatus={nextHealthStatus}
            googleFormStatus={googleFormStatus}
            googleFormAccountInfo={googleFormAccountInfo}
            googleLeadFormStatus={googleLeadFormStatus}
            googleLeadFormAccountInfo={googleLeadFormAccountInfo}
            facebookLeadFormStatus={facebookLeadFormStatus}
            facebookLeadFormAccountInfo={facebookLeadFormAccountInfo}
            ONBOARDING_LEADS_FILE_NAME={ONBOARDING_LEADS_FILE_NAME}
          />
        }
        <Title level={3} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          {currentQuestion?.question}
        </Title>

        {
          <CurrentInput
            currentQuestion={currentQuestion}
            currentValue={currentValue}
            handleInputChange={handleInputChange}
            isSubmitting={isSubmitting}
          />
        }

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
      <IntegrationsModals
        //hubspot
        showHubspotModal={showHubspotModal}
        hubspotStatus={hubspotStatus}
        hubspotAccountInfo={hubspotAccountInfo}
        onHubspotConnect={connectToHubSpot}
        onHubspotOk={() => {
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
        onHubspotCancel={() => {
          setShowHubspotModal(false);
          setShowCompletionButtons(false);
          setHubspotStatus("disconnected");
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        //goHighLevel
        showGoHighLevelModal={showGoHighLevelModal}
        goHighLevelStatus={goHighLevelStatus}
        onGoHighLevelConnect={connectToGHL}
        onGoHighLevelOk={() => {
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
        onGoHighLevelCancel={() => {
          setShowGoHighLevelModal(false);
          setShowCompletionButtons(false);
          setGoHighLevelStatus("disconnected");
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        //PipeDrive
        showPipedriveModal={showPipedriveModal}
        pipedriveStatus={pipedriveStatus}
        pipedriveAccountInfo={pipedriveAccountInfo}
        onPipedriveConnect={connectToPipedrive}
        onPipedriveSyncLeads={syncPipedriveLeads}
        onPipedriveDisconnect={() => {
          setPipedriveStatus("disconnected");
          setPipedriveAccountInfo(null);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
        onPipedriveOk={() => {
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
        onPipedriveCancel={() => {
          setShowPipedriveModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
          localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, selectedCrm: "" }));
        }}
       
 // Google Forms
  showGoogleFormModal={showGoogleFormModal}
  googleFormStatus={googleFormStatus}
  googleFormAccountInfo={googleFormAccountInfo}
  googleFormTreeData={googleFormTreeData}
  selectedGoogleFormWorksheets={selectedGoogleFormWorksheets}
  onSelectGoogleFormWorksheets={setSelectedGoogleFormWorksheets}
  onGoogleFormConnect={connectToGoogleForm}
  onGoogleFormOk={() => {
    if (googleFormStatus === "connected" && selectedGoogleFormWorksheets.length > 0 && googleFormLeadsSynced) {
      setShowGoogleFormModal(false);
      autoProgressToNext();
    } else {
      setShowGoogleFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    }
  }}
  onGoogleFormCancel={() => {
    setShowGoogleFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "" }));
  }}
  onGoogleFormSyncLeads={async () => {
    const selectedSheetsObjects = await selectedGoogleFormWorksheets
      .map(value => findSheetDetails(googleFormTreeData, value))
      .filter(Boolean);
    syncGoogleFormLeads(selectedSheetsObjects);
    setGoogleFormLeadsSynced(true);
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, leadCaptureForms: "Google Forms" }));
    setShowGoogleFormModal(false);
    autoProgressToNext();
  }}
  onGoogleFormDisconnect={() => {
    setGoogleFormStatus("disconnected");
    setGoogleFormAccountInfo(null);
  }}


  
  // Google Lead Form
  showGoogleLeadFormModal={showGoogleLeadFormModal}
  googleLeadFormStatus={googleLeadFormStatus}
  googleLeadFormAccountInfo={googleLeadFormAccountInfo}
  onGoogleLeadFormConnect={connectToGoogleLeadForm}
  onGoogleLeadFormOk={() => {
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
  onGoogleLeadFormCancel={() => {
    setShowGoogleLeadFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, adsConnections: "" }));
    localStorage.setItem("oauth_form_data", JSON.stringify({ ...formData, adsConnections: "" }));
  }}
  onGoogleLeadFormSyncLeads={syncGoogleLeadFormLeads}
  onGoogleLeadFormDisconnect={() => {
    setGoogleLeadFormStatus("disconnected");
    setGoogleLeadFormAccountInfo(null);
  }}

  // Facebook Lead Form
  showFacebookLeadFormModal={showFacebookLeadFormModal}
  facebookLeadFormStatus={facebookLeadFormStatus}
  facebookLeadFormAccountInfo={facebookLeadFormAccountInfo}
  onFacebookLeadFormConnect={async () => {
    localStorage.setItem("oauth_form_data", JSON.stringify(formData));
    window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${await getClinicId()}`;
  }}
  onFacebookLeadFormOk={() => {
    if (facebookLeadFormStatus === "connected") {
      setShowFacebookLeadFormModal(false);
      autoProgressToNext();
    } else {
      setShowFacebookLeadFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({ ...prev, adsConnections: "" }));
      localStorage.setItem(
        "oauth_form_data",
        JSON.stringify({ ...formData, adsConnections: "" })
      );
    }
  }}
  onFacebookLeadFormCancel={() => {
    setShowFacebookLeadFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, adsConnections: "" }));
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, adsConnections: "" })
    );
  }}

  // Typeform
  showTypeformModal={showTypeformModal}
  typeformStatus={typeformStatus}
  typeformAccountInfo={typeformAccountInfo}
  typeformTreeData={TypeformTreeData}
  selectedTypeformForms={selectedTypeformForms}
  onSelectTypeformForms={setSelectedTypeformForms}
  onTypeformConnect={connectToTypeform}
  onTypeformOk={() => {
    if (typeformStatus === "connected" && typeformLeadsSynced) {
      setShowTypeformModal(false);
      autoProgressToNext();
    } else {
      setShowTypeformModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    }
  }}
  onTypeformCancel={() => {
    setShowTypeformModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, leadCaptureForms: "" })
    );
  }}
  onTypeformSyncLeads={() => {
    syncTypeformLeads(selectedTypeformForms);
    setTypeformLeadsSynced(true);
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, leadCaptureForms: "Typeform" })
    );
    setShowTypeformModal(false);
    autoProgressToNext();
  }}
  onTypeformDisconnect={() => {
    setTypeformStatus("disconnected");
    setTypeformAccountInfo(null);
  }}

  // Jotform
showJotformModal={showJotformModal}
jotformStatus={jotformStatus}
jotformTreeData={jotformTreeData}
selectedJotformForms={selectedJotformForms}
onSelectJotformForms={setSelectedJotformForms}
onJotformConnect={async (token: any) => {
  localStorage.setItem(
    "oauth_form_data",
    JSON.stringify({ ...formData, leadCaptureForms: "Jotform" })
  );
  const res = await createJotformConnection(await getClinicId(), token);
  console.log(res);
  if (!res) {
    ErrorToast("Failed to connect to Jotform. Please try again.");
    return;
  }
  SuccessToast("Jotform connected successfully");
  setJotformStatus("connected");
}}
onJotformSyncLeads={() => {
  syncJotformLeads(selectedJotformForms);
  setJotformLeadsSynced(true);
  localStorage.setItem(
    "oauth_form_data",
    JSON.stringify({ ...formData, leadCaptureForms: "Jotform" })
  );
  setShowJotformModal(false);
  autoProgressToNext();
}}
onJotformOk={() => {
  if (jotformStatus === "connected" && jotformLeadsSynced) {
    setShowJotformModal(false);
    autoProgressToNext();
  } else {
    setShowJotformModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, leadCaptureForms: "" })
    );
  }
}}
onJotformCancel={() => {
  setShowJotformModal(false);
  setShowCompletionButtons(false);
  setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
  localStorage.setItem(
    "oauth_form_data",
    JSON.stringify({ ...formData, leadCaptureForms: "" })
  );
}}
onJotformDisconnect={() => {
  setJotformStatus("disconnected");
}}

// Csv Upload
        showManualLeadsModal={showManualLeadsModal}
        onCsvUploadOk={leads => {
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
        onCsvUploadCancel={() => setShowManualLeadsModal(false)}

        // Custom CRM
        showCustomCrmModal={showCustomCrmModal}
        onCustomCrmOk={() => setShowCustomCrmModal(false)}
        onCustomCrmCancel={() => {
          setShowCustomCrmModal(false);
          setShowCompletionButtons(false);
          setFormData(prev => ({ ...prev, selectedCrm: "" }));
        }}

        
  // NexHealth
  showNexHealthModal={showNexHealthModal}
  nextHealthStatus={nextHealthStatus}
  onNexHealthConnect={(token:any)=>connectToNextHealth(token)}
  onNexHealthOk={() => {
    if (nextHealthStatus === "connected") {
      setShowNexHealthModal(false);
      autoProgressToNext();
    } else {
      setShowNexHealthModal(false);
      setShowCompletionButtons(false);
      setNextHealthStatus("disconnected");
      setFormData(prev => ({ ...prev, selectedCrm: "" }));
      localStorage.setItem(
        "oauth_form_data",
        JSON.stringify({ ...formData, selectedCrm: "" })
      );
    }
  }}
  onNexHealthCancel={() => {
    setShowNexHealthModal(false);
    setShowCompletionButtons(false);
    setNextHealthStatus("disconnected");
    setFormData(prev => ({ ...prev, selectedCrm: "" }));
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, selectedCrm: "" })
    );
  }}

  // Gravity Form
  showGravityFormModal={showGravityFormModal}
  gravityFormStatus={gravityFormStatus}
  onGravityFormConnect={(token:any)=>connnectToGravityForm(token)}
  onGravityFormOk={() => {
    if (gravityFormStatus === "connected") {
      setShowGravityFormModal(false);
      autoProgressToNext();
    } else {
      setShowGravityFormModal(false);
      setShowCompletionButtons(false);
      setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
      localStorage.setItem(
        "oauth_form_data",
        JSON.stringify({ ...formData, leadCaptureForms: "" })
      );
    }
  }}
  onGravityFormCancel={() => {
    setShowGravityFormModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({ ...prev, leadCaptureForms: "" }));
    localStorage.setItem(
      "oauth_form_data",
      JSON.stringify({ ...formData, leadCaptureForms: "" })
    );
  }}
  onGravityFormDisconnect={() => {
    setGravityFormStatus("disconnected");
  }}
        // ... pass the rest for other modals
      />
     
    </div>
  );
}
