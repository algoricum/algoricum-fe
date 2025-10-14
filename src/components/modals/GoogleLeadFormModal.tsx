"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { Alert, Button, Modal, Select, Typography } from "antd";
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
  availableCustomerIds = [],
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  onSaveSelectedForms,
  onSelectCustomerId,
  buttonLoading,
}) => {
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Debug logging
  console.log("🔍 GoogleLeadFormModal Debug:", {
    open,
    status,
    accountInfo,
    availableLeadForms: availableLeadForms?.length || 0,
    availableCustomerIds: availableCustomerIds?.length || 0,
  });

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

        {status === "connected" && (
          <>
            {/* Customer Selection Dropdown */}
            {availableCustomerIds.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <Text strong className="block mb-3 text-gray-800">
                  Select Google Ads Account:
                </Text>
                <Select
                  placeholder="Choose your Google Ads account"
                  style={{ width: "100%" }}
                  value={selectedCustomerId || undefined}
                  onChange={value => {
                    setSelectedCustomerId(value);
                    if (onSelectCustomerId) {
                      onSelectCustomerId(value);
                    }
                  }}
                  loading={buttonLoading}
                  disabled={buttonLoading}
                >
                  {availableCustomerIds.map(customerId => (
                    <Select.Option key={customerId} value={customerId}>
                      Customer ID: {customerId}
                    </Select.Option>
                  ))}
                </Select>
                <Text className="text-xs text-gray-500 mt-1 block">Select the Google Ads account to sync lead forms from</Text>
              </div>
            )}

            {/* Lead Forms Selection Dropdown */}
            {availableLeadForms.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <Text strong className="block mb-3 text-gray-800">
                  Select Lead Forms to Sync:
                </Text>
                <Select
                  mode="multiple"
                  placeholder="Choose lead forms to sync"
                  style={{ width: "100%" }}
                  value={selectedForms}
                  onChange={value => setSelectedForms(value)}
                  loading={buttonLoading}
                  disabled={buttonLoading}
                >
                  {availableLeadForms.map(form => (
                    <Select.Option key={form.id} value={form.id}>
                      {form.name || `Form ${form.id}`} - {form.business_name}
                    </Select.Option>
                  ))}
                </Select>
                <Text className="text-xs text-gray-500 mt-1 block">Select one or more lead forms to sync leads from</Text>

                {selectedForms.length > 0 && (
                  <div className="mt-3">
                    <Button
                      type="primary"
                      onClick={handleSaveSelectedForms}
                      disabled={buttonLoading}
                      loading={buttonLoading}
                      className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600"
                    >
                      Save Selected Forms ({selectedForms.length})
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-gray-800">
                    Google Ads Lead Forms Integration Active
                  </Text>
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
