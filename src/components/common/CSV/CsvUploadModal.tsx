// CsvUploadModal.tsx - Enhanced with full name splitting
"use client";
import { CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Modal, Typography } from "antd";
import Papa from "papaparse";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { detectHeaderType, normalizeHeaders, validateDatabaseFields } from "@/utils/csvUtils";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear state when modal opens/closes
  useEffect(() => {
    setCsvLeads([]);
    setCsvValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open]);

  // CSV parsing function
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

  // Enhanced header validation with database field awareness
  const validateHeaders = (data: any[]): { errors: string[]; suggestions: string[] } => {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Use the database validation function
    const dbValidation = validateDatabaseFields(data);

    if (!dbValidation.isValid) {
      const missingNameFields = dbValidation.missingRequired.filter(field => field === "first_name" || field === "last_name");
      const hasFullName = data.length > 0 && "full_name" in data[0];

      // If we have full_name but missing first/last name, don't show error (we'll process it)
      if (hasFullName && missingNameFields.length > 0) {
        const otherMissing = dbValidation.missingRequired.filter(field => field !== "first_name" && field !== "last_name");
        if (otherMissing.length > 0) {
          errors.push(`Missing required columns: ${otherMissing.join(", ")}`);
        }
      } else {
        errors.push(`Missing required columns: ${dbValidation.missingRequired.join(", ")}`);

        // Provide suggestions for missing headers
        dbValidation.missingRequired.forEach(missing => {
          const originalHeaders = Object.keys(data[0] || {});
          const possibleMatches = originalHeaders.filter(originalHeader => {
            return detectHeaderType(originalHeader) === missing;
          });

          if (possibleMatches.length > 0) {
            suggestions.push(`For "${missing}", found these headers: ${possibleMatches.join(", ")}`);
          }
        });
      }
    }

    return { errors, suggestions };
  };

  // Main CSV processing function
  const handleCsvLeads = async (file: File) => {
    setCsvValidationError(null);

    if (!file) {
      setCsvLeads([]);
      return;
    }

    try {
      // Parse the CSV file
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

      // Use utility function for header normalization (includes full name processing)
      const { normalizedData } = normalizeHeaders(data);
      data = normalizedData;

      // Enhanced validation with database compatibility check
      const headerValidation = validateHeaders(data);

      // Re-validate after normalization to see if full name processing fixed issues
      const finalDbValidation = validateDatabaseFields(data);

      if (!finalDbValidation.isValid) {
        let errorMessage = headerValidation.errors.join("\n");

        if (headerValidation.suggestions.length > 0) {
          errorMessage += "\n\nSuggestions:\n" + headerValidation.suggestions.join("\n");
        }

        setCsvValidationError(errorMessage);
        setCsvLeads([]);
        return;
      }

      // Validate required field data quality
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

        // Validate interest_level values if present
        if (row.interest_level && !["high", "medium", "low"].includes(row.interest_level.toLowerCase())) {
          requiredFieldErrors.push(`Row ${rowNum}: Interest level must be 'high', 'medium', or 'low' (found: ${row.interest_level})`);
        }

        // Validate urgency values if present
        if (row.urgency && !["asap", "this_month", "curious"].includes(row.urgency.toLowerCase())) {
          requiredFieldErrors.push(`Row ${rowNum}: Urgency must be 'asap', 'this_month', or 'curious' (found: ${row.urgency})`);
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

  // Custom cancel handler
  const handleCancelAndClearState = () => {
    setCsvLeads([]);
    setCsvValidationError(null);
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
      width={700}
      centered
      bodyStyle={{ maxHeight: "80vh", overflowY: "auto" }}
    >
      <div className="py-4">
        <div className="text-center space-y-4">
          <div className="max-w-lg mx-auto mb-6">
            <Text className="text-gray-600 text-sm leading-relaxed">
              Please upload a CSV file with required columns: <strong>email</strong> and <strong>phone</strong>. Optional columns include
              first_name, last_name, notes, status and interest_level. We automatically detect common header variations and can split full
              names into separate fields.
            </Text>
          </div>

          <div className="max-w-md mx-auto">
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
            <div className="max-w-md mx-auto p-4 bg-green-50 rounded-lg border border-green-200">
              <Text className="text-green-700 text-sm font-medium">
                <CheckCircleOutlined className="mr-2" />✅ File validated successfully! Found {csvLeads.length} leads ready to upload.
              </Text>
            </div>
          )}

          {/* Error Message */}
          {csvValidationError && (
            <div className="max-w-md mx-auto p-4 bg-red-50 rounded-lg border border-red-200">
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
    </Modal>
  );
};

export default CsvUploadModal;
