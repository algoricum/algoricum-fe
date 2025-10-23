"use client";
import Flex from "antd/es/flex";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ChatbotSettings from "./ChatbotSettings";
import ClinicSetting from "./ClinicSetting";

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
    <div className="flex flex-col mt-4 pl-2">
      <Flex className="border border-[#E8EAEC] rounded-[48px] p-2 gap-4 max-w-md inline-flex">
        {/* <TabButton isActive={activeTab === "lead"} onClick={() => handleTabChange("lead")} label="Custom Lead Capturing Form" /> */}
        <TabButton isActive={activeTab === "clinic-setting"} onClick={() => handleTabChange("clinic-setting")} label="Clinic Setting" />
        <TabButton isActive={activeTab === "chatbot"} onClick={() => handleTabChange("chatbot")} label="AI Assistant Settings" />
      </Flex>

      <div className="bg-white rounded-xl py-6">
        {/* {activeTab === "lead" && <LeadCapturingForm />} */}
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
      className={`
        flex-1 px-6 py-3 text-center transition-all rounded-[48px] 
        text-sm font-medium whitespace-nowrap
        ${isActive ? "bg-brand-primary text-white" : "bg-Gray100 text-gray-600 hover:bg-gray-200"}
      `}
    >
      <span className="block">{label}</span>
    </button>
  );
};

export default SettingsTabs;
