import { CurrentInputProps } from "@/app/types/types";
import { Card, Radio, Select, Space, Typography } from "antd";
import React from "react";

const { Text } = Typography;

const CurrentInput: React.FC<CurrentInputProps> = ({ currentQuestion, currentValue, handleInputChange, isSubmitting }) => {
  if (!currentQuestion) return null;

  // ----- Select Questions -----
  if (currentQuestion.type === "select") {
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
          {currentQuestion.options?.map((option: string) => (
            <Select.Option key={option} value={option}>
              {option}
            </Select.Option>
          ))}
        </Select>

        {/* CRM Connections */}
        {currentQuestion.id === "selectedCrm" && currentValue === "Pipedrive" && (
          <ConnectionCard
            color="green"
            letter="P"
            title="Connect your Pipedrive CRM!"
            description="Great! We can connect your Pipedrive CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {currentQuestion.id === "selectedCrm" && currentValue === "HubSpot" && (
          <ConnectionCard
            color="red"
            letter="H"
            title="Connect your HubSpot CRM!"
            description="Great! We can connect your HubSpot CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {currentQuestion.id === "selectedCrm" && currentValue === "GoHighLevel" && (
          <ConnectionCard
            color="blue"
            letter="H"
            title="Connect your Go High Level CRM!"
            description="Great! We can connect your Go High Level CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {/* Ads Connections */}
        {currentQuestion.id === "adsConnections" && currentValue === "Facebook Lead Ads" && (
          <ConnectionCard
            color="blue"
            letter="F"
            title="Connect your Facebook Lead Ads!"
            description="Great! We can connect your Facebook Lead Ads directly to automatically sync your leads with our platform for seamless workflows."
          />
        )}

        {currentQuestion.id === "adsConnections" && currentValue === "Google Ads Lead Forms" && (
          <ConnectionCard
            color="yellow"
            letter="G"
            title="Connect your Google Ads Lead Forms!"
            description="Great! We can connect your Google Ads Lead Forms directly to automatically sync your leads with our platform for seamless workflows."
          />
        )}

        {/* Lead Capture Forms */}
        {currentQuestion.id === "leadCaptureForms" && currentValue === "Google Forms" && (
          <ConnectionCard
            color="yellow"
            letter="G"
            title="Connect your Google Forms!"
            description="Great! We can connect your Google Forms directly to automatically sync your leads with our platform for seamless workflows."
          />
        )}
      </div>
    );
  }

  // ----- Radio Questions -----
  if (currentQuestion.type === "radio") {
    return (
      <div className="mb-6">
        {currentQuestion.subtitle && <Text className="text-gray-600 text-sm mb-4 block">{currentQuestion.subtitle}</Text>}

        <Radio.Group value={currentValue} onChange={e => handleInputChange(e.target.value)} className="w-full">
          <Space direction="vertical" size="middle" className="w-full">
            {currentQuestion.options?.map((option: string) => (
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
          <ConnectionCard
            color="purple"
            letter="CSV"
            title="Upload your existing leads!"
            description="Great! You can upload a CSV file with your existing leads to import them directly into our platform. We'll help you map the fields correctly."
          />
        )}
      </div>
    );
  }

  return null;
};

export default CurrentInput;

interface ConnectionCardProps {
  color: string;
  letter: string;
  title: string;
  description: string;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({ color, letter, title, description }) => (
  <Card className={`rounded-xl bg-${color}-50 border-2 border-${color}-500 mt-6`} styles={{ body: { padding: "20px" } }}>
    <div className="flex items-center mb-3">
      <div className={`w-8 h-8 bg-${color}-500 rounded-full flex items-center justify-center mr-3`}>
        <Text className="text-white font-bold text-sm">{letter}</Text>
      </div>
      <Text className={`text-lg font-semibold text-${color}-900`}>{title}</Text>
    </div>
    <Text className={`text-${color}-900 text-base leading-6`}>{description}</Text>
  </Card>
);
