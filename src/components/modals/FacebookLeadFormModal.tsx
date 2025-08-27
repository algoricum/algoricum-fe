"use client";

import { Modal, Alert, Button, Typography, Spin } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type React from "react";
import Image from "next/image";
import { ModalProps } from "./types";
// Removed unused import

const { Text } = Typography;

export const FacebookLeadFormModal: React.FC<ModalProps> = ({ 
  open, 
  status, 
  accountInfo, 
  onOk, 
  onCancel, 
  onConnect 
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/facebook2.svg" alt="Facebook" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-800">Connect to Facebook</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{
        className: "!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800 !text-white",
        style: { backgroundColor: "#6b7280", borderColor: "#6b7280" },
      }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your Facebook Lead Ads"
              description="We can automatically sync leads from your Facebook Lead Ads to our platform."
              type="info"
              showIcon
              className="mb-6 !bg-blue-50 !border-blue-300 !text-gray-800"
            />
            <div className="text-center">
              <Button
                type="primary"
                size="large"
                icon={<Image src="/facebook2.svg" alt="Facebook" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800 h-12 px-8 text-lg font-medium"
              >
                Connect to Facebook
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />
                  • You&apos;ll be redirected to Facebook to sign in<br />• Grant permission to access your lead form responses<br />• We&apos;ll automatically sync your leads<br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
          </>
        )}
        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to Facebook...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}
        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your lead form integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4 text-center">
              <Text className="text-gray-600">
                ⚡ Your Facebook Lead Ads integration is ready! Need further help? Book a support meeting.
              </Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/your-team/facebook-lead-form-setup", "_blank")}
                className="mt-2 !bg-gray-500 !border-gray-500 hover:!bg-purple-700"
              >
                Book a Support Meeting
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};