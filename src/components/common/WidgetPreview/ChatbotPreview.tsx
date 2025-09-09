"use client";
import React from "react";
// components/HomePage/HomePage.jsx - Preview Component (No Functionality)
import { HomeOutlined, MessageOutlined } from "@ant-design/icons";
import { Avatar, Flex, Input } from "antd";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AvatarsProps {
  chatbotAvatar?: string | null;
}

const Avatars = ({ chatbotAvatar }: AvatarsProps) => {
  console.log("Rendering Avatars with chatbotAvatar:", chatbotAvatar);
  return (
    <div>
      <Avatar.Group>
        <Avatar className="cursor-pointer" size={34} src={chatbotAvatar || "https://api.dicebear.com/7.x/miniavs/svg?seed=1"} />
      </Avatar.Group>
    </div>
  );
};

const HeaderIcon = ({ primaryColor = "#4C2EEB", ...props }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="40" height="40" rx="20" fill="white" />
    <path
      d="M13.25 14L15.0128 16.5462C16.2605 18.3485 18.9744 18.1873 20 16.25V16.25C21.0256 14.3127 23.7395 14.1515 24.9872 15.9538L26.75 18.5"
      stroke={primaryColor}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M12 24.5V24.5C16.1708 29.4801 23.8292 29.4801 28 24.5V24.5" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

interface ChatbotHeaderProps {
  primaryColor?: string;
  chatbotName?: string;
  logo?: string | null;
  chatbotAvatar?: string | null;
}

const ChatbotHeader = ({ primaryColor = "#2563EB", chatbotName = "Ava", logo, chatbotAvatar }: ChatbotHeaderProps) => {
  // Add key to force re-render when props change
  const headerKey = `header-${primaryColor}-${chatbotName}-${logo}-${chatbotAvatar}`;

  return (
    <div key={headerKey}>
      {/* Enhanced header styling with dynamic primary color */}
      <div className="flex flex-col rounded-t-3xl p-6 pb-10 gap-5 transition-colors duration-300" style={{ backgroundColor: primaryColor }}>
        <div className="flex justify-between items-start">
          {logo ? (
            <div className="bg-white p-2 flex justify-center items-center rounded-full shadow-sm">
              <Image
                src={logo}
                alt="logo"
                className="w-[34px] h-[34px] rounded-full object-cover"
                onError={e => {
                  console.error("Logo failed to load:", logo);
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                onLoad={() => {
                  console.log("Logo loaded successfully:", logo);
                }}
              />
            </div>
          ) : (
            <div className="shadow-sm">
              <HeaderIcon primaryColor="#4C2EEB" />
            </div>
          )}
          <Avatars chatbotAvatar={chatbotAvatar} />
        </div>
        {/* Improved typography spacing and sizing */}
        <div className="font-bold">
          <div className="text-white/90 text-3xl leading-tight mb-2">{chatbotName || "Ava"}</div>
          <div className="text-white text-xl leading-relaxed font-medium">
            I can help with questions, bookings, and anything else you don&apos;t feel like calling about 😀
          </div>
        </div>
      </div>
    </div>
  );
};

const TabBar = ({ primaryColor = "#f97316" }) => {
  return (
    <div className="flex justify-around items-center py-5 px-6 border-t border-gray-100 bg-white rounded-b-3xl">
      {/* Active Home tab with dynamic primary color */}
      <div className="flex flex-col items-center gap-1">
        <div className="p-1">
          <HomeOutlined className="text-xl transition-colors duration-300" style={{ color: primaryColor }} />
        </div>
        <span className="text-sm font-medium transition-colors duration-300" style={{ color: primaryColor }}>
          Home
        </span>
      </div>

      {/* Inactive Messages tab with gray styling */}
      <div className="flex flex-col items-center gap-1 cursor-pointer">
        <div className="p-1">
          <MessageOutlined className="text-xl text-gray-400" />
        </div>
        <span className="text-sm font-medium text-gray-400">Messages</span>
      </div>
    </div>
  );
};

const RightFilledArrowIcon = ({ width = 16, height = 14, fill = "#1A202C" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15.0471 5.57296L2.13792 0.216402C1.59408 -0.00928566 0.979669 0.0899957 0.534513 0.475371C0.0893569 0.860808 -0.0968305 1.45468 0.0486695 2.02521L1.1977 6.53121H6.82351C7.08239 6.53121 7.29229 6.74109 7.29229 7C7.29229 7.25887 7.08242 7.46878 6.82351 7.46878H1.1977L0.0486695 11.9747C-0.0968305 12.5453 0.0893257 13.1392 0.534513 13.5246C0.980576 13.9107 1.59504 14.0088 2.13795 13.7836L15.0471 8.42703C15.6349 8.18315 16 7.63634 16 7C16 6.36365 15.6349 5.81681 15.0471 5.57296Z"
        fill={fill}
      />
    </svg>
  );
};

interface InputFieldProps {
  containerClassName: string;
  inputClassName?: string;
  placeHolder?: string;
  buttonClassName?: string;
  buttonIcon?: React.ReactNode;
  buttonLabel?: string;
}

const InputField = ({
  containerClassName,
  inputClassName = "",
  placeHolder,
  buttonClassName = "",
  buttonIcon,
  buttonLabel = "",
}: InputFieldProps) => {
  return (
    <div className={`${containerClassName}`}>
      <Input
        type="text"
        onChange={() => {}} // No functionality for preview
        value=""
        placeholder={placeHolder}
        className={`${inputClassName}`}
      />
      <button className={`hover:opacity-90 active:opacity-80 ${buttonClassName}`} onClick={() => {}}>
        {buttonIcon || buttonLabel}
      </button>
    </div>
  );
};

const ChatbotPreview = ({ primaryColor = "#2563EB", chatbotName = "Ava", logo = null, chatbotAvatar = null }) => {
  // Add state to force re-renders when props change
  const [renderKey, setRenderKey] = useState(0);

  // Force re-render when critical props change
  useEffect(() => {
    setRenderKey(prev => prev + 1);
    console.log("HomePage props changed:", { primaryColor, chatbotName, logo, chatbotAvatar });
  }, [primaryColor, chatbotName, logo, chatbotAvatar]);

  // Add debugging for image URLs
  useEffect(() => {
    if (logo) {
      console.log("Logo URL received in HomePage:", logo);
    }
    if (chatbotAvatar) {
      console.log("Avatar URL received in HomePage:", chatbotAvatar);
    }
  }, [logo, chatbotAvatar]);

  return (
    <div className="overflow-x-hidden overflow-y-auto custom-scrollbar h-full p-6 max-w-md mx-auto" key={renderKey}>
      <div
        className="border-2 rounded-3xl overflow-hidden bg-white shadow-lg transition-all duration-300"
        style={{ borderColor: primaryColor }}
      >
        <ChatbotHeader primaryColor={primaryColor} chatbotName={chatbotName} logo={logo} chatbotAvatar={chatbotAvatar} />
        <Flex gap={20} vertical className="relative bottom-[33px] px-4">
          <InputField
            containerClassName={"flex items-center border border-gray-300 bg-gray-50 rounded-2xl mt-20 shadow-sm"}
            buttonIcon={<RightFilledArrowIcon width={20} height={20} />}
            placeHolder={"Send us a message"}
            inputClassName={
              "w-full p-4 rounded-2xl font-medium bg-gray-50 text-gray-900 text-sm custom-input !border-none !focus:border-none border-transparent focus:border-transparent focus:ring-0 placeholder:text-gray-500 placeholder:font-normal"
            }
            buttonClassName={"text-gray-600 hover:text-gray-800 rounded-xl m-2 flex items-center justify-center p-2 transition-colors"}
          />

          <Flex className="cursor-pointer border-2 border-gray-200 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <Image src="/images/home.png" className="w-full max-w-full rounded-xl" alt="Help" />
          </Flex>
        </Flex>
        <TabBar primaryColor={primaryColor} />
      </div>
    </div>
  );
};

export default ChatbotPreview;
