"use client";

import { useState, useEffect } from "react";
import { Button, Radio, Card, Space, Select, Typography, Modal, Alert, Spin, Input, Form } from "antd";
import { CheckCircleOutlined, LinkOutlined, ThunderboltOutlined, CalendarOutlined } from "@ant-design/icons";
import { getUserData } from "@/utils/supabase/user-helper";
import { createClient } from "@/utils/supabase/config/client";
import { SuccessToast, ErrorToast } from "@/helpers/toast";
const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface IntegrationsStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
  isSubmitting?: boolean;
}

export default function IntegrationsStep({onNext, onPrev, initialData = {}, isSubmitting = false }: IntegrationsStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [showManualLeadsModal, setShowManualLeadsModal] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [zapierStatus, setZapierStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hubspotAccountInfo, setHubspotAccountInfo] = useState<any>(null);
  const [zapierAccountInfo, setZapierAccountInfo] = useState<any>(null);
  const [zapierForm] = Form.useForm();
  const [formData, setFormData] = useState({
    usesHubspot: initialData.usesHubspot || "",
    usesAds: initialData.usesAds || "",
    hasChatbot: initialData.hasChatbot || "",
    otherTools: initialData.otherTools || "",
  });
  const [csvLeads, setCsvLeads] = useState<any>([]);
  const supabase = createClient();

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
        "Other",
      ],
    },
    {
      id: "usesAds",
      type: "radio",
      question: "Do you use ads?",
      options: ["Yes", "No"],
    },
    {
      id: "hasChatbot",
      type: "radio",
      question: "Are you already using a chatbot?",
      options: ["Yes", "No"],
    },
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const currentValue = formData[currentQuestion.id as keyof typeof formData];

  const handleCsvLeads= (csvLeads:any) => {
    setCsvLeads(csvLeads);
  }

  const handleCsvUpload = async () => {
    try {
       if(!csvLeads){
        throw new Error("No CSV file selected");
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

      // Upload file directly to Supabase Storage
      const { data, error } = await supabase.storage.from("lead-uploads").upload(filePath, csvLeads, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload CSV: ${error.message}`);
      }
      
      localStorage.setItem("leads-file-name",filePath);
         
    } catch (error) {
      console.error("Error uploading CSV:", error);
    }
  };

  // Listen for OAuth callback messages
  useEffect(() => {
    if (
      localStorage.getItem("clinic_onboarding_completed_steps_v2") &&
      JSON.parse(localStorage.getItem("clinic_onboarding_completed_steps_v2")).includes(5)
    ) {
      setCurrentQuestionIndex(questions.length - 1);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "hubspot_success") {
        setHubspotStatus("connected");
        setHubspotAccountInfo(event.data.accountInfo);
        setShowHubspotModal(false);
      } else if (event.data.type === "hubspot_error") {
        setHubspotStatus("disconnected");
        ErrorToast(`
          message: "Connection Failed",
          description: ${event.data.error} || "Unable to connect to HubSpot. Please try again.",
      `);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const getCurrentUserId = async () => {
    const user = await getUserData();

    return user?.id;
  };

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    if (currentQuestion.id === "usesHubspot" && value === "Yes") {
      setShowHubspotModal(true);
    }

    // Show Zapier modal when tools are selected (with 2-3 second delay)
    if (currentQuestion.id === "otherTools" && value && value.length > 0) {
      const selectedTools = value.split(",").filter((s: string) => s);
      if (selectedTools.length > 0) {
        setTimeout(() => {
          setShowZapierModal(true);
        }, 2500); // 2.5 second delay
      }
    }
  };

  // Updated connectToHubSpot and disconnectHubSpot functions
  // Add these to your React component

  const SUPABASE_URL = "https://eypitkzntyiyvwrndkgy.supabase.co";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; // Get this from your Supabase dashboard

  // Updated HubSpot connection function
  const connectToHubSpot = async () => {
    setHubspotStatus("connecting");

    try {
      // Call your Supabase edge function with proper headers
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          userId: getCurrentUserId(),
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

      // Open popup for OAuth
      const popup = window.open(data.authUrl, "hubspot-oauth", "width=600,height=700,scrollbars=yes,resizable=yes");

      // Check if popup was blocked
      if (!popup) {
        throw new Error("Popup was blocked. Please allow popups for this site.");
      }

      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // If popup closed without success message, reset status
          setTimeout(() => {
            if (hubspotStatus === "connecting") {
              setHubspotStatus("disconnected");
            }
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error("Connection failed:", error);
      setHubspotStatus("disconnected");
      ErrorToast(`
        message: "Connection Failed",
        description: ${error instanceof Error ? error.message : "Unable to connect to HubSpot. Please try again"},
      `);
    }
  };

  // Updated HubSpot disconnect function
  const disconnectHubSpot = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-integration`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          userId: getCurrentUserId(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Disconnect error:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setHubspotStatus("disconnected");
      setHubspotAccountInfo(null);

      SuccessToast(`{
        message: "Disconnected Successfully",
        description: "Your HubSpot account has been disconnected.",
      }`);
    } catch (error) {
      console.error("Disconnection failed:", error);
      ErrorToast(`
        message: "Disconnection Failed",
        description: ${error instanceof Error ? error.message : "Unable to disconnect from HubSpot. Please try again."}
      `);
    }
  };

  // Updated Zapier connection function with form data
  const connectToZapier = async () => {
    try {
      // Validate form before making API call
      const formValues = await zapierForm.validateFields();
      const userId = getCurrentUserId();

      if (!userId) {
        throw new Error("User not authenticated. Please log in and try again.");
      }

      console.log("Connecting to Zapier with form values:", {
        accountEmail: formValues.accountEmail,
        hasApiKey: !!formValues.zapierApiKey,
        hasWebhookUrl: !!formValues.webhookUrl,
        integrationGoals: formValues.integrationGoals?.length,
      });

      setZapierStatus("connecting");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/zapier-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          userId,
          zapierApiKey: formValues.zapierApiKey,
          accountEmail: formValues.accountEmail,
          webhookUrl: formValues.webhookUrl || null,
          integrationGoals: formValues.integrationGoals,
          selectedTools: formData.otherTools ? formData.otherTools.split(",").filter((s: string) => s.trim()) : [],
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("API Error:", responseData);
        throw new Error(responseData.details || responseData.error || "Failed to connect to Zapier");
      }

      console.log("Connection successful:", responseData);

      setZapierStatus("connected");
      setZapierAccountInfo(responseData.accountInfo);

      SuccessToast(`
        message: "Successfully Connected!",
        description: Connected to ${responseData.accountInfo.email}. Your Zapier integration is ready for automation
        duration: 5,
      `);

      // Auto-close modal after success
      setTimeout(() => {
        setShowZapierModal(false);
      }, 2000);
    } catch (error) {
      console.error("Zapier connection failed:", error);
      setZapierStatus("disconnected");

      // Show specific error message
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

      ErrorToast(`
        message: "Connection Failed",
        description: ${errorMessage},
        duration: 8,
      `);
    }
  };

  const disconnectZapier = async () => {
    try {
      await fetch("/api/zapier/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "current-user-id",
        }),
      });

      setZapierStatus("disconnected");
      setZapierAccountInfo(null);
      zapierForm.resetFields();
    } catch (error) {
      console.error("Zapier disconnection failed:", error);
    }
  };

  const handleHubspotModalOk = () => {
    setShowHubspotModal(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleHubspotModalCancel = () => {
    setShowHubspotModal(false);
    setFormData(prev => ({
      ...prev,
      usesHubspot: "",
    }));
  };

  const testZapierApiKey = async (apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch("https://api.zapier.com/v1/me", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  };

  // Enhanced form validation with API key testing
  const validateZapierForm = async (): Promise<boolean> => {
    try {
      const formValues = await zapierForm.validateFields();

      // Test API key format
      if (!formValues.zapierApiKey || formValues.zapierApiKey.length < 32) {
        ErrorToast(`
          message: "Invalid API Key",
          description: "Please enter a valid Zapier API key (32+ characters)",
        `);
        return false;
      }

      // Optional: Test API key with Zapier (if you want client-side validation)
      // Note: This exposes the API key to the client, so use with caution
      /*
    const isValidKey = await testZapierApiKey(formValues.zapierApiKey);
    if (!isValidKey) {
      Alert.warning({
        message: "Invalid API Key",
        description: "The provided API key doesn't work with Zapier. Please check and try again.",
      });
      return false;
    }
    */

      return true;
    } catch (error) {
      console.error("Form validation error:", error);
      return false;
    }
  };

  const handleZapierModalOk = async () => {
    if (zapierStatus === "connected") {
      setShowZapierModal(false);
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } else {
      // Validate form before connecting
      const isValid = await validateZapierForm();
      if (isValid) {
        await connectToZapier();
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

  const handleManualLeadsModalOk = () => {
    handleCsvUpload()
    setShowManualLeadsModal(false);
    // You might want to proceed to the next step or handle the CSV upload here
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onNext(formData); // Or handle final submission
    }
  };

  const handleManualLeadsModalCancel = () => {
    setShowManualLeadsModal(false);

    setCurrentQuestionIndex(prev => prev + 1);
    // If the user cancels, you might want to reset the selection or just close the modal
    // For now, we'll just close it and allow them to continue if they wish.
  };

  const handleNext = () => {
    if (currentQuestion.id === "usesHubspot" && currentValue === "Yes" && hubspotStatus !== "connected") {
      setShowHubspotModal(true);
      return;
    }

    if (currentQuestion.id === "otherTools" && currentValue && currentValue.length > 0 && zapierStatus !== "connected") {
      setShowZapierModal(true);
      return;
    } // NEW LOGIC: Manual Leads Modal condition
    // If on the "otherTools" question, HubSpot is "No", and no other tools are selected
    if (
      currentQuestion.id === "otherTools" &&
      formData.usesHubspot === "No" &&
      (!formData.otherTools || formData.otherTools.length === 0)
    ) {
      setShowManualLeadsModal(true);
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
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
      };
      onNext(finalData);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (onPrev) {
      onPrev();
    }
  };

  const renderPreviousQuestions = () => {
    return questions.slice(0, currentQuestionIndex).map(q => {
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
          </div>
        </div>
      );
    });
  };

  const renderCurrentInput = () => {
    if (currentQuestion.type === "radio") {
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
                  bodyStyle={{ padding: "16px" }}
                  onClick={() => !isSubmitting && handleInputChange(option)}
                >
                  <Radio value={option} className="text-lg text-black" disabled={isSubmitting}>
                    <span className="text-black">{option}</span>
                  </Radio>
                </Card>
              ))}
            </Space>
          </Radio.Group>

          {currentQuestion.id === "hasChatbot" && currentValue === "No" && (
            <Card className="rounded-xl bg-blue-50 border-2 border-blue-500 mt-6" bodyStyle={{ padding: "20px" }}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <Text className="text-white text-base">✓</Text>
                </div>
                <Text className="text-lg font-semibold text-blue-900">We&apos;ve got you covered!</Text>
              </div>
              <Text className="text-blue-900 text-base leading-6">
                Perfect! We&apos;ll help you set up our intelligent chatbot that can handle patient inquiries, book appointments, and
                provide information about your services 24/7.
              </Text>
            </Card>
          )}
        </div>
      );
    }

    if (currentQuestion.type === "multiselect") {
      return (
        <div className="mb-6">
          <Select
            mode="multiple"
            placeholder="Select tools you use"
            value={currentValue ? currentValue.split(",").filter((s: string) => s) : []}
            onChange={values => handleInputChange(values.join(","))}
            size="large"
            className="w-full text-lg"
            dropdownClassName="text-base"
            disabled={isSubmitting}
          >
            {currentQuestion.options?.map(option => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>

          {currentValue && currentValue.length > 0 && (
            <Card className="rounded-xl bg-orange-50 border-2 border-orange-500 mt-6" bodyStyle={{ padding: "20px" }}>
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

  return (
    <div className="max-w-4xl">
      {renderPreviousQuestions()}

      <div>
        <Title level={1} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
          {currentQuestion.question}
        </Title>

        {renderCurrentInput()}

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
            loading={isSubmitting && currentQuestionIndex === questions.length - 1}
            className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8"
          >
            {currentQuestionIndex === questions.length - 1 ? (isSubmitting ? "Setting up your clinic..." : "Continue") : "Continue"}
          </Button>
        </div>
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
                <Text className="text-gray-500">Please complete the authorization in the popup window</Text>
              </div>
            </div>
          )}

          {hubspotStatus === "connected" && hubspotAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description={`Connected to ${hubspotAccountInfo.accountName}. Your contacts and deals will sync automatically.`}
                type="success"
                showIcon
                className="mb-4"
              />

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-green-800">
                      {hubspotAccountInfo.accountName}
                    </Text>
                    <br />
                    <Text className="text-green-600 text-sm">
                      {hubspotAccountInfo.contactCount} contacts • {hubspotAccountInfo.dealCount} deals
                    </Text>
                  </div>
                  <Button type="link" danger onClick={disconnectHubSpot} className="text-red-500">
                    Disconnect
                  </Button>
                </div>
              </div>

              <div className="mt-4 text-center">
                <Text className="text-gray-600">🎉 All set! Your HubSpot data will sync automatically.</Text>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Updated Zapier Connection Modal with Form */}
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
        okText={zapierStatus === "connected" ? "Continue" : zapierStatus === "connecting" ? "Connecting..." : "Connect Zapier"}
        cancelText="Skip for Now"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
          loading: zapierStatus === "connecting",
        }}
        width={700}
        centered
      >
        <div className="py-6">
          {zapierStatus === "disconnected" && (
            <>
              <Alert
                message="Set up your Zapier automation"
                description={`We'll help you connect ${
                  formData.otherTools
                    ? formData.otherTools
                        .split(",")
                        .filter((s: string) => s)
                        .slice(0, 3)
                        .join(", ") + (formData.otherTools.split(",").filter((s: string) => s).length > 3 ? " and more" : "")
                    : "your tools"
                } for seamless data sync and automation.`}
                type="info"
                showIcon
                className="mb-6"
              />

              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start">
                  <CalendarOutlined className="text-blue-500 mt-1 mr-3" />
                  <div>
                    <Text className="text-blue-800 text-sm font-medium block">Need help with setup?</Text>
                    <Text className="text-blue-700 text-sm">
                      If you find this process difficult, you can{" "}
                      <a
                        href="https://calendly.com/your-team/zapier-setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        book a meeting with our team
                      </a>{" "}
                      and we'll set everything up for you.
                    </Text>
                  </div>
                </div>
              </div>

              <Form form={zapierForm} layout="vertical" className="space-y-4">
                <Form.Item
                  label="Zapier Account Email"
                  name="accountEmail"
                  rules={[
                    { required: true, message: "Please enter your Zapier account email" },
                    { type: "email", message: "Please enter a valid email address" },
                  ]}
                >
                  <Input placeholder="Enter your Zapier account email" size="large" />
                </Form.Item>

                <Form.Item
                  label="Zapier API Key"
                  name="zapierApiKey"
                  rules={[{ required: true, message: "Please enter your Zapier API key" }]}
                  extra={
                    <Text className="text-gray-500 text-xs">
                      Find this in your Zapier account under Settings → API Keys.{" "}
                      <a href="https://zapier.com/app/profile/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500">
                        Get your API key
                      </a>
                    </Text>
                  }
                >
                  <Input.Password placeholder="Enter your Zapier API key" size="large" />
                </Form.Item>

                <Form.Item
                  label="Webhook URL (Optional)"
                  name="webhookUrl"
                  extra={<Text className="text-gray-500 text-xs">If you have a specific webhook URL for your automations</Text>}
                >
                  <Input placeholder="https://hooks.zapier.com/hooks/catch/..." size="large" />
                </Form.Item>

                <Form.Item
                  label="What do you want to automate?"
                  name="integrationGoals"
                  rules={[{ required: true, message: "Please describe your automation goals" }]}
                >
                  <TextArea
                    placeholder="e.g., Sync leads from forms to CRM, send notifications when new patients book appointments, update contact information across platforms..."
                    rows={4}
                    size="large"
                  />
                </Form.Item>
              </Form>

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
                <Text className="text-gray-500">This may take a few moments</Text>
              </div>
            </div>
          )}

          {zapierStatus === "connected" && zapierAccountInfo && (
            <>
              <Alert
                message="Successfully Connected!"
                description="Your Zapier integration is set up. We'll help you create automated workflows for your selected tools."
                type="success"
                showIcon
                className="mb-4"
              />

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Text strong className="text-green-800">
                      {zapierAccountInfo.email}
                    </Text>
                    <br />
                    <Text className="text-green-600 text-sm">
                      {zapierAccountInfo.connectedApps} apps ready for automation • {zapierAccountInfo.zapCount} active Zaps
                    </Text>
                  </div>
                  <Button type="link" danger onClick={disconnectZapier} className="text-red-500">
                    Disconnect
                  </Button>
                </div>
              </div>

              <div className="mt-4 text-center">
                <Text className="text-gray-600">⚡ Ready to automate! We&apos;ll help you set up workflows next.</Text>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">CSV</Text>
            </div>
            <span className="text-xl font-semibold">You want to enter manual leads?</span>
          </div>
        }
        open={showManualLeadsModal}
        onOk={handleManualLeadsModalOk}
        onCancel={handleManualLeadsModalCancel}
        okText="Upload CSV"
        cancelText="Skip for Now"
        okButtonProps={{
          className: "bg-purple-500 border-purple-500",
        }}
        width={500}
        centered
      >
        <div className="py-6">
          <Alert
            message="Upload your leads via CSV"
            description="You can upload a CSV file with your existing leads to import them into our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const file = e.target.files[0];
                  handleCsvLeads(file);
                }
              }}
              onClick={(e) => {
                e.target.value = '';
              }}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-50 file:text-purple-700
                hover:file:bg-purple-100"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>CSV Format:</strong>
                <br />• Ensure your CSV has columns like 'Name', 'Email', 'Phone', etc.
                <br />• We&apos;ll guide you through mapping fields after upload.
              </Text>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
