"use client";
import { Alert, Button, Modal, Spin, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";
import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";



const { Text } = Typography;

export const HubspotModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect, buttonLoading }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center mr-3">
          <Image src="/hubspot.svg" alt="HubSpot" width={25} height={25} />
        </div>
        <span className="text-xl font-semibold">Connect to HubSpot</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "!bg-orange-400 !border-orange-400 hover:!bg-orange-600 " }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your HubSpot account"
            description="We'll automatically sync your contacts and deals. This takes just one click!"
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
              icon={<Image src="/hubspot.svg" alt="HubSpot" width={25} height={25} />}
              onClick={() => onConnect?.()}
              className="bg-orange-400 border-orange-400 hover:!bg-orange-600 h-12 px-8 text-lg font-medium"
            >
              Connect to HubSpot
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to HubSpot to sign in
                <br />• Grant permission to access your contacts
                <br />• We&apos;ll automatically sync everything
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
          <BookingLinkComponent
            bgColor="bg-orange-50"
            borderColor="border-orange-400"
            textColor="orange-700"
            buttonBgColor="orange-400" // Normal button color (matches your Tailwind)
            hoverBgColor="orange-600" // Hover color (matches your Tailwind)
          />
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to HubSpot...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
          <span className="text-xl font-semibold text-gray-800">Connect to HubSpot</span>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <Alert
          message="Successfully Connected!"
          description={`Connected to ${accountInfo.accountName}. Moving to next step...`}
          type="success"
          showIcon
          className="mb-4"
        />
      )}
    </div>
  </Modal>
);
