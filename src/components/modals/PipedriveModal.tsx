"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { Alert, Button, Modal, Spin, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const PipedriveModal: React.FC<ModalProps> = ({
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
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
            <Image src="/pipedrive.jpeg" alt="Pipedrive" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold">Connect to Pipedrive</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : status === "connecting" ? "Connecting..." : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{
        className: "bg-green-700 border-green-700 hover:!bg-green-900",
        loading: status === "connecting",
      }}
      width={600}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect Pipedrive for CRM Integration"
              description="Connect your Pipedrive CRM to automatically sync your leads, contacts, and deals with our platform."
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
                icon={<Image src="/pipedrive.jpeg" alt="Pipedrive" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="bg-green-700 border-green-700 hover:!bg-green-900 h-12 px-8 text-lg font-medium"
              >
                Connect to Pipedrive
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />• You&apos;ll be redirected to Pipedrive to sign in
                  <br />• Grant permission to access your CRM data
                  <br />• We&apos;ll automatically sync your leads and deals
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
            <BookingLinkComponent
              bgColor="bg-green-50"
              borderColor="border-green-200"
              textColor="green-700"
              buttonBgColor="green-700"
              hoverBgColor="green-900"
            />
          </>
        )}

        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to Pipedrive...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}

        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Moving to next step...`}
              type="success"
              showIcon
              className="mb-4"
            />

            <div className="bg-green-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-green-800">
                    Pipedrive Integration Active
                  </Text>
                  <br />
                  <Text className="text-green-600 text-sm">{accountInfo.responseCount || 0} leads synced</Text>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-green-600 border-green-600 hover:bg-green-700"
                  >
                    Sync Leads
                  </Button>
                  <Button type="link" danger onClick={() => onDisconnect?.()} className="text-red-500">
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
