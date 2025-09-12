import { PreviousQuestionsProps } from "@/app/types/types";
import { CheckCircleOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import React from "react";

const { Text } = Typography;

export const PreviousQuestions: React.FC<PreviousQuestionsProps> = ({
  filteredQuestions,
  currentQuestionIndex,
  formData,
  hubspotStatus,
  hubspotAccountInfo,
  pipedriveStatus,
  pipedriveAccountInfo,
  goHighLevelStatus,
  nextHealthStatus,
  googleFormStatus,
  googleFormAccountInfo,
  googleLeadFormStatus,
  googleLeadFormAccountInfo,
  facebookLeadFormStatus,
  facebookLeadFormAccountInfo,
  ONBOARDING_LEADS_FILE_NAME,
}) => {
  return (
    <>
      {filteredQuestions.slice(0, currentQuestionIndex).map(q => {
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

              {q.id === "selectedCrm" && value === "GoHighLevel" && goHighLevelStatus === "connected" && (
                <div className="mt-2 p-2 bg-green-100 rounded-lg">
                  <Text className="text-green-700 text-sm">
                    <CheckCircleOutlined className="mr-1" />
                    Connected to Go High
                  </Text>
                </div>
              )}

              {q.id === "selectedCrm" && value === "NextHealth" && nextHealthStatus === "connected" && (
                <div className="mt-2 p-2 bg-green-100 rounded-lg">
                  <Text className="text-green-700 text-sm">
                    <CheckCircleOutlined className="mr-1" />
                    Connected to NextHealth
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
      })}
    </>
  );
};
