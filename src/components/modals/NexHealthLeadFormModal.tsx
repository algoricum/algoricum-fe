"use client";

import { Modal, Alert, Button, Typography, Spin, Input } from "antd";
import { CalendarOutlined, LinkOutlined } from "@ant-design/icons";
import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";
import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";


const { Text } = Typography;

export const NexHealthLeadFormModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect, buttonLoading }) => {
  const [apiKey, setApiKey] = useState("");

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-black-400 rounded-lg flex items-center justify-center mr-3">
            <Image src="/nexHealth.png" alt="NexHealth" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold">Connect to NexHealth</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{ className: "bg-gray-500 border-gray-500  hover:!bg-gray-600" }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your NexHealth Account"
              description="Enter your API key to sync patients and appointments from NexHealth."
              type="info"
              className="mb-6 !bg-gray-100 !border-gray-300 !text-gray-800"
              style={{
                ...commonAlertStyles,
                backgroundColor: "#f9fafb",
                borderColor: "#d1d5db",
                color: "#1f2937",
              }}
            />

            <div className="text-center">
              <Input.Password
                placeholder="Enter NexHealth API Key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="mb-4 h-12 text-lg"
              />
              <Button
                loading={buttonLoading}
                type="primary"
                size="large"
                icon={<LinkOutlined />}
                onClick={() => apiKey && onConnect?.(apiKey)}
                disabled={!apiKey}
                className={`h-12 px-8 text-lg font-medium ${
                  apiKey ? "bg-gray-500 border-gray-500  hover:!bg-gray-600" : "bg-gray-600 border-gray-500"
                }`}
              >
                Connect to NexHealth
              </Button>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />• You&apos;ll be redirected to NexHealth
                  <br />• Grant permission to access your institution data
                  <br />• We&apos;ll automatically sync your patients
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
            <BookingLinkComponent
              bgColor="bg-gray-50"
              borderColor="border-gray-500"
              textColor="gray-700"
              buttonBgColor="gray-500" // Normal button color (matches your Tailwind)
              hoverBgColor="gray-600" // Hover color (matches your Tailwind)
            />
          </>
        )}

        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to NexHealth...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}

        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your NexHealth integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4 text-center">
              <Text className="text-gray-600">⚡ Your NexHealth integration is ready! Need further help? Book a support meeting.</Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/abdullah-salman-hashlogics/30min", "_blank")}
                className="mt-2 bg-blue-600 border-blue-600 hover:bg-blue-700"
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
