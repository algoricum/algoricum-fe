"use client";

import { Modal, Alert, Button, TreeSelect, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type React from "react";
import Image from "next/image";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const GoogleFormModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  treeData,
  selectedWorksheets,
  onSelectWorksheets,
  buttonLoading,
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/google.svg" alt="Google" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-500">Connect to Google Forms</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{ className: "!bg-gray-500 !border-gray-500 hover:!bg-gray-600" }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your Google Forms"
              description="We can automatically sync leads from your Google Forms to our platform."
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
                  <br />• You&apos;ll be redirected to Google to sign in
                  <br />• Grant permission to access your form responses
                  <br />• We&apos;ll automatically sync your leads
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
          </>
        )}
        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your form integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4">
              <Text className="block mb-2">Select worksheets to sync leads from:</Text>
              <TreeSelect
                style={{ width: "100%" }}
                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                placeholder="Select worksheets"
                treeData={treeData}
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                value={selectedWorksheets}
                onChange={onSelectWorksheets}
              />
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-yellow-800">
                    Google Forms Integration Active
                  </Text>
                  <br />
                  <Text className="text-yellow-600 text-sm">{accountInfo.responseCount || 0} responses synced</Text>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
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
              <Text className="text-gray-600">⚡ Your Google Forms integration is ready! Need further help? Book a support meeting.</Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/your-team/google-form-setup", "_blank")}
                className="mt-2 !bg-gray-500 !border-gray-500 hover:!bg-gray-600"
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
