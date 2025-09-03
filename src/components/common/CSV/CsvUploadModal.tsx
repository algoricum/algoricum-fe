"use client";

import type React from "react";
import { useRef, useState } from "react";
import { Modal, Typography, Popover } from "antd";
import Papa from "papaparse";
import { CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CsvUploadModalProps {
  open: boolean;
   
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

  // Add header normalization function
  const normalizeHeaders = (data: any[]): any[] => {
    if (!data || data.length === 0) return data;

    // Define variations of email headers to normalize
    const emailVariations = [
      "E-mail",
      "e-mail",
      "Email",
      "email ",
      "Email ",
      "EMAIL",
      "mail ",
      "Mail",
      "MAIL",
      "mail",
      " email",
      " Email",
      "e_mail",
      "E_mail",
    ];

    // Define variations of phone headers to normalize
    const phoneVariations = [
      "Phone",
      "phone-no",
      "phone_number",
      "phone_no",
      "phone",
      "PHONE",
      "phone ",
      "Phone ",
      "telephone",
      "Telephone",
      "TELEPHONE",
      "mobile",
      "Mobile",
      "MOBILE",
      " phone",
      " Phone",
    ];

    return data.map(row => {
      const normalizedRow: any = {};

      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();

        // Normalize email headers
        if (emailVariations.includes(trimmedKey)) {
          normalizedRow["email"] = row[key];
        }
        // Normalize phone headers
        else if (phoneVariations.includes(trimmedKey)) {
          normalizedRow["phone"] = row[key];
        }
        // Keep other headers as-is but trimmed and normalized
        else {
          const normalizedKey = trimmedKey.toLowerCase().replace(/\s+/g, "_");
          normalizedRow[normalizedKey] = row[key];
        }
      });

      return normalizedRow;
    });
  };

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

      let data = result.data;

      if (data.length === 0) {
        setCsvValidationError("CSV file is empty. Please add some leads and try again.");
        setCsvLeads([]);
        return;
      }

      // Normalize headers BEFORE validation
      data = normalizeHeaders(data);

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
      width={1000}
      centered
      bodyStyle={{ maxHeight: "70vh", overflowY: "auto" }}
    >
      <div className="py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Requirements and Format Info */}
          <div className="space-y-4">
            {/* CSV Format Requirements */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Text className="text-sm font-semibold text-blue-800 mb-3 flex items-center">📋 Required CSV Format</Text>
              <div className="text-sm text-blue-700 space-y-2">
                <div>
                  <strong className="text-blue-800">Required Columns:</strong>
                  <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                    <li>
                      <span className="font-medium">email</span> - Must not be empty
                    </li>
                    <li>
                      <span className="font-medium">phone</span> - Must not be empty
                    </li>
                  </ul>
                </div>
                <div>
                  <strong className="text-blue-800">Optional Columns:</strong>
                  <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                    <li>first_name, last_name, notes</li>
                    <li>status: &quot;New&quot; (default)</li>
                    <li className="flex items-center flex-wrap">
                      interest_level (
                      <Popover content={renderValidValuesContent(VALID_INTEREST_LEVELS)} title="Valid Interest Levels" trigger="hover">
                        <span className="inline-flex items-center gap-1 text-blue-700 cursor-help hover:underline mx-1">
                          Valid Values <EyeOutlined className="text-blue-500" />
                        </span>
                      </Popover>
                      ) - Default: &quot;medium&quot;
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Header Normalization Information */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-sm font-semibold text-yellow-800 mb-3 block">🔄 Auto Header Normalization</Text>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>We automatically normalize common variations:</p>
                <div className="space-y-1">
                  <div>
                    <strong>Email:</strong> E-mail, EMAIL, mail → <code className="bg-yellow-100 px-1 rounded">email</code>
                  </div>
                  <div>
                    <strong>Phone:</strong> Phone, telephone, mobile → <code className="bg-yellow-100 px-1 rounded">phone</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Default Values and Example */}
          <div className="space-y-4">
            {/* Default Values Information */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <Text className="text-sm font-semibold text-green-800 mb-3 block">💡 Default Values</Text>
              <div className="text-sm text-green-700 space-y-2">
                <p>Empty or invalid optional columns use these defaults:</p>
                <ul className="ml-4 space-y-1 list-disc list-inside">
                  <li>
                    <strong>interest_level:</strong> &quot;medium&quot;
                  </li>
                  <li>
                    <strong>status:</strong> &quot;New&quot; (for all CSV leads)
                  </li>
                </ul>
              </div>
            </div>

            {/* Enhanced Example */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Text className="text-sm font-semibold text-gray-700 mb-3 block">📄 Example CSV Format</Text>
              <div className="text-xs text-gray-600 bg-white p-3 rounded border font-mono overflow-x-auto">
                first_name,last_name,E-mail,Phone,interest_level,notes
                <br />
                John,Doe,john.doe@email.com,+1234567890,high,Interested
                <br />
                Jane,Smith,jane.smith@email.com,+1234567891,medium,Follow up
                <br />
                Bob,Johnson,bob.johnson@email.com,+1234567892,,Contact soon
              </div>
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <div>📧 Email & 📱 Phone columns are required</div>
                <div>💡 Optional columns can be empty</div>
                <div>✨ Invalid values get replaced with defaults</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="text-center space-y-4">
            <div className="max-w-2xl mx-auto">
              <Text className="text-lg font-semibold text-gray-800 mb-4 block">📁 Select Your CSV File</Text>
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
                className="block w-full text-sm text-gray-500 border border-gray-300 rounded-lg
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-l-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-500 file:text-white
                  hover:file:bg-purple-600 file:cursor-pointer
                  cursor-pointer"
              />
            </div>

            {/* Success Message */}
            {csvLeads.length > 0 && !csvValidationError && (
              <div className="max-w-2xl mx-auto p-4 bg-green-50 rounded-lg border border-green-200">
                <Text className="text-green-700 text-sm font-medium">
                  <CheckCircleOutlined className="mr-2" />✅ File validated successfully! Found {csvLeads.length} leads ready to upload.
                </Text>
              </div>
            )}

            {/* Error Message */}
            {csvValidationError && (
              <div className="max-w-2xl mx-auto p-4 bg-red-50 rounded-lg border border-red-200">
                <Text className="text-red-700 text-sm">
                  <ExclamationCircleOutlined className="mr-2" />
                  <strong>Validation Error:</strong>
                  <div className="mt-2 text-left">
                    <pre className="whitespace-pre-wrap text-xs bg-red-100 p-2 rounded">{csvValidationError}</pre>
                  </div>
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CsvUploadModal;
