"use client";

import { Modal, Alert, Button, Typography, Spin } from "antd";
import type React from "react";
import Image from "next/image";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";
import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";


const { Text } = Typography;

export const GoHighLevelLeadFormModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect, buttonLoading }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-[#100D4D] rounded-lg flex items-center justify-center mr-3">
          <Image src="/gohighlevel.jpeg" width={32} height={32} alt="GoHighLevel" />
        </div>
        <span className="text-xl font-semibold">Connect to GoHighLevel</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-[#100D4D] border-[#100D4D]" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your GoHighLevel Account"
            description="We can automatically sync leads from your GoHighLevel contacts to our platform."
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
            <Button
              loading={buttonLoading}
              disabled={buttonLoading}
              type="primary"
              size="large"
              icon={<Image src="/gohighlevel.jpeg" width={30} height={30} alt="GoHighLevel" />}
              onClick={() => onConnect?.()}
              className="bg-[#100D4D] border-[#100D4D] h-12 px-8 text-lg font-medium"
            >
              Connect to GoHighLevel
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />
                • You&apos;ll be redirected to GoHighLevel to sign in
                <br />• Grant permission to access your contacts
                <br />• We&apos;ll automatically sync your leads
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
          <BookingLinkComponent
            bgColor="bg-blue-50"
            borderColor="border-blue-400"
            textColor="navy-400"
            buttonBgColor="navy-400" // Normal button color
            hoverBgColor="blue-600" // Hover color
          />
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to GoHighLevel...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your GoHighLevel integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="mt-4 text-center">
            <Text className="text-gray-600">⚡ Your GoHighLevel integration is ready! Need further help? Book a support meeting.</Text>
            <br />
          </div>
          <BookingLinkComponent
            bgColor="bg-blue-50"
            borderColor="border-blue-400"
            textColor="navy-400"
            buttonBgColor="navy-400" // Normal button color
            hoverBgColor="blue-600" // Hover color
          />
        </>
      )}
    </div>
  </Modal>
);
