"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { Alert, Button, Modal, Spin, Typography, Input, Checkbox, List, Card } from "antd";
import Image from "next/image";
import type React from "react";
import { useState } from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const GoogleLeadFormModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  availableLeadForms = [],
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  onSetCustomerId,
  onSaveSelectedForms,
  buttonLoading,
}) => {
  const [customerId, setCustomerId] = useState("");
  const [selectedForms, setSelectedForms] = useState<string[]>([]);

  const handleCustomerIdSubmit = () => {
    if (customerId.trim() && onSetCustomerId) {
      onSetCustomerId(customerId.trim());
    }
  };

  const handleFormSelection = (formId: string, checked: boolean) => {
    if (checked) {
      setSelectedForms([...selectedForms, formId]);
    } else {
      setSelectedForms(selectedForms.filter(id => id !== formId));
    }
  };

  const handleSaveSelectedForms = () => {
    const formsToSave = availableLeadForms.filter(form => selectedForms.includes(form.id));
    if (onSaveSelectedForms) {
      onSaveSelectedForms(formsToSave);
    }
  };
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
              <Text className="text-lg">Connecting to Google Ads Lead Forms...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}

        {status === "needs_customer_id" && (
          <>
            <Alert
              message="Google Ads Customer ID Required"
              description="Please enter your Google Ads Customer ID to fetch your lead forms."
              type="warning"
              showIcon
              className="mb-4"
            />
            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">
                  Google Ads Customer ID:
                </Text>
                <Input
                  placeholder="e.g., 1234567890"
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  onPressEnter={handleCustomerIdSubmit}
                />
                <Text className="text-sm text-gray-500 mt-1 block">Find this in your Google Ads account under Account settings</Text>
              </div>
              <div className="text-center">
                <Button
                  type="primary"
                  onClick={handleCustomerIdSubmit}
                  disabled={!customerId.trim() || buttonLoading}
                  loading={buttonLoading}
                  className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600"
                >
                  Fetch Lead Forms
                </Button>
              </div>
            </div>
          </>
        )}

        {status === "loading_forms" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Fetching your lead forms...</Text>
              <br />
              <Text className="text-gray-500">Getting available lead forms from Google Ads</Text>
            </div>
          </div>
        )}

        {status === "selecting_forms" && (
          <>
            <Alert
              message="Select Lead Forms to Sync"
              description="Choose which lead forms you want to sync leads from."
              type="info"
              showIcon
              className="mb-4"
            />
            <div className="space-y-4">
              {availableLeadForms.length > 0 ? (
                <>
                  <List
                    dataSource={availableLeadForms}
                    renderItem={form => (
                      <List.Item>
                        <Card size="small" className="w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <Checkbox
                                  checked={selectedForms.includes(form.id)}
                                  onChange={e => handleFormSelection(form.id, e.target.checked)}
                                />
                                <div className="ml-3">
                                  <Text strong className="block">
                                    {form.name}
                                  </Text>
                                  <Text className="text-sm text-gray-500">
                                    Business: {form.business_name} • Action: {form.call_to_action_type}
                                  </Text>
                                  <Text className="text-xs text-gray-400">Customer ID: {form.google_customer_id}</Text>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </List.Item>
                    )}
                  />
                  <div className="text-center mt-4">
                    <Button
                      type="primary"
                      onClick={handleSaveSelectedForms}
                      disabled={selectedForms.length === 0 || buttonLoading}
                      loading={buttonLoading}
                      className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600"
                    >
                      Save Selected Forms ({selectedForms.length})
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Text className="text-gray-500">No lead forms found for this Google Ads account.</Text>
                </div>
              )}
            </div>
          </>
        )}

        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName || "Google Ads"}. Your lead form integration is ready!`}
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
                  {accountInfo.selectedFormsCount && (
                    <>
                      <br />
                      <Text className="text-sm text-gray-600">{accountInfo.selectedFormsCount} lead forms selected for sync</Text>
                    </>
                  )}
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
      </div>
    </Modal>
  );
};
