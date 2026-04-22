import { CurrentInputProps } from "@/app/types/types";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { checkClinicSubscription } from "@/utils/subscription-utils";
import { CheckCircleOutlined, LockOutlined } from "@ant-design/icons";
import { Button, Card, Radio, Select, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const { Text } = Typography;

// Options that require Business plan
const BUSINESS_ONLY_CRM = ["HubSpot", "Pipedrive", "GoHighLevel", "NextHealth"];
const BUSINESS_ONLY_ADS = ["Facebook Lead Ads", "Google Ads Lead Forms"];
const BUSINESS_ONLY_FORMS = ["Google Forms", "Typeform", "Jotform", "Gravity Forms"];

const UpgradeCard: React.FC<{ feature: string }> = ({ feature }) => {
  const router = useRouter();
  return (
    <Card
      className="rounded-xl bg-purple-50 border-2 border-purple-400 mt-6"
      styles={{ body: { padding: "20px" } }}
    >
      <div className="flex items-center mb-3">
        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
          <LockOutlined style={{ color: "white", fontSize: 16 }} />
        </div>
        <Text className="text-lg font-semibold text-purple-900">Business Plan Required</Text>
      </div>
      <Text className="text-purple-900 text-base leading-6 block mb-4">
        <strong>{feature}</strong> is available on the Business plan. Upgrade to unlock full CRM and integration support, unlimited follow-ups, and SMS automation.
      </Text>
      <Button
        type="primary"
        size="large"
        className="!bg-purple-600 !border-purple-600 hover:!bg-purple-700 font-semibold"
        onClick={() => router.push("/billing")}
      >
        Upgrade to Business — $249/month
      </Button>
    </Card>
  );
};

const CurrentInput: React.FC<CurrentInputProps> = ({
  currentQuestion,
  currentValue,
  handleInputChange,
  isSubmitting,
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
}) => {
  const [isPaid, setIsPaid] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPlan = async () => {
      try {
        const clinic = await getClinicData();
        if (!clinic) return;
        const info = await checkClinicSubscription(clinic.id);
        setIsPaid(info.isPaid);
      } catch {
        setIsPaid(false);
      }
    };
    checkPlan();
  }, []);

  if (!currentQuestion) return null;

  // ----- Connected states (show regardless of plan) -----
  if (currentQuestion.id === "selectedCrm") {
    if (hubspotStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">HubSpot</Text>
            <div className="mt-2 p-2 bg-green-100 rounded-lg">
              <Text className="text-green-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to {hubspotAccountInfo?.accountName || "HubSpot"}
              </Text>
            </div>
          </div>
        </div>
      );
    }
    if (pipedriveStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">Pipedrive</Text>
            <div className="mt-2 p-2 bg-blue-100 rounded-lg">
              <Text className="text-blue-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to {pipedriveAccountInfo?.accountName || "Pipedrive"}
              </Text>
            </div>
          </div>
        </div>
      );
    }
    if (goHighLevelStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">GoHighLevel</Text>
            <div className="mt-2 p-2 bg-green-100 rounded-lg">
              <Text className="text-green-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to Go High Level
              </Text>
            </div>
          </div>
        </div>
      );
    }
    if (nextHealthStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">NextHealth</Text>
            <div className="mt-2 p-2 bg-green-100 rounded-lg">
              <Text className="text-green-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to NextHealth
              </Text>
            </div>
          </div>
        </div>
      );
    }
  }

  if (currentQuestion.id === "adsConnections") {
    if (googleLeadFormStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">Google Ads Lead Forms</Text>
            <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
              <Text className="text-yellow-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to {googleLeadFormAccountInfo?.accountName || "Google Ads Lead Forms"}
              </Text>
            </div>
          </div>
        </div>
      );
    }
    if (facebookLeadFormStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">Facebook Lead Ads</Text>
            <div className="mt-2 p-2 bg-blue-100 rounded-lg">
              <Text className="text-blue-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to {facebookLeadFormAccountInfo?.accountName || "Facebook Lead Ads"}
              </Text>
            </div>
          </div>
        </div>
      );
    }
  }

  if (currentQuestion.id === "leadCaptureForms") {
    if (googleFormStatus === "connected") {
      return (
        <div className="mb-6">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Text className="text-gray-700 text-lg">Google Forms</Text>
            <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
              <Text className="text-yellow-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                Connected to {googleFormAccountInfo?.accountName || "Google Forms"}
              </Text>
            </div>
          </div>
        </div>
      );
    }
  }

  // ----- Select Questions -----
  if (currentQuestion.type === "select") {
    const isBusinessOnlyCrm = currentQuestion.id === "selectedCrm" && BUSINESS_ONLY_CRM.includes(currentValue);
    const isBusinessOnlyAds = currentQuestion.id === "adsConnections" && BUSINESS_ONLY_ADS.includes(currentValue);
    const isBusinessOnlyForm = currentQuestion.id === "leadCaptureForms" && BUSINESS_ONLY_FORMS.includes(currentValue);
    const needsUpgrade = (isBusinessOnlyCrm || isBusinessOnlyAds || isBusinessOnlyForm) && isPaid === false;

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

        {/* Upgrade wall for free users selecting Business-only options */}
        {needsUpgrade && <UpgradeCard feature={currentValue} />}

        {/* CRM Connection Cards (paid users only) */}
        {!needsUpgrade && currentQuestion.id === "selectedCrm" && currentValue === "Pipedrive" && pipedriveStatus !== "connected" && (
          <ConnectionCard
            color="green"
            letter="P"
            title="Connect your Pipedrive CRM!"
            description="Great! We can connect your Pipedrive CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {!needsUpgrade && currentQuestion.id === "selectedCrm" && currentValue === "HubSpot" && hubspotStatus !== "connected" && (
          <ConnectionCard
            color="red"
            letter="H"
            title="Connect your HubSpot CRM!"
            description="Great! We can connect your HubSpot CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {!needsUpgrade && currentQuestion.id === "selectedCrm" && currentValue === "GoHighLevel" && goHighLevelStatus !== "connected" && (
          <ConnectionCard
            color="blue"
            letter="H"
            title="Connect your Go High Level CRM!"
            description="Great! We can connect your Go High Level CRM directly to automatically sync your leads, contacts, and deals with our platform for seamless workflows."
          />
        )}

        {/* Ads Connection Cards (paid users only) */}
        {!needsUpgrade && currentQuestion.id === "adsConnections" && currentValue === "Facebook Lead Ads" && facebookLeadFormStatus !== "connected" && (
          <ConnectionCard
            color="blue"
            letter="F"
            title="Connect your Facebook Lead Ads!"
            description="Great! We can connect your Facebook Lead Ads directly to automatically sync your leads with our platform for seamless workflows."
          />
        )}

        {!needsUpgrade && currentQuestion.id === "adsConnections" && currentValue === "Google Ads Lead Forms" && googleLeadFormStatus !== "connected" && (
          <ConnectionCard
            color="yellow"
            letter="G"
            title="Connect your Google Ads Lead Forms!"
            description="Great! We can connect your Google Ads Lead Forms directly to automatically sync your leads with our platform for seamless workflows."
          />
        )}

        {/* Lead Capture Forms Connection Cards (paid users only) */}
        {!needsUpgrade && currentQuestion.id === "leadCaptureForms" && currentValue === "Google Forms" && googleFormStatus !== "connected" && (
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
