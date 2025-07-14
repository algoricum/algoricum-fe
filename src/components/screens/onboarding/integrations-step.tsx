"use client";

import { useState } from "react";
import { Button, Radio, Card, Space, Select, Typography, Modal, Alert, Spin } from "antd";
import { CheckCircleOutlined, LinkOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Title, Text } = Typography;

interface IntegrationsStepProps {
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
  isSubmitting?: boolean;
}

export default function IntegrationsStep({ onNext, onPrev, initialData = {}, isSubmitting = false }: IntegrationsStepProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hubspotAccountInfo, setHubspotAccountInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    usesHubspot: initialData.usesHubspot || "",
    usesAds: initialData.usesAds || "",
    hasChatbot: initialData.hasChatbot || "",
    otherTools: initialData.otherTools || "",
  });

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

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));

    if (currentQuestion.id === "usesHubspot" && value === "Yes") {
      setShowHubspotModal(true);
    }
  };

  // Simple one-click HubSpot connection
  const connectToHubSpot = async () => {
    setHubspotStatus("connecting");

    try {
      // This would call your backend API that handles the OAuth flow
      const response = await fetch("/api/hubspot/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "current-user-id", // Get from your auth context
          redirectUrl: window.location.href,
        }),
      });

      const { authUrl } = await response.json();

      // Redirect to HubSpot for authorization
      window.location.href = authUrl;
    } catch (error) {
      console.error("Connection failed:", error);
      setHubspotStatus("disconnected");
      Alert.error({
        message: "Connection Failed",
        description: "Unable to connect to HubSpot. Please try again.",
      });
    }
  };

  // Handle successful OAuth return
  const handleHubSpotSuccess = (accountInfo: any) => {
    setHubspotStatus("connected");
    setHubspotAccountInfo(accountInfo);
  };

  const disconnectHubSpot = async () => {
    try {
      await fetch("/api/hubspot/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "current-user-id",
        }),
      });

      setHubspotStatus("disconnected");
      setHubspotAccountInfo(null);
    } catch (error) {
      console.error("Disconnection failed:", error);
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

  const handleNext = () => {
    if (currentQuestion.id === "usesHubspot" && currentValue === "Yes" && hubspotStatus !== "connected") {
      setShowHubspotModal(true);
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

      {/* Super Simple HubSpot Connection Modal */}
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
                <Text className="text-gray-500">You may be redirected to sign in</Text>
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
    </div>
  );
}
