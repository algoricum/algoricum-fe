import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys";
import { ErrorToast, WarningToast, SuccessToast } from "@/helpers/toast";
import { Lead } from "@/interfaces/services_type";
import downloadAndParseCSVWithPapa from "@/utils/downloadAndParseCSVWithPapa";
import getLeadSourceId from "@/utils/lead_source";
import getNormalizedLead from "@/utils/normalizeLeadData";
import { createClient } from "@/utils/supabase/config/client";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import { getUserData } from "@/utils/supabase/user-helper";
import Papa from "papaparse";

const supabase = createClient();

// Upload CSV leads to Supabase lead table
export const handleCsvLeadsUpload = async (clinic_id: string, flag: boolean = false) => {
  const leadsFileName = localStorage.getItem(ONBOARDING_LEADS_FILE_NAME);

  if (leadsFileName) {
    const result = await downloadAndParseCSVWithPapa("lead-uploads", leadsFileName);

    // Properly type and extract data
    const leads: Partial<Lead>[] =
      result && typeof result === "object" && "data" in result && Array.isArray((result as any).data)
        ? (result as { data: Partial<Lead>[] }).data
        : [];

    // Get source_id for 'File'
    try {
      const source_id = await getLeadSourceId("Csv_File ");

      if (!source_id) {
        ErrorToast("Lead source 'Csv_File' not found");
      }

      const leadsToInsert = getNormalizedLead(leads, source_id, clinic_id);
      const { error: insertError } = await supabase.from("lead").insert(leadsToInsert);

      if (insertError?.code === "23505") {
        throw new Error("Upload failed: This email address is already associated with a lead in this clinic.");
      }

      if (insertError) {
        throw new Error(`Upload failed: ${insertError.message}`);
      }

      if (flag) {
        SuccessToast("Leads uploaded successfully");
      }
    } catch (error) {
      // Catch and display any errors during the upload process
      ErrorToast(`${error}`);
    }
  } else {
    WarningToast("No CSV file found for upload");
  }
};
// Upload CSV file to Supabase storage and handle leads upload
export const handleCsvUpload = async (leadsData: any, flag: boolean) => {
  try {
    if (!leadsData) {
      WarningToast("No CSV file selected");
    }

    const user = await getUserData();
    if (!user) {
      ErrorToast("User not found. Please log in again.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `leads-${user.id}-${timestamp}.csv`;
    const filePath = `${user.id}/${fileName}`;

    let csvData;
    if (Array.isArray(leadsData)) {
      csvData = Papa.unparse(leadsData);
    } else {
      csvData = leadsData;
    }

    const { error } = await supabase.storage.from("lead-uploads").upload(filePath, csvData, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("Upload error:", error);
      throw new Error(`Failed to upload CSV: ${error.message}`);
    }

    localStorage.setItem(ONBOARDING_LEADS_FILE_NAME, filePath);

    if (flag) {
      const clinic_id = await getCurrentUserClinic();
      if (clinic_id) {
        await handleCsvLeadsUpload(clinic_id, true);
      } else {
        ErrorToast("Clinic not found. Please check your clinic settings.");
      }
    }
  } catch (error) {
    console.error("Error uploading CSV:", error);
  }
};

//Create Email Detection Regex
export const createEmailRegex = (): RegExp => {
  // Core email terms - start simple, then expand
  const coreTerms = [
    "e?mail", // matches "email" or "mail"
    "electronic[_\\s-]*mail", // "electronic mail", "electronic_mail"
    "e[_\\s-]*mail", // "e_mail", "e-mail", "e mail"
  ];

  // Optional prefixes (words that can come before)
  const prefixes = ["customer", "client", "user", "contact", "primary", "main", "personal", "business", "work"];

  // Optional suffixes (words that can come after)
  const suffixes = ["address", "id", "contact", "info"];

  // Build pattern step by step:
  // 1. Optional prefix with separators
  const prefixPattern = `(?:${prefixes.join("|")}[_\\s-]*)?`;

  // 2. Core email term (required)
  const corePattern = `(?:${coreTerms.join("|")})`;

  // 3. Optional suffix with separators
  const suffixPattern = `(?:[_\\s-]*(?:${suffixes.join("|")}))?`;

  // 4. Combine with anchors for exact match
  const fullPattern = `^${prefixPattern}${corePattern}${suffixPattern}$`;

  return new RegExp(fullPattern, "i"); // case insensitive
};

// Create Phone Detection Regex
export const createPhoneRegex = (): RegExp => {
  const coreTerms = [
    "phone",
    "tel(?:ephone)?", // "tel" or "telephone"
    "mobile",
    "cell(?:ular)?", // "cell" or "cellular"
    "contact",
    "number",
  ];

  const prefixes = ["primary", "main", "home", "work", "business", "customer", "client"];

  const suffixes = ["number", "no", "num", "contact", "info"];

  const prefixPattern = `(?:${prefixes.join("|")}[_\\s-]*)?`;
  const corePattern = `(?:${coreTerms.join("|")})`;
  const suffixPattern = `(?:[_\\s-]*(?:${suffixes.join("|")}))?`;

  const fullPattern = `^${prefixPattern}${corePattern}${suffixPattern}$`;

  return new RegExp(fullPattern, "i");
};

// Create Name Detection Regex Functions

export const createFirstNameRegex = (): RegExp => {
  const patterns = ["first[_\\s-]*name", "f[_\\s-]*name", "fname", "given[_\\s-]*name", "forename", "christian[_\\s-]*name"];

  return new RegExp(`^(?:${patterns.join("|")})$`, "i");
};

export const createLastNameRegex = (): RegExp => {
  const patterns = ["last[_\\s-]*name", "l[_\\s-]*name", "lname", "surname", "family[_\\s-]*name", "sir[_\\s-]*name"];

  return new RegExp(`^(?:${patterns.join("|")})$`, "i");
};

export const createFullNameRegex = (): RegExp => {
  const patterns = [
    "full[_\\s-]*name",
    "complete[_\\s-]*name",
    "^name$", // exact match for just "name"
    "customer[_\\s-]*name",
    "client[_\\s-]*name",
    "contact[_\\s-]*name",
  ];

  return new RegExp(`^(?:${patterns.join("|")})$`, "i");
};

// Header Cleaning Function
export const cleanHeader = (header: string): string => {
  return header
    .trim() // remove leading/trailing spaces
    .replace(/\s+/g, " ") // normalize multiple spaces to single space
    .replace(/['"]/g, "") // remove quotes
    .replace(/^\s+|\s+$/g, ""); // trim again after quote removal
};

// Full Name Splitting Function
export const splitFullName = (fullName: string): { first_name: string; last_name: string } => {
  if (!fullName || typeof fullName !== "string") {
    return { first_name: "", last_name: "" };
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return { first_name: "", last_name: "" };
  }

  // Split by whitespace and filter out empty parts
  const parts = trimmed.split(/\s+/).filter(part => part.length > 0);

  if (parts.length === 0) {
    return { first_name: "", last_name: "" };
  } else if (parts.length === 1) {
    // Only one name part - put it as first name
    return { first_name: parts[0], last_name: "" };
  } else if (parts.length === 2) {
    // Two parts - first and last
    return { first_name: parts[0], last_name: parts[1] };
  } else {
    // Multiple parts - first part as first name, rest as last name
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(" "),
    };
  }
};

// Main Header Detection Function

export const detectHeaderType = (header: string): string | null => {
  const cleanedHeader = cleanHeader(header);

  // Test against each regex pattern
  if (createEmailRegex().test(cleanedHeader)) {
    return "email";
  }

  if (createPhoneRegex().test(cleanedHeader)) {
    return "phone";
  }

  if (createFirstNameRegex().test(cleanedHeader)) {
    return "first_name";
  }

  if (createLastNameRegex().test(cleanedHeader)) {
    return "last_name";
  }

  if (createFullNameRegex().test(cleanedHeader)) {
    return "full_name";
  }

  // Additional common fields
  if (/^(?:notes?|comments?|remarks?|description)$/i.test(cleanedHeader)) {
    return "notes";
  }

  if (/^(?:status|state|condition)$/i.test(cleanedHeader)) {
    return "status";
  }

  if (/^(?:interest[_\s-]*level|priority|score|rating)$/i.test(cleanedHeader)) {
    return "interest_level";
  }

  if (/^(?:urgency|urgent|priority[_\s-]*level)$/i.test(cleanedHeader)) {
    return "urgency";
  }

  return null; // Unknown header type
};

// Process Full Name Data
export const processFullNameData = (
  data: any[],
  mappingReport: string[],
): {
  processedData: any[];
  updatedMappingReport: string[];
} => {
  const updatedMappingReport = [...mappingReport];

  // Check if we have a full_name field but no first_name or last_name
  const hasFullName = data.length > 0 && "full_name" in data[0];
  const hasFirstName = data.length > 0 && "first_name" in data[0];
  const hasLastName = data.length > 0 && "last_name" in data[0];

  if (hasFullName && (!hasFirstName || !hasLastName)) {
    updatedMappingReport.push(`🔄 Processing "full_name" field - splitting into "first_name" and "last_name"`);

    const processedData = data.map(row => {
      const newRow = { ...row };

      if (row.full_name) {
        const { first_name, last_name } = splitFullName(row.full_name);

        // Only set first_name if we don't already have it
        if (!hasFirstName) {
          newRow.first_name = first_name;
        }

        // Only set last_name if we don't already have it
        if (!hasLastName) {
          newRow.last_name = last_name;
        }
      }

      // Remove the full_name field as it's not needed in the database
      delete newRow.full_name;

      return newRow;
    });

    return { processedData, updatedMappingReport };
  }

  return { processedData: data, updatedMappingReport };
};

// Enhanced Normalization Function
export const normalizeHeaders = (
  data: any[],
): {
  normalizedData: any[];
  mappingReport: string[];
} => {
  if (!data || data.length === 0) {
    return { normalizedData: data, mappingReport: [] };
  }

  const mappingReport: string[] = [];
  const headerMappings: { [key: string]: string } = {};

  // Get all original headers
  const originalHeaders = Object.keys(data[0] || {});

  // Process each header
  originalHeaders.forEach(originalHeader => {
    const detectedType = detectHeaderType(originalHeader);

    if (detectedType) {
      // We found a match with our regex patterns
      headerMappings[originalHeader] = detectedType;
      mappingReport.push(`📋 "${originalHeader}" → "${detectedType}"`);
    } else {
      // Unknown header - normalize it manually
      const normalizedKey = originalHeader
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_") // replace spaces and dashes with underscores
        .replace(/[^a-z0-9_]/g, ""); // remove special characters

      headerMappings[originalHeader] = normalizedKey;

      // Only report if there was a change
      if (normalizedKey !== originalHeader.toLowerCase()) {
        mappingReport.push(`🔧 "${originalHeader}" → "${normalizedKey}" (normalized)`);
      }
    }
  });

  // Apply the mappings to all data rows
  const normalizedData = data.map(row => {
    const normalizedRow: any = {};

    Object.entries(row).forEach(([originalKey, value]) => {
      const mappedKey = headerMappings[originalKey] || originalKey;
      normalizedRow[mappedKey] = value;
    });

    return normalizedRow;
  });

  // STEP 9: Process full name splitting if needed
  const { processedData, updatedMappingReport } = processFullNameData(normalizedData, mappingReport);

  return { normalizedData: processedData, mappingReport: updatedMappingReport };
};

// Validate Database Compatibility

export const validateDatabaseFields = (
  data: any[],
): {
  isValid: boolean;
  missingRequired: string[];
  supportedFields: string[];
  unsupportedFields: string[];
} => {
  if (!data || data.length === 0) {
    return {
      isValid: false,
      missingRequired: ["email", "phone"],
      supportedFields: [],
      unsupportedFields: [],
    };
  }

  const headers = Object.keys(data[0] || {});

  // Define database schema fields
  const requiredFields = ["email", "phone"];
  const supportedOptionalFields = ["first_name", "last_name", "status", "notes", "interest_level", "urgency"];

  const allSupportedFields = [...requiredFields, ...supportedOptionalFields];

  // Check for missing required fields
  const missingRequired = requiredFields.filter(field => !headers.includes(field));

  // Categorize fields
  const supportedFields = headers.filter(field => allSupportedFields.includes(field));
  const unsupportedFields = headers.filter(field => !allSupportedFields.includes(field));

  const isValid = missingRequired.length === 0;

  return {
    isValid,
    missingRequired,
    supportedFields,
    unsupportedFields,
  };
};

// Export all functions for easy importing

export default {
  detectHeaderType,
  normalizeHeaders,
  cleanHeader,
  createEmailRegex,
  createPhoneRegex,
  createFirstNameRegex,
  createLastNameRegex,
  createFullNameRegex,
  splitFullName,
  processFullNameData,
  validateDatabaseFields,
};
