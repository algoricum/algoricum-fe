// _shared/nurturing.ts

import { processAllLeads, type FollowUpRule } from "./nurturing-service.ts";

const FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    name: "sms_5min_initial",
    timeFromCreated: 30 * 1000, // 5 minutes
    leadStatus: ["New"],
    communicationType: "sms",
    onlyOnce: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "sms_2day_followup",
    timeFromCreated: 2 * 24 * 60 * 60 * 1000, // 2 days
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "sms_5day_followup",
    timeFromCreated: 5 * 24 * 60 * 60 * 1000, // 5 days
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "sms_10day_followup",
    timeFromCreated: 10 * 24 * 60 * 60 * 1000, // 10 days
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "sms_20day_followup",
    timeFromCreated: 20 * 24 * 60 * 60 * 1000, // 20 days
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
  },

  // EMAIL FLOW (starts from day 21)
  {
    name: "email_21day_followup",
    timeFromCreated: 21 * 24 * 60 * 60 * 1000, // 21 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_24day_followup",
    timeFromCreated: 24 * 24 * 60 * 60 * 1000, // 24 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_27day_followup",
    timeFromCreated: 27 * 24 * 60 * 60 * 1000, // 27 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_30day_followup",
    timeFromCreated: 30 * 24 * 60 * 60 * 1000, // 30 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_33day_followup",
    timeFromCreated: 33 * 24 * 60 * 60 * 1000, // 33 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_36day_followup",
    timeFromCreated: 36 * 24 * 60 * 60 * 1000, // 36 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_39day_followup",
    timeFromCreated: 39 * 24 * 60 * 60 * 1000, // 39 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_42day_followup",
    timeFromCreated: 42 * 24 * 60 * 60 * 1000, // 42 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_45day_followup",
    timeFromCreated: 45 * 24 * 60 * 60 * 1000, // 45 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_50day_followup",
    timeFromCreated: 50 * 24 * 60 * 60 * 1000, // 50 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_55day_followup",
    timeFromCreated: 55 * 24 * 60 * 60 * 1000, // 55 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_60day_followup",
    timeFromCreated: 60 * 24 * 60 * 60 * 1000, // 60 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_70day_followup",
    timeFromCreated: 70 * 24 * 60 * 60 * 1000, // 70 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_80day_followup",
    timeFromCreated: 80 * 24 * 60 * 60 * 1000, // 80 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_90day_followup",
    timeFromCreated: 90 * 24 * 60 * 60 * 1000, // 90 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_100day_followup",
    timeFromCreated: 100 * 24 * 60 * 60 * 1000, // 100 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_110day_followup",
    timeFromCreated: 110 * 24 * 60 * 60 * 1000, // 110 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_115day_followup",
    timeFromCreated: 115 * 24 * 60 * 60 * 1000, // 115 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_118day_followup",
    timeFromCreated: 118 * 24 * 60 * 60 * 1000, // 118 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_120day_followup",
    timeFromCreated: 120 * 24 * 60 * 60 * 1000, // 120 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
];

async function processProductionLeads(supabase: any, communicationType?: "sms" | "email") {
  return processAllLeads(supabase, communicationType, FOLLOW_UP_RULES);
}

// Export all functions
export { FOLLOW_UP_RULES, processProductionLeads as processAllLeads };
