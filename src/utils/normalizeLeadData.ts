import { Lead } from "@/interfaces/services_type";

// Function to normalize and validate lead data
function normalizeLeadData(lead: Partial<Lead>, rowIndex?: number): Lead {
  // Valid values according to database constraints
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

  const rowInfo = rowIndex !== undefined ? ` at row ${rowIndex + 1}` : "";

  // Validate required fields
  const email = lead.email?.trim();
  const phone = lead.phone?.trim();

  if (!email || email === "") {
    throw new Error(`Email is required for lead${rowInfo}`);
  }

  if (!phone || phone === "") {
    throw new Error(`Phone is required for lead${rowInfo}`);
  }

  // Optional: Add basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format for lead${rowInfo}: ${email}`);
  }

  // Validate and normalize interest_level (optional column)
  let interest_level: string | null = null;
  if (Object.prototype.hasOwnProperty.call(lead, "interest_level")) {
    const rawInterestLevel = lead.interest_level?.toString().trim();
    if (rawInterestLevel && rawInterestLevel !== "") {
      const normalized = rawInterestLevel.toLowerCase();
      if (!VALID_INTEREST_LEVELS.includes(normalized)) {
        throw new Error(
          `Invalid interest_level for lead${rowInfo}: "${rawInterestLevel}". Valid values are: ${VALID_INTEREST_LEVELS.join(", ")}`,
        );
      }
      interest_level = normalized;
    } else {
      interest_level = "medium"; // Default when column exists but is empty
    }
  } else {
    interest_level = "medium"; // Default when column doesn't exist
  }

  // Validate and normalize urgency (optional column)
  let urgency: string | null = null;
  if (Object.prototype.hasOwnProperty.call(lead, "urgency")) {
    const rawUrgency = lead.urgency?.toString().trim();
    if (rawUrgency && rawUrgency !== "") {
      const normalized = rawUrgency.toLowerCase();
      if (!VALID_URGENCY_LEVELS.includes(normalized)) {
        throw new Error(`Invalid urgency for lead${rowInfo}: "${rawUrgency}". Valid values are: ${VALID_URGENCY_LEVELS.join(", ")}`);
      }
      urgency = normalized;
    } else {
      urgency = "this_month"; // Default when column exists but is empty
    }
  } else {
    urgency = "this_month"; // Default when column doesn't exist
  }

  // Validate and normalize status (optional column)
  let status: string = "new"; // Default value
  if (Object.prototype.hasOwnProperty.call(lead, "status")) {
    const rawStatus = lead.status?.toString().trim();
    if (rawStatus && rawStatus !== "") {
      const normalized = rawStatus.toLowerCase();
      if (!VALID_STATUSES.includes(normalized)) {
        throw new Error(`Invalid status for lead${rowInfo}: "${rawStatus}". Valid values are: ${VALID_STATUSES.join(", ")}`);
      }
      status = normalized;
    }
    // If status column exists but is empty, keep default "new"
  }
  // If status column doesn't exist, keep default "new"

  // Handle other optional columns
  let first_name: string | null = null;
  if (Object.prototype.hasOwnProperty.call(lead, "first_name")) {
    first_name = lead.first_name?.toString().trim() || null;
  }

  let last_name: string | null = null;
  if (Object.prototype.hasOwnProperty.call(lead, "last_name")) {
    last_name = lead.last_name?.toString().trim() || null;
  }

  let notes: string | null = null;
  if (Object.prototype.hasOwnProperty.call(lead, "notes")) {
    notes = lead.notes?.toString().trim() || null;
  }

  return {
    first_name,
    last_name,
    email,
    phone,
    status,
    source_id: lead.source_id!, // will be set in getNormalizedLead
    clinic_id: lead.clinic_id!, // will be set in getNormalizedLead
    notes,
    interest_level,
    urgency,
  };
}

export default function getNormalizedLead(leads: Partial<Lead>[], source_id: string, clinic_id: string): Lead[] {
  return leads.map((lead, index) => {
    // Always set source_id and clinic_id
    const normalizedLead = normalizeLeadData({ ...lead, source_id, clinic_id }, index);
    return normalizedLead;
  });
}


export function validateCSVHeaders(headers: string[]): { isValid: boolean; errors: string[] } {
  const requiredHeaders = ["email", "phone"];
  const optionalHeaders = ["first_name", "last_name", "notes", "status", "interest_level", "urgency"];
  const allValidHeaders = [...requiredHeaders, ...optionalHeaders];

  const errors: string[] = [];

  // Check for required headers
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      errors.push(`Missing required column: ${required}`);
    }
  }

  // Check for invalid headers
  for (const header of headers) {
    if (!allValidHeaders.includes(header)) {
      errors.push(`Unknown column: ${header}. Valid columns are: ${allValidHeaders.join(", ")}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
