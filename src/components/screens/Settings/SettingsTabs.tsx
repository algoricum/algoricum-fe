"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LeadCapturingForm from "./LeadCapturingForm";
import ChatbotSettings from "./ChatbotSettings";
import ClinicSetting from "./ClinicSetting";
import { Flex } from "antd";

const SettingsTabs = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (pathname.includes("chatbot")) return "chatbot";
    if (pathname.includes("clinic-setting")) return "clinic-setting";
    return "lead";
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update URL without full page reload
    if (tab === "lead") {
      router.push("/settings");
    } else {
      router.push(`/settings/${tab}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Flex className="border border-[#E8EAEC] rounded-[48px] bg-Gray100 p-2 gap-3">
        <TabButton isActive={activeTab === "lead"} onClick={() => handleTabChange("lead")} label="Custom Lead Capturing Form" />
        <TabButton isActive={activeTab === "clinic-setting"} onClick={() => handleTabChange("clinic-setting")} label="Clinic setting" />
        <TabButton isActive={activeTab === "chatbot"} onClick={() => handleTabChange("chatbot")} label="Chatbot Settings" />
      </Flex>

      <div className="bg-white rounded-xl p-6">
        {activeTab === "lead" && <LeadCapturingForm />}
        {activeTab === "chatbot" && <ChatbotSettings />}
        {activeTab === "clinic-setting" && <ClinicSetting />}
      </div>
    </div>
  );
};

const TabButton = ({ isActive, onClick, label }: { isActive: boolean; onClick: () => void; label: string }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-2 text-center transition-all rounded-[48px] ${
        isActive ? "bg-brand-primary text-white" : "bg-Gray100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
};

export default SettingsTabs;
