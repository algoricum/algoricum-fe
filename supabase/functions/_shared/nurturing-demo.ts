// _shared/nurturing-demo.ts

import { processAllLeads, type FollowUpRule } from "./nurturing-service.ts";

const FOLLOW_UP_RULES: FollowUpRule[] = [
  // SMS FLOW - 3-minute gaps between each rule
  {
    name: "sms_5min_initial",
    timeFromCreated: 30 * 1000,
    leadStatus: ["New"],
    communicationType: "sms",
    onlyOnce: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_2day_followup",
    timeFromCreated: 5 * 60 * 1000,
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_5day_followup",
    timeFromCreated: 10 * 60 * 1000,
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_10day_followup",
    timeFromCreated: 15 * 60 * 1000,
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_20day_followup",
    timeFromCreated: 20 * 60 * 1000,
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },

  // EMAIL FLOW - 3-minute gaps between each rule (starting after SMS flow)
  {
    name: "email_21day_followup",
    timeFromCreated: 25 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_24day_followup",
    timeFromCreated: 30 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_27day_followup",
    timeFromCreated: 35 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_30day_followup",
    timeFromCreated: 40 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_33day_followup",
    timeFromCreated: 45 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_36day_followup",
    timeFromCreated: 50 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_39day_followup",
    timeFromCreated: 55 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_42day_followup",
    timeFromCreated: 60 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_45day_followup",
    timeFromCreated: 65 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_50day_followup",
    timeFromCreated: 70 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_55day_followup",
    timeFromCreated: 75 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_60day_followup",
    timeFromCreated: 80 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_70day_followup",
    timeFromCreated: 85 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_80day_followup",
    timeFromCreated: 90 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_90day_followup",
    timeFromCreated: 95 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_100day_followup",
    timeFromCreated: 100 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_110day_followup",
    timeFromCreated: 105 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_115day_followup",
    timeFromCreated: 110 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_118day_followup",
    timeFromCreated: 115 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_120day_followup",
    timeFromCreated: 120 * 60 * 1000,
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
];

async function processScheduledFollowUps(supabase: any, communicationType?: "sms" | "email", clinicIds?: string[]) {
  return processAllLeads(supabase, communicationType, FOLLOW_UP_RULES, clinicIds);
}

export { FOLLOW_UP_RULES, processScheduledFollowUps };
