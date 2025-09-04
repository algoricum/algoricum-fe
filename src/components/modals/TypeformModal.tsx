"use client";
import { CalendarOutlined } from "@ant-design/icons";
import { Alert, Button, Modal, Spin, TreeSelect, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const TypeformModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  treeData,
  selectedForms,
  onSelectForms,
  buttonLoading,
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/typeform.jpeg" alt="TypeForm" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-800">Connect to Typeform</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{
        className: "!bg-gray-500 !border-gray-500 hover:!bg-gray-600 !text-white",
        style: { backgroundColor: "#6b7280", borderColor: "#6b7280" },
      }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your Typeform"
              description="We can automatically sync leads from your Typeform forms to our platform."
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
                icon={<Image src="/typeform.jpeg" alt="Typeform" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600 h-12 px-8 text-lg font-medium"
              >
                Connect to Typeform
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />
                  • You&apos;ll be redirected to Typeform to sign in
                  <br />• Grant permission to access your form responses
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
              <Text className="text-lg">Connecting to Typeform...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}
        {status === "connected" && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your form integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4">
              <Text className="block mb-2">Select forms to sync leads from:</Text>
              <TreeSelect
                style={{ width: "100%" }}
                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                placeholder="Select forms"
                treeData={treeData}
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                value={selectedForms}
                onChange={onSelectForms}
              />
            </div>
            <div className="bg-black rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-white">
                    Typeform Integration Active
                  </Text>
                  <br />
                  <Text className="text-gray-300 text-sm">0 responses synced</Text>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-gray-800 border-gray-800 hover:bg-gray-900"
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
              <Text className="text-gray-600">⚡ Your Typeform integration is ready! Need help?</Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/abdullah-salman-hashlogics/30min", "_blank")}
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
