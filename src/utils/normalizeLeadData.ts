
// Function to normalize and validate lead data
function normalizeLeadData(lead: any) {
    // Valid values according to database constraints
    const VALID_INTEREST_LEVELS = ['high', 'medium', 'low'];
    const VALID_URGENCY_LEVELS = ['asap', 'this_month', 'curious'];
    const VALID_STATUSES = ['new', 'responded', 'needs-follow-up', 'in-nurture', 'cold', 'reactivated', 'booked', 'confirmed', 'no-show', 'converted', 'not-interested', 'archived'];

  // Normalize interest_level
  if (lead.interest_level) {
    const normalized = lead.interest_level.toLowerCase().trim();
    if (VALID_INTEREST_LEVELS.includes(normalized)) {
      lead.interest_level = normalized;
    } else {
      // Default to 'medium' if invalid
      lead.interest_level = 'medium';
    }
  } else {
    lead.interest_level = 'medium'; // Default value
  }

  // Normalize urgency
  if (lead.urgency) {
    const normalized = lead.urgency.toLowerCase().trim();
    if (VALID_URGENCY_LEVELS.includes(normalized)) {
      lead.urgency = normalized;
    } else {
      // Default to 'curious' if invalid
      lead.urgency = 'this_month';
    }
  } else {
    lead.urgency = 'this_month'; // Default value
  }

  // Normalize status
  if (lead.status) {
    const normalized = lead.status.toLowerCase().trim();
    if (VALID_STATUSES.includes(normalized)) {
      lead.status = normalized;
    } else {
      // Default to 'new' if invalid
      lead.status = 'new';
    }
  } else {
    lead.status = 'new'; // Default value
  }

         
}


export default function getNormalizedLead(leads: any, source_id: string, clinic_id: string) {
      
      const leadsToInsert = leads.map((lead: any) => {
        const normalizedLead = normalizeLeadData(lead);
        return {
          ...normalizedLead,
          source_id,
          clinic_id,
          // Ensure required fields have default values
          first_name: normalizedLead.first_name || null,
          last_name: normalizedLead.last_name || null,
          email: normalizedLead.email || null,
          phone: normalizedLead.phone || null,
          notes: normalizedLead.notes || null,
          };
       });

       return leadsToInsert;
}