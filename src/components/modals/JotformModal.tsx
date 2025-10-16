"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { Alert, Button, Modal, Spin, TreeSelect, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { useEffect } from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const JotformModal: React.FC<ModalProps> = ({
  open,
  status,
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
  useEffect(() => {
    if (!window.JF) {
      const script = document.createElement("script");
      script.src = "https://js.jotform.com/JotForm.min.js";
      script.async = true;
      script.onload = () => {
        window.JF.initialize({
          appName: window.location.host || "MyApp",
          accessType: "full",
          enableCookieAuth: true,
        });
      };
      document.body.appendChild(script);
    }
  }, []);

  const handleConnect = () => {
    if (!window.JF) return;
    window.JF.login(
      () => {
        const token = window.JF.getAPIKey();
        window.JF.getUser(() => {
          console.log("Jotform auth successful", token);
          onConnect?.(token);
        });
      },
      () => {
        console.error("Jotform auth failed");
      },
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/jotform.svg" alt="Jotform" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-800">Connect to Jotform</span>
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
              message="Connect your Jotform"
              description="We can automatically sync form responses from your Jotform to our platform."
              className="mb-6 !bg-gray-100 !border-gray-300 !text-gray-800"
              type="info"
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
                icon={<Image src="/jotform.svg" alt="Jotform" width={25} height={25} />}
                onClick={handleConnect}
                className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600 h-12 px-8 text-lg font-medium"
              >
                Connect to Jotform
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />• A Jotform login popup opens
                  <br />• Grant access to your forms
                  <br />• We&apos;ll sync your leads automatically
                  <br />• Takes less than 30 seconds
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
              <Text className="text-lg">Connecting to Jotform...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization</Text>
            </div>
          </div>
        )}
        {status === "connected" && (
          <>
            <Alert message="Successfully Connected!" type="success" showIcon className="mb-4 !border-gray-100" />
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
            <div className="bg-gray-100 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-gray-800">
                    Jotform Integration Active
                  </Text>
                  <br />
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-gray-500 border-gray-700 text-white hover:!bg-gray-600 hover:!text-white"
                  >
                    Sync Leads
                  </Button>
                  <Button type="link" danger onClick={onDisconnect} className="text-red-500 hover:!text-red-600 ">
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Text className="text-gray-600">⚡ Your Jotform integration is ready!</Text>
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
