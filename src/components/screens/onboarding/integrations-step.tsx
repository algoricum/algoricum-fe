"use client";

import { useState } from "react";
import { Button, Radio, Card, Space, Select, Typography, Modal, Input, Alert } from "antd";

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
  const [hubspotConfig, setHubspotConfig] = useState({
    apiKey: initialData.hubspotConfig?.apiKey || "",
    portalId: initialData.hubspotConfig?.portalId || "",
  });
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

    // Show HubSpot modal if user selects "Yes" for HubSpot
    if (currentQuestion.id === "usesHubspot" && value === "Yes") {
      setShowHubspotModal(true);
    }
  };

  const handleHubspotModalOk = () => {
    setShowHubspotModal(false);
    // Continue to next question after modal is closed
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleHubspotModalCancel = () => {
    setShowHubspotModal(false);
    // Reset HubSpot selection if user cancels
    setFormData(prev => ({
      ...prev,
      usesHubspot: "",
    }));
  };

  const handleNext = () => {
    // If HubSpot is selected but modal hasn't been completed, show modal
    if (currentQuestion.id === "usesHubspot" && currentValue === "Yes" && !hubspotConfig.apiKey) {
      setShowHubspotModal(true);
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Include HubSpot config in final data
      const finalData = {
        ...formData,
        ...(formData.usesHubspot === "Yes" && { hubspotConfig }),
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
            {/* Show HubSpot integration status */}
            {q.id === "usesHubspot" && value === "Yes" && hubspotConfig.apiKey && (
              <div className="mt-2 p-2 bg-green-100 rounded-lg">
                <Text className="text-green-700 text-sm">✓ HubSpot integration configured</Text>
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
      {/* Previous Questions */}
      {renderPreviousQuestions()}

      {/* Current Question */}
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
            {currentQuestionIndex === questions.length - 1
              ? isSubmitting
                ? "Setting up your clinic..."
                : "Complete Onboarding"
              : "Continue"}
          </Button>
        </div>
      </div>

      {/* HubSpot Integration Modal */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">H</Text>
            </div>
            <span className="text-xl font-semibold">HubSpot Integration</span>
          </div>
        }
        open={showHubspotModal}
        onOk={handleHubspotModalOk}
        onCancel={handleHubspotModalCancel}
        okText="Save Integration"
        cancelText="Skip for Now"
        okButtonProps={{
          disabled: !hubspotConfig.apiKey || !hubspotConfig.portalId,
          className: "bg-purple-500 border-purple-500",
        }}
        width={600}
        centered
      >
        <div className="py-4">
          <Alert
            message="Connect your HubSpot account"
            description="Enter your HubSpot credentials to sync leads and contacts automatically."
            type="info"
            showIcon
            className="mb-6"
          />

          <div className="space-y-4">
            <div>
              <Text className="block text-sm font-medium text-gray-700 mb-2">HubSpot API Key</Text>
              <Input
                placeholder="Enter your HubSpot API key"
                value={hubspotConfig.apiKey}
                onChange={e =>
                  setHubspotConfig(prev => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
                className="rounded-lg"
              />
              <Text className="text-xs text-gray-500 mt-1">Find your API key in HubSpot Settings → Integrations → API key</Text>
            </div>

            <div>
              <Text className="block text-sm font-medium text-gray-700 mb-2">Portal ID</Text>
              <Input
                placeholder="Enter your HubSpot Portal ID"
                value={hubspotConfig.portalId}
                onChange={e =>
                  setHubspotConfig(prev => ({
                    ...prev,
                    portalId: e.target.value,
                  }))
                }
                className="rounded-lg"
              />
              <Text className="text-xs text-gray-500 mt-1">Find your Portal ID in HubSpot Settings → Account Setup → Account Defaults</Text>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm text-gray-600">
              <strong>What this enables:</strong>
              <br />• Automatic lead capture from your website
              <br />• Sync patient information with HubSpot
              <br />• Track appointment bookings in your CRM
              <br />• Automated follow-up sequences
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}
