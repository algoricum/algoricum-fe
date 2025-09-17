"use client";
import { Alert, Button, Modal, Spin, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const CalendlyModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect, buttonLoading }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center mr-3">
          <Image src="/calendly.svg" alt="Calendly" width={25} height={25} />
        </div>
        <span className="text-xl font-semibold">Connect to Calendly</span>
      </div>
    }
    open={open}
    onOk={status === "connected" ? onOk : undefined}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : undefined}
    cancelText="Cancel"
    okButtonProps={{
      className: "!bg-blue-500 !border-blue-500 hover:!bg-blue-600",
      style: { display: status === "connected" ? "inline-block" : "none" },
    }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your Calendly account"
            description="We'll automatically sync your booking links and events. This takes just one click!"
            type="info"
            className="mb-6 !bg-gray-100 !border-gray-300 !text-gray-800"
            style={commonAlertStyles}
          />
          <div className="text-center">
            <Button
              loading={buttonLoading}
              disabled={buttonLoading}
              type="primary"
              size="large"
              icon={<Image src="/calendly.svg" alt="Calendly" width={25} height={25} />}
              onClick={() => onConnect?.()}
              className="bg-blue-500 border-blue-500 hover:!bg-blue-600 h-12 px-8 text-lg font-medium"
            >
              Connect to Calendly
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to Calendly to sign in
                <br />• Grant permission to access your booking links
                <br />• We&apos;ll automatically sync your event types
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Text className="text-sm text-blue-700">
                <strong>Why connect Calendly?</strong>
                <br />• Seamless appointment booking for your patients
                <br />• Automatic calendar sync with your clinic
                <br />• Professional booking experience
                <br />• No more manual scheduling!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Calendly...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <Alert
          message="Successfully Connected!"
          description={`Connected to ${accountInfo.accountName || "your Calendly account"}. Your booking links are now ready!`}
          type="success"
          showIcon
          className="mb-4"
        />
      )}
    </div>
  </Modal>
);
