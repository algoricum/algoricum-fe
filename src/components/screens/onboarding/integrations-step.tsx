"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Radio, Card, Space, Select, Typography, Modal, Alert, Spin, Form } from "antd";
import { CheckCircleOutlined, LinkOutlined, ThunderboltOutlined, CalendarOutlined } from "@ant-design/icons";
import { getUserData } from "@/utils/supabase/user-helper";
import { createClient } from "@/utils/supabase/config/client";
import { SuccessToast, ErrorToast, InfoToast, WarningToast } from "@/helpers/toast";
import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import CsvUploadModal from "@/components/common/CSV/CsvUploadModal";
import Papa from 'papaparse'
const { Option } = Select;
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
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [zapierStatus, setZapierStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hubspotAccountInfo, setHubspotAccountInfo] = useState<any>(null);
  const [zapierAccountInfo, setZapierAccountInfo] = useState<any>(null);
  const [zapierForm] = Form.useForm();
  const [autoProgressing, setAutoProgressing] = useState(false);
  // const [hubspotPrompted, setHubspotPrompted] = useState(false);
  const [showCustomCrmModal, setShowCustomCrmModal] = useState(false);
  // const [csvValidationError, setCsvValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    usesHubspot: initialData.usesHubspot || "",
    otherTools: initialData.otherTools || "",
    uploadLeads: initialData.uploadLeads || "", // New field for file upload
  });
  const supabase = createClient();
  const [showCompletionButtons, setShowCompletionButtons] = useState(false);

  const getClinicId = async () => {
    const clinic = await getClinicData();

    if (!clinic || !clinic?.id) {
      return null;
    } else {
      return clinic.id;
    }
  };

  const questions = [
    {
      id: "usesHubspot",
      type: "radio",
      question: "Do you use HubSpot as your CRM?",
      options: ["Yes", "No"],
    },
    {
      id: "otherTools",
      type: "multiselect",
      question: "Do you use other CRM or form tools?",
      options: [
        "Jotform",
        "Typeform",
        "Gravity Forms",
        "Google Forms",
        "Squarespace Forms",
        "WPForms",
        "Tally",
        "Formstack",
        "Wufoo",
        "Formidable forms",
        "SurveyMonkey",
        "Microsoft Forms",
        "Paperform",
        "Cognito Forms",
        "Zoho forms",
        "123 formbuilder",
        "Airtable forms",
        "Formsite",
        "Ninja forms",
        "Quform",
        "HubSpot",
        "Pipedrive",
        "Zoho CRM",
        "Salesforce sales cloud",
        "Agile CRM",
        "Keap (Infusionsoft)",
        "Nimble",
        "Monday CRM",
        "Close",
        "Copper (formerly ProsperWorks)",
        "Nutshell",
        "Ontraport",
        "Bigin by Zoho",
        "EngageBay",
        "Vcita",
        "Drip",
        "ActiveCampaign",
        "Bitrix24",
        "Salesflare",
        "Capsule CRM",
        "Squarespace",
        "Wix",
        "Webflow",
        "Weebly",
        "Shopify",
        "Unbounce",
        "Leadpages",
        "ClickFunnels",
        "Elementor Forms",
        "Instapage",
        "Unable to find my CRM",
      ],
    },
    {
      id: "uploadLeads",
      type: "radio",
      question: "Do you want to upload your existing leads via CSV?",
      options: ["Yes", "No"],
    },
  ];

  // Filter questions based on HubSpot answer
  const filteredQuestions = questions.filter(q => {
    if ((q.id === "otherTools" || q.id === "uploadLeads") && formData.usesHubspot === "Yes") {
      return false; // Skip "otherTools" if HubSpot is Yes
    }
    return true;
  });

  const currentQuestion = filteredQuestions[currentQuestionIndex];

  const currentValue = formData[currentQuestion?.id as keyof typeof formData];

  const handleCsvUpload = async (leadsData:any) => {
    try {
      if (!leadsData) {
        WarningToast("No CSV file selected");
      }

      // Get current user
      const user = await getUserData();
      if (!user) {
        throw new Error("User not found. Please log in again.");
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `leads-${user.id}-${timestamp}.csv`;

      // Create file path: user_id/filename.csv
      const filePath = `${user.id}/${fileName}`;
      
      let csvData;
      if(Array.isArray(leadsData)){
        csvData=Papa.unparse(leadsData)   
      }else{
        csvData=leadsData
      }
      // Upload file directly to Supabase Storage
      const { error } = await supabase.storage.from("lead-uploads").upload(filePath, csvData, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload CSV: ${error.message}`);
      }

      localStorage.setItem(ONBOARDING_LEADS_FILE_NAME, filePath);
    } catch (error) {
      console.error("Error uploading CSV:", error);
    }
  };

  const SUPABASE_URL = "https://eypitkzntyiyvwrndkgy.supabase.co";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const autoProgressToNext = useCallback(() => {
    if (autoProgressing) return;
    setAutoProgressing(true);
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setShowHubspotModal(false);
      } else {
        const finalData = {
          ...formData,
          usesHubspot: "Yes",
          hubspotConnected: true,
          hubspotAccountInfo,
        };
        onNext(finalData);
      }
      setAutoProgressing(false);
    }, 1500);
  }, [
    autoProgressing,
    currentQuestionIndex,
    questions.length,
    setCurrentQuestionIndex,
    setShowHubspotModal,
    formData,
    hubspotAccountInfo,
    onNext,
  ]);

  // Restore state from localStorage on component mount
  useEffect(() => {
    // if (JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_STEPS_KEY) || "[]").includes(6)) {
    // setCurrentQuestionIndex(filteredQuestions.length - 1);
    // }

    // Restore OAuth state if it exists
    const savedHubspotStatus = localStorage.getItem("hubspot_oauth_status");
    const savedQuestionIndex = localStorage.getItem("hubspot_oauth_question_index");
    const savedFormData = localStorage.getItem("hubspot_oauth_form_data");
    const savedAccountInfo = localStorage.getItem("hubspot_oauth_account_info");

    if (savedHubspotStatus) {
      setHubspotStatus(savedHubspotStatus as "disconnected" | "connecting" | "connected");
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
    if (savedAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(savedAccountInfo);
        setHubspotAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error("Error parsing saved account info:", error);
      }
    }
  }, []);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === "hubspot_success") {
        setHubspotStatus("connected");
        setHubspotAccountInfo(event.data.accountInfo);

        // Update form data
        setFormData(prevFormData => ({
          ...prevFormData,
          usesHubspot: "Yes",
        }));

        // Clear saved OAuth state
        clearOAuthState();

        // Auto-progress to next question
        autoProgressToNext();
      } else if (event.data.type === "hubspot_error") {
        setHubspotStatus("disconnected");
        ErrorToast(`
 message: "Connection Failed",
 description: ${event.data.error} || "Unable to connect to HubSpot. Please try again.",
 `);
        clearOAuthState();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentQuestionIndex, formData, hubspotAccountInfo, onNext, autoProgressing, autoProgressToNext]);

  // Handle OAuth callback if code parameter is present
  useEffect(() => {
    const handleOAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hubspotStatus = urlParams.get("hubspot_status");
      const errorMessage = urlParams.get("error_message");
      const accountName = urlParams.get("account_name");
      const contactCount = urlParams.get("contact_count");

      if (hubspotStatus === "success") {
        console.log("✅ HubSpot OAuth success detected from URL");

        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: 0,
        };

        setHubspotStatus("connected");
        setHubspotAccountInfo(accountInfo);
        setFormData(prevFormData => ({
          ...prevFormData,
          usesHubspot: "Yes",
        }));

        clearOAuthState();

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Auto-progress to next question
        autoProgressToNext();
      } else if (hubspotStatus === "error") {
        console.log("❌ HubSpot OAuth error detected from URL:", errorMessage);

        setHubspotStatus("disconnected");
        clearOAuthState();

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthRedirect();
  }, [autoProgressToNext]);

  const getCurrentUserId = async () => {
    const user = await getUserData();
    return user?.id;
  };

  const clearOAuthState = () => {
    localStorage.removeItem("hubspot_oauth_status");
    localStorage.removeItem("hubspot_oauth_question_index");
    localStorage.removeItem("hubspot_oauth_form_data");
    localStorage.removeItem("hubspot_oauth_account_info");
  };

  const saveOAuthState = () => {
    localStorage.setItem("hubspot_oauth_status", "connecting");
    localStorage.setItem("hubspot_oauth_question_index", currentQuestionIndex.toString());
    localStorage.setItem("hubspot_oauth_form_data", JSON.stringify(formData));
    if (hubspotAccountInfo) {
      localStorage.setItem("hubspot_oauth_account_info", JSON.stringify(hubspotAccountInfo));
    }
  };

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    if (currentQuestion.id === "usesHubspot") {
      if (value === "Yes") {
        setShowHubspotModal(true);
        setShowCompletionButtons(true);
      } else if (value === "No") {
        setShowCompletionButtons(false);
      }
    }

    if (currentQuestion.id === "otherTools" && value && value.length > 0) {
      const selectedTools = value.split(",").filter((s: string) => s);
      if (selectedTools.includes("Unable to find my CRM")) {
        setTimeout(() => {
          setShowCustomCrmModal(true);
        }, 500);
      }
      // Only show Zapier modal if 'Unable to find my CRM' is NOT selected
      else if (selectedTools.length > 0) {
        setTimeout(() => {
          setShowZapierModal(true);
        }, 2500); // Delay for UX
      }
    }

    // Handle file upload question
    if (currentQuestion.id === "uploadLeads") {
      if (value === "Yes") {
        setTimeout(() => {
          setShowManualLeadsModal(true);
        }, 500); // Small delay for better UX
      }
    }

    //show onboarding completion buttons
    if (currentQuestion.id === "uploadLeads") {
      if (value === "Yes" || value === "No") {
        setShowCompletionButtons(true);
      }
    }
  };

  const connectToHubSpot = async () => {
    setHubspotStatus("connecting");
    saveOAuthState();
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
          redirectUrl: window.location.href, // Current page URL
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

      // Simple redirect - no popup!
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Connection failed:", error);
      setHubspotStatus("disconnected");
      ErrorToast(`
 message: "Connection Failed",
 description: ${error instanceof Error ? error.message : "Unable to connect to HubSpot. Please try again"},
 `);
    }
  };

  // Keep the message listener for popup communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // For security, you can check the origin if needed:
      // if (!event.origin.includes('supabase.co')) return;

      console.log("Received message:", event.data); // Debug log

      if (event.data.type === "hubspot_success") {
        setHubspotStatus("connected");
        setHubspotAccountInfo(event.data.accountInfo);

        setFormData(prevFormData => ({
          ...prevFormData,
          usesHubspot: "Yes",
        }));

        clearOAuthState();

        autoProgressToNext();
      } else if (event.data.type === "hubspot_error") {
        setHubspotStatus("disconnected");
        clearOAuthState();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentQuestionIndex, formData, hubspotAccountInfo, onNext, autoProgressing, autoProgressToNext]);

  const handleHubspotModalOk = () => {
    setShowHubspotModal(false);
  };

  const handleHubspotModalCancel = () => {
    setShowHubspotModal(false);
    setShowCompletionButtons(false);
    setFormData(prev => ({
      ...prev,
      usesHubspot: "",
    }));
  };

  const validateZapierForm = async (): Promise<boolean> => {
    try {
      const formValues = await zapierForm.validateFields();
      if (!formValues.zapierApiKey || formValues.zapierApiKey.length < 32) {
        ErrorToast(`
 message: "Invalid API Key",
 description: "Please enter a valid Zapier API key (32+ characters)",
 `);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Form validation error:", error);
      return false;
    }
  };

  const handleZapierModalOk = async () => {
    if (zapierStatus === "connected") {
      setShowZapierModal(false);
      if (currentQuestionIndex < filteredQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } else {
      const isValid = await validateZapierForm();
      if (isValid) {
        // await connectToZapier();
      }
    }
  };

  const handleZapierModalCancel = () => {
    setShowZapierModal(false);
    zapierForm.resetFields();
    setFormData(prev => ({
      ...prev,
      otherTools: "",
    }));
  };

  const handleNext = () => {
    // Handle HubSpot modal
    if (currentQuestion.id === "usesHubspot" && currentValue === "Yes" && hubspotStatus !== "connected") {
      setShowHubspotModal(true);
      return;
    }

    // Handle Zapier modal
    if (
      currentQuestion.id === "otherTools" &&
      currentValue &&
      currentValue.length > 0 &&
      zapierStatus !== "connected" &&
      !currentValue.split(",").includes("Unable to find my CRM")
    ) {
      setShowZapierModal(true);
      return;
    }

    // Continue to next question or complete
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      const finalData = {
        ...formData,
        ...(formData.usesHubspot === "Yes" && {
          hubspotConnected: hubspotStatus === "connected",
          hubspotAccountInfo,
        }),
        ...(formData.otherTools &&
          formData.otherTools.length > 0 && {
            zapierConnected: zapierStatus === "connected",
            zapierAccountInfo,
          }),
        ...(formData.uploadLeads === "Yes" && {
          csvUploaded: localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) !== null,
        }),
      };
      onNext(finalData);
    }
  };

  const handlePrevious = () => {
    setShowCompletionButtons(false);

    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Reset HubSpot prompted flag when going back
      if (currentQuestionIndex - 1 === 0) {
        // Going back to HubSpot question
        // setHubspotPrompted(false);
      }
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
            <Text className="text-gray-700 text-lg">
              {q.type === "multiselect" && value
                ? value
                    .split(",")
                    .filter((s: string) => s)
                    .join(", ")
                : value || "Not specified"}
            </Text>
            {q.id === "usesHubspot" && value === "Yes" && hubspotStatus === "connected" && (
              <div className="mt-2 p-2 bg-green-100 rounded-lg">
                <Text className="text-green-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to {hubspotAccountInfo?.accountName || "HubSpot"}
                </Text>
              </div>
            )}
            {q.id === "otherTools" && value && value.length > 0 && zapierStatus === "connected" && (
              <div className="mt-2 p-2 bg-blue-100 rounded-lg">
                <Text className="text-blue-700 text-sm">
                  <CheckCircleOutlined className="mr-1" />
                  Connected to Zapier for automated workflows
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
    if (currentQuestion?.type === "radio") {
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
          {/* Special info card for upload leads question */}
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

    if (currentQuestion?.type === "multiselect") {
      const selectedTools = currentValue ? currentValue.split(",").filter((s: string) => s) : [];
      return (
        <div className="mb-6">
          <Select
            mode="multiple"
            placeholder="Select tools you use"
            value={selectedTools}
            onChange={values => handleInputChange(values.join(","))}
            size="large"
            className="w-full text-lg"
            disabled={isSubmitting}
          >
            {currentQuestion.options?.map(option => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
          {currentValue && currentValue.length > 0 && !selectedTools.includes("Unable to find my CRM") && (
            <Card className="rounded-xl bg-orange-50 border-2 border-orange-500 mt-6" styles={{ body: { padding: "20px" } }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                  <ThunderboltOutlined className="text-white text-base" />
                </div>
                <Text className="text-lg font-semibold text-orange-900">Automate your workflows!</Text>
              </div>
              <Text className="text-orange-900 text-base leading-6">
                Great! We can connect your tools through Zapier to automatically sync data and create seamless workflows between your
                existing tools and our platform.
              </Text>
            </Card>
          )}
        </div>
      );
    }

    return null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const savedStatus = localStorage.getItem("hubspot_oauth_status");
      if (savedStatus !== "connecting") {
        clearOAuthState();
      }
    };
  }, []);

  return (
    <div className="max-w-4xl">
      {renderPreviousQuestions()}
      <div>
        <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
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
              onClick={handleNext} // or your onboarding completion logic
              className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
              loading={isSubmitting}
            >
              Complete Onboarding
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
              disabled={(currentQuestion.type === "radio" ? !currentValue : false) || isSubmitting}
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

      {/* HubSpot Connection Modal */}
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
      {/* Zapier Modal - keeping existing implementation */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-400 rounded-lg flex items-center justify-center mr-3">
              <ThunderboltOutlined className="text-white text-base" />
            </div>
            <span className="text-xl font-semibold">Setup Zapier Integration</span>
          </div>
        }
        open={showZapierModal}
        onOk={handleZapierModalOk}
        onCancel={handleZapierModalCancel}
        okText={zapierStatus === "connected" ? "Continue" : zapierStatus === "connecting" ? "Connecting..." : "Connect with Zapier"}
        cancelText="Skip for Now"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
          loading: zapierStatus === "connecting",
        }}
        width={600}
        centered
      >
        <div className="py-6">
          {zapierStatus === "disconnected" && (
            <>
              <Alert
                message="Connect Zapier for Automation"
                description={`Click the button below to connect ${
                  formData.otherTools
                    ? formData.otherTools
                        .split(",")
                        .filter((s: string) => s)
                        .slice(0, 3)
                        .join(", ") + (formData.otherTools.split(",").filter((s: string) => s).length > 3 ? " and more" : "")
                    : "your tools"
                } with Zapier for seamless automation.`}
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start">
                  <CalendarOutlined className="text-blue-500 mt-1 mr-3" />
                  <div className="flex-1">
                    <Text className="text-blue-800 text-sm font-medium block mb-2">How to Set Up Zapier</Text>
                    <Text className="text-blue-700 text-sm mb-3">
                      1. Click &quot;Connect with Zapier&quot; to open Zapier in a new tab.
                      <br />
                      2. Sign in to your Zapier account or create one (it&apos;s free!).
                      <br />
                      3. Follow Zapier’s prompts to connect your tools.
                      <br />
                      4. Return here and click &quot;Continue&quot; when done.
                      <br />
                      Need help? Book a meeting with our team!
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => window.open("https://calendly.com/your-team/zapier-setup", "_blank")}
                      className="bg-purple-600 border-purple-600 hover:bg-purple-700"
                    >
                      Book a Support Meeting
                    </Button>
                  </div>
                </div>
              </div>
              {formData.otherTools && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-700">
                    <strong>Selected tools to integrate:</strong>{" "}
                    {formData.otherTools
                      .split(",")
                      .filter((s: string) => s)
                      .join(", ")}
                  </Text>
                </div>
              )}
            </>
          )}

          {zapierStatus === "connecting" && (
            <div className="text-center py-8">
              <Spin size="large" />
              <div className="mt-4">
                <Text className="text-lg">Setting up Zapier integration...</Text>
                <br />
                <Text className="text-gray-500">Please complete the setup in Zapier and return here.</Text>
              </div>
            </div>
          )}

          {zapierStatus === "connected" && zapierAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description="Your Zapier integration is set up. Your tools are now ready for automated workflows."
                type="success"
                showIcon
                className="mb-4"
              />
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-green-800">
                      Zapier Integration Active
                    </Text>
                    <br />
                    <Text className="text-green-600 text-sm">Ready for automation workflows</Text>
                  </div>
                  <Button
                    type="link"
                    danger
                    onClick={() => {
                      setZapierStatus("disconnected");
                      setZapierAccountInfo(null);
                    }}
                    className="text-red-500"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Text className="text-gray-600">⚡ Your automation is ready! Need further help? Book a support meeting.</Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/zapier-setup", "_blank")}
                  className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Manual Leads Modal */}
      <CsvUploadModal
        open={showManualLeadsModal}
        onOk={leads => {
          setShowManualLeadsModal(false);
          handleCsvUpload(leads);
          if (localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) &&  (leads)) {
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
        onCancel={() => setShowCustomCrmModal(false)}
        okText="Close"
        cancelText="Cancel"
        width={500}
        centered
        footer={null}
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
