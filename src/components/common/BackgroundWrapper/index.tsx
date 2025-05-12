import { Flex } from "antd";
import React from "react";
interface BackgroundWrapperProps {
  children: React.ReactNode | React.ReactNode[]; // The content to render inside the background wrapper.
  className?: string;
}
const BackgroundWrapper = ({ children, className = "" }: BackgroundWrapperProps) => {
  return (
    <Flex vertical className={`w-full relative h-screen bg-Gray50 ${className}`}>
      <div className="absolute -top-[50%] left-1/2 transform -translate-x-1/2 w-full h-full max-w-[600px] max-h-[600px] rounded-full bg-Primary1000 blur-[220px] opacity-[30%] " />
      {children}
    </Flex>
  );
};

export default BackgroundWrapper;
