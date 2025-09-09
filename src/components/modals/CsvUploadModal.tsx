"use client";
import { Alert, Button, Modal, Typography, Upload } from "antd";
import Image from "next/image";
import type React from "react";
import { CsvUploadModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ open, onOk, onCancel }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
          <Image src="/csv.png" alt="CSV" width={25} height={25} />
        </div>
        <span className="text-xl font-semibold">Upload Leads via CSV</span>
      </div>
    }
    open={open}
    onOk={() => onOk(null)}
    onCancel={onCancel}
    okText="Upload"
    cancelText="Cancel"
    okButtonProps={{ className: "!bg-gray-500 !border-gray-500 hover:!bg-gray-600" }}
    width={500}
    centered
  >
    <div className="py-6">
      <Alert
        message="Upload your leads"
        description="Upload a CSV file containing your leads to import them into the platform."
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
        <Upload
          accept=".csv"
          beforeUpload={file => {
            onOk(file);
            return false;
          }}
          showUploadList={false}
        >
          <Button
            type="primary"
            size="large"
            icon={<Image src="/csv.png" alt="csv" width={25} height={25} />}
            className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600 h-12 px-8 text-lg font-medium"
          >
            Select CSV File
          </Button>
        </Upload>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Text className="text-sm text-gray-600">
            <strong>What happens next:</strong>
            <br />• Select a CSV file with your leads
            <br />• We&apos;ll help you map the fields
            <br />• Your leads will be imported into our platform
            <br />• Takes less than a minute!
          </Text>
        </div>
      </div>
    </div>
  </Modal>
);
