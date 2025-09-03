"use client";

import { Modal, Alert, Button, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import type React from "react";
import { CustomCrmModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const CustomCrmModal: React.FC<CustomCrmModalProps> = ({ open, onOk, onCancel }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">CRM</Text>
        </div>
        <span className="text-xl font-semibold">Custom CRM Integration</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText="Submit"
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      <Alert
        message="Custom CRM Integration"
        description="Let us know about your CRM, and our team will assist with the integration."
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
        <Text className="text-sm text-gray-600">Please contact our support team to set up your custom CRM integration.</Text>
        <br />
        <Button
          type="primary"
          size="large"
          icon={<CalendarOutlined />}
          onClick={() => window.open("https://calendly.com/abdullah-salman-hashlogics/30min", "_blank")}
          className="!mt-4 !bg-gray-600 !border-gray-600 hover:!bg-purple-600 h-12 px-8 text-lg font-medium"
        >
          Book a Support Meeting
        </Button>
      </div>
    </div>
  </Modal>
);