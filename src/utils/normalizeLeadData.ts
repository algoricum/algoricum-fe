import { Lead } from "@/interfaces/services_type";

// Function to normalize and validate lead data
function normalizeLeadData(lead: Partial<Lead>): Lead {
    // Valid values according to database constraints
  const VALID_INTEREST_LEVELS = ['high', 'medium', 'low'];
  const VALID_URGENCY_LEVELS = ['asap', 'this_month', 'curious'];
  const VALID_STATUSES = ['new', 'responded', 'needs-follow-up', 'in-nurture', 'cold', 'reactivated', 'booked', 'confirmed', 'no-show', 'converted', 'not-interested', 'archived'];

    // Normalize interest_level
    let interest_level: string | null = lead.interest_level ?? null;
    if (interest_level) {
      const normalized = interest_level.toLowerCase().trim();
      interest_level = VALID_INTEREST_LEVELS.includes(normalized) ? normalized : 'medium';
    } else {
      interest_level = 'medium'; // Default value
    }

    // Normalize urgency
    let urgency: string | null = lead.urgency ?? null;
    if (urgency) {
      const normalized = urgency.toLowerCase().trim();
      urgency = VALID_URGENCY_LEVELS.includes(normalized) ? normalized : 'this_month';
    } else {
      urgency = 'this_month'; // Default value
    }

    // Normalize status
    let status: string = lead.status ?? '';
    if (status) {
      const normalized = status.toLowerCase().trim();
      status = VALID_STATUSES.includes(normalized) ? normalized : 'new';
    } else {
      status = 'new'; // Default value
    }

    return {
      id: lead.id,
      first_name: lead.first_name ?? null,
      last_name: lead.last_name ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      status,
      source_id: lead.source_id!, // will be set in getNormalizedLead
      clinic_id: lead.clinic_id!, // will be set in getNormalizedLead
      assigned_to: lead.assigned_to ?? null,
      notes: lead.notes ?? null,
      created_at: lead.created_at,
      updated_at: lead.updated_at,
      interest_level,
      urgency,
      form_data: lead.form_data ?? null,
    };
}

export default function getNormalizedLead(leads: Partial<Lead>[], source_id: string, clinic_id: string): Lead[] {
  return leads.map((lead) => {
    // Always set source_id and clinic_id
    const normalizedLead = normalizeLeadData({ ...lead, source_id, clinic_id });
    return normalizedLead;
  });
}