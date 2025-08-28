"use client";

import { Modal, Alert, Button, Typography, Spin } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type React from "react";
import Image from "next/image";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const GoogleLeadFormModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  buttonLoading,
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/google.svg" alt="Google" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-800">Connect to Google</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{
        className: "!bg-gray-500 !border-gray-500 hover:!bg-gray-600 !text-white text-bold",
        style: { backgroundColor: "#6b7280", borderColor: "#6b7280" },
      }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect Google Ads Lead Forms"
              description="Automatically sync leads from your Google Ads Lead Forms to our platform."
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
                icon={<Image src="/google.svg" alt="Google" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600 h-12 px-8 text-lg font-medium"
              >
                Connect to Google
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />
                  • You&apos;ll be redirected to Google to sign in
                  <br />• Grant permission to access your lead form responses
                  <br />• We&apos;ll automatically sync your leads
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
          </>
        )}

        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to Google Ads Lead Forms...</Text>
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
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-gray-800">
                    Google Ads Lead Forms Integration Active
                  </Text>
                  <br />
                  <Text className="text-gray-600 text-sm">{accountInfo.responseCount || 0} responses synced</Text>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-gray-600 border-gray-600 hover:bg-gray-700"
                  >
                    Sync Leads
                  </Button>
                  <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Text className="text-gray-600">
                ⚡ Your Google Ads Lead Forms integration is ready! Need further help? Book a support meeting.
              </Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/your-team/google-ads-lead-form-setup", "_blank")}
                className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
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
