"use client";

import type React from "react";
import { useRef, useState } from "react";
import { Modal, Alert, Typography, Popover } from "antd";
import Papa from "papaparse";
import { CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CsvUploadModalProps {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOk: (leads: any[]) => void;
  onCancel: () => void;
  okText?: string;
  cancelText?: string;
}

const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ open, onOk, onCancel, okText = "Upload CSV", cancelText = "Skip for Now" }) => {
  const [csvLeads, setCsvLeads] = useState<any[]>([]);
  const [csvValidationError, setCsvValidationError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Constants for validation levels
  const VALID_INTEREST_LEVELS = ["high", "medium", "low"];
  const VALID_URGENCY_LEVELS = ["asap", "this_month", "curious"];
  const VALID_STATUSES = [
    "new",
    "responded",
    "needs-follow-up",
    "in-nurture",
    "cold",
    "reactivated",
    "booked",
    "confirmed",
    "no-show",
    "converted",
    "not-interested",
    "archived",
  ];

  const parseCSVFile = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep everything as strings for better validation
        complete: result => resolve(result),
        error: error => reject(error),
      });
    });
  };

  // Enhanced validation function that matches backend logic
  const validateOptionalColumns = (data: any[]): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    data.forEach((row: any, index: number) => {
      const rowNum = index + 1;

      // Validate interest_level if present
      if (Object.prototype.hasOwnProperty.call(row, "interest_level") && row.interest_level !== null && row.interest_level !== undefined) {
        const value = row.interest_level.toString().trim().toLowerCase();
        if (value !== "" && !VALID_INTEREST_LEVELS.includes(value)) {
          errors.push(`Row ${rowNum}: Invalid interest_level "${row.interest_level}". Valid values: ${VALID_INTEREST_LEVELS.join(", ")}`);
        }
      }

      // Validate urgency if present
      if (Object.prototype.hasOwnProperty.call(row, "urgency") && row.urgency !== null && row.urgency !== undefined) {
        const value = row.urgency.toString().trim().toLowerCase();
        if (value !== "" && !VALID_URGENCY_LEVELS.includes(value)) {
          errors.push(`Row ${rowNum}: Invalid urgency "${row.urgency}". Valid values: ${VALID_URGENCY_LEVELS.join(", ")}`);
        }
      }

      // Validate status if present
      if (Object.prototype.hasOwnProperty.call(row, "status") && row.status !== null && row.status !== undefined) {
        const value = row.status.toString().trim().toLowerCase();
        if (value !== "" && !VALID_STATUSES.includes(value)) {
          errors.push(`Row ${rowNum}: Invalid status "${row.status}". Valid values: ${VALID_STATUSES.join(", ")}`);
        }
      }
    });

    return { errors, warnings };
  };

  // Enhanced header validation
  const validateHeaders = (headers: string[]): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredHeaders = ["email", "phone"];
    const optionalHeaders = ["first_name", "last_name", "notes", "status", "interest_level", "urgency"];
    const allValidHeaders = [...requiredHeaders, ...optionalHeaders];

    // Check for required headers
    const missingRequired = requiredHeaders.filter(header => !headers.includes(header));
    if (missingRequired.length > 0) {
      errors.push(`Missing required columns: ${missingRequired.join(", ")}`);
    }

    // Check for unknown headers
    const unknownHeaders = headers.filter(header => !allValidHeaders.includes(header));
    if (unknownHeaders.length > 0) {
      warnings.push(`Unknown columns found: ${unknownHeaders.join(", ")}. These will be ignored.`);
    }

    return { errors, warnings };
  };

  const handleCsvLeads = async (file: File) => {
    setCsvValidationError(null);
    setValidationWarnings([]);

    if (!file) {
      setCsvLeads([]);
      return;
    }

    try {
      const result = await parseCSVFile(file);

      if (!result || !result.data || !Array.isArray(result.data)) {
        setCsvValidationError("Invalid CSV file format. Please check your file and try again.");
        setCsvLeads([]);
        return;
      }

      const data = result.data;

      if (data.length === 0) {
        setCsvValidationError("CSV file is empty. Please add some leads and try again.");
        setCsvLeads([]);
        return;
      }

      const headers = Object.keys(data[0] || {});

      // Validate headers
      const headerValidation = validateHeaders(headers);
      if (headerValidation.errors.length > 0) {
        setCsvValidationError(headerValidation.errors.join("\n"));
        setCsvLeads([]);
        return;
      }

      // Set warnings for unknown columns
      setValidationWarnings(headerValidation.warnings);

      // Validate required fields
      const requiredFieldErrors: string[] = [];
      data.forEach((row: any, index: number) => {
        const rowNum = index + 1;

        if (!row.email || row.email.toString().trim() === "") {
          requiredFieldErrors.push(`Row ${rowNum}: Email is required`);
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(row.email.toString().trim())) {
            requiredFieldErrors.push(`Row ${rowNum}: Invalid email format (${row.email})`);
          }
        }

        if (!row.phone || row.phone.toString().trim() === "") {
          requiredFieldErrors.push(`Row ${rowNum}: Phone is required`);
        }
      });

      // Validate optional columns
      const optionalValidation = validateOptionalColumns(data);
      const allErrors = [...requiredFieldErrors, ...optionalValidation.errors];

      if (allErrors.length > 0) {
        const errorMessage =
          allErrors.length > 5 ? `${allErrors.slice(0, 5).join("\n")}\n... and ${allErrors.length - 5} more errors` : allErrors.join("\n");
        setCsvValidationError(errorMessage);
        setCsvLeads([]);
        return;
      }

      setCsvLeads(data);
      setCsvValidationError(null);
    } catch (error) {
      let message = "Unknown error";
      if (error instanceof Error) {
        message = error.message;
      }
      setCsvValidationError(`Error reading CSV file: ${message}`);
      setCsvLeads([]);
    }
  };

  // Helper function to render the content for the Popover
  const renderValidValuesContent = (values: string[]) => (
    <div className="flex flex-wrap gap-1 p-2 max-w-xs">
      {values.map(value => (
        <span key={value} className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs whitespace-nowrap">
          {value}
        </span>
      ))}
    </div>
  );

  // Custom cancel handler to clear state
  const handleCancelAndClearState = () => {
    setCsvLeads([]);
    setCsvValidationError(null);
    setValidationWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
            <Text className="text-white font-bold text-sm">CSV</Text>
          </div>
          <span className="text-xl font-semibold">Upload Your Leads</span>
        </div>
      }
      open={open}
      onOk={() => onOk(csvLeads)}
      onCancel={handleCancelAndClearState}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{
        className: "bg-purple-500 border-purple-500",
        disabled: csvLeads.length === 0 || !!csvValidationError,
      }}
      width={600}
      centered
    >
      <div className="py-6">
        <Alert
          message="Upload your leads via CSV"
          description="Upload a properly formatted CSV file to import your existing leads into our platform."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          className="mb-6"
        />

        {/* CSV Format Requirements */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <Text className="text-sm font-semibold text-blue-800 mb-2 block">📋 Required CSV Format:</Text>
          <div className="text-sm text-blue-700 space-y-1">
            <div>
              <strong>Required Columns:</strong>
            </div>
            <ul className="ml-4 space-y-1 list-disc list-inside">
              <li>
                <span className="font-medium">email</span> - Must not be empty
              </li>
              <li>
                <span className="font-medium">phone</span> - Must not be empty
              </li>
            </ul>
            <div className="mt-3">
              <strong>Optional Columns:</strong>
            </div>
            <ul className="ml-4 space-y-1 list-disc list-inside">
              <li>first_name</li>
              <li>last_name</li>
              <li>notes</li>
              <li>
                status (
                <Popover content={renderValidValuesContent(VALID_STATUSES)} title="Valid Status Values" trigger="hover">
                  <span className="inline-flex items-center gap-1 text-blue-700 cursor-help hover:underline">
                    Valid Values <EyeOutlined className="text-blue-500" />
                  </span>
                </Popover>
                )
              </li>
              <li>
                interest_level (
                <Popover content={renderValidValuesContent(VALID_INTEREST_LEVELS)} title="Valid Interest Levels" trigger="hover">
                  <span className="inline-flex items-center gap-1 text-blue-700 cursor-help hover:underline">
                    Valid Values <EyeOutlined className="text-blue-500" />
                  </span>
                </Popover>
                )
              </li>
              <li>
                urgency (
                <Popover content={renderValidValuesContent(VALID_URGENCY_LEVELS)} title="Valid Urgency Levels" trigger="hover">
                  <span className="inline-flex items-center gap-1 text-blue-700 cursor-help hover:underline">
                    Valid Values <EyeOutlined className="text-blue-500" />
                  </span>
                </Popover>
                )
              </li>
            </ul>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="text-center">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleCsvLeads(e.target.files[0]);
              } else {
                setCsvLeads([]);
                setCsvValidationError(null);
                setValidationWarnings([]);
              }
            }}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-50 file:text-purple-700
              hover:file:bg-purple-100"
          />

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-yellow-700 text-sm">
                <ExclamationCircleOutlined className="mr-1" />
                <strong>Warnings:</strong>
                <br />
                {validationWarnings.join("\n")}
              </Text>
            </div>
          )}

          {/* Success Message */}
          {csvLeads.length > 0 && !csvValidationError && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <Text className="text-green-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                File validated successfully ({csvLeads.length} leads found)
                {validationWarnings.length > 0 && (
                  <span className="block mt-1 text-xs">Note: Some columns will use default values or be ignored (see warnings above)</span>
                )}
              </Text>
            </div>
          )}

          {/* Error Message */}
          {csvValidationError && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <Text className="text-red-700 text-sm">
                <ExclamationCircleOutlined className="mr-1" />
                <strong>Validation Error:</strong>
                <br />
                <pre className="whitespace-pre-wrap">{csvValidationError}</pre>
              </Text>
            </div>
          )}

          {/* Enhanced Example */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm font-semibold text-gray-700 mb-2">📄 Example CSV Format:</Text>
            <div className="text-xs text-gray-600 bg-white p-3 rounded border font-mono">
              first_name,last_name,email,phone,status,interest_level,urgency,notes
              <br />
              John,Doe,john.doe@email.com,+1234567890,new,high,asap,Interested in consultation
              <br />
              Jane,Smith,jane.smith@email.com,+1234567891,responded,medium,this_month,Follow up next week
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <div>⚠️ Make sure email and phone columns have values for all rows</div>
              <div>💡 Optional columns can be empty - they&apos;ll use default values</div>
              <div>🔍 Hover over &quot;Valid Values&quot; above to see acceptable values for each column</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CsvUploadModal;
