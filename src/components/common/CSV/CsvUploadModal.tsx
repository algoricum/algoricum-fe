"use client";

import type React from "react";
import { useRef, useState } from "react";
import { Modal,Typography, Popover } from "antd";
import Papa from "papaparse";
import { CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined } from "@ant-design/icons";

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
  const [, setValidationWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Constants for displaying valid values (no validation, just for user reference)
  const VALID_INTEREST_LEVELS = ["high", "medium", "low"];

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

  // Enhanced header validation - only validate required headers and check optional headers presence
  const validateHeaders = (headers: string[]): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredHeaders = ["email", "phone"];
    // const optionalHeaders = ["first_name", "last_name", "notes", "interest_level"];
    // const allValidHeaders = [...requiredHeaders, ...optionalHeaders];

    // Check for required headers
    const missingRequired = requiredHeaders.filter(header => !headers.includes(header));
    if (missingRequired.length > 0) {
      errors.push(`Missing required columns: ${missingRequired.join(", ")}`);
    }

    // No warnings or errors for optional headers - backend will handle defaults
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
      setValidationWarnings([]);

      // Validate only required fields - ensure no missing cells
      const requiredFieldErrors: string[] = [];
      data.forEach((row: any, index: number) => {
        const rowNum = index + 1;

        // Check email is not missing and valid
        if (!row.email || row.email.toString().trim() === "") {
          requiredFieldErrors.push(`Row ${rowNum}: Email is required and cannot be empty`);
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(row.email.toString().trim())) {
            requiredFieldErrors.push(`Row ${rowNum}: Invalid email format (${row.email})`);
          }
        }

        // Check phone is not missing
        if (!row.phone || row.phone.toString().trim() === "") {
          requiredFieldErrors.push(`Row ${rowNum}: Phone is required and cannot be empty`);
        }
      });

      if (requiredFieldErrors.length > 0) {
        const errorMessage =
          requiredFieldErrors.length > 5
            ? `${requiredFieldErrors.slice(0, 5).join("\n")}\n... and ${requiredFieldErrors.length - 5} more errors`
            : requiredFieldErrors.join("\n");
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
                interest_level (
                <Popover content={renderValidValuesContent(VALID_INTEREST_LEVELS)} title="Valid Interest Levels" trigger="hover">
                  <span className="inline-flex items-center gap-1 text-blue-700 cursor-help hover:underline">
                    Valid Values <EyeOutlined className="text-blue-500" />
                  </span>
                </Popover>
                ) - Default: &quot;medium&quot;
              </li>
            </ul>
          </div>
        </div>

        {/* Default Values Information */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-sm font-semibold text-green-800 mb-2 block">💡 Default Values:</Text>
          <div className="text-sm text-green-700 space-y-1">
            <p>If optional columns are empty or contain invalid values, these defaults will be used:</p>
            <ul className="ml-4 space-y-1 list-disc list-inside">
              <li>
                <strong>interest_level:</strong> &quot;medium&quot;
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

          {/* Validation Warnings - Remove this section since we don't show warnings */}

          {/* Success Message */}
          {csvLeads.length > 0 && !csvValidationError && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <Text className="text-green-700 text-sm">
                <CheckCircleOutlined className="mr-1" />
                File validated successfully ({csvLeads.length} leads found)
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
              first_name,last_name,email,phone,interest_level,notes
              <br />
              John,Doe,john.doe@email.com,+1234567890,high,Interested in consultation
              <br />
              Jane,Smith,jane.smith@email.com,+1234567891,medium,Follow up next week
              <br />
              Bob,Johnson,bob.johnson@email.com,+1234567892,,Contact tomorrow
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <div>⚠️ Email and phone columns must have values for all rows</div>
              <div>💡 Optional columns can be empty - backend will assign default values</div>
              <div>🔍 Hover over &quot;Valid Values&quot; to see acceptable values for interest_level</div>
              <div>✨ Invalid or empty optional values will be replaced with defaults automatically</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CsvUploadModal;
