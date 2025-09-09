// _shared/nurturing-demo.ts

import { processAllLeads, type FollowUpRule } from "./nurturing-service.ts";

const FOLLOW_UP_RULES: FollowUpRule[] = [
  // SMS FLOW - 3-minute gaps between each rule
  {
    name: "sms_5min_initial",
    timeFromCreated: 3 * 60 * 1000, // 3 minutes
    leadStatus: ["New"],
    communicationType: "sms",
    onlyOnce: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_2day_followup",
    timeFromCreated: 6 * 60 * 1000, // 6 minutes
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_5day_followup",
    timeFromCreated: 9 * 60 * 1000, // 9 minutes
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_10day_followup",
    timeFromCreated: 12 * 60 * 1000, // 12 minutes
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "sms_20day_followup",
    timeFromCreated: 15 * 60 * 1000, // 15 minutes
    communicationType: "sms",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },

  // EMAIL FLOW - 3-minute gaps between each rule (starting after SMS flow)
  {
    name: "email_21day_followup",
    timeFromCreated: 18 * 60 * 1000, // 18 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_24day_followup",
    timeFromCreated: 21 * 60 * 1000, // 21 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_27day_followup",
    timeFromCreated: 24 * 60 * 1000, // 24 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_30day_followup",
    timeFromCreated: 27 * 60 * 1000, // 27 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_33day_followup",
    timeFromCreated: 30 * 60 * 1000, // 30 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_36day_followup",
    timeFromCreated: 33 * 60 * 1000, // 33 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_39day_followup",
    timeFromCreated: 36 * 60 * 1000, // 36 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_42day_followup",
    timeFromCreated: 39 * 60 * 1000, // 39 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_45day_followup",
    timeFromCreated: 42 * 60 * 1000, // 42 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_50day_followup",
    timeFromCreated: 45 * 60 * 1000, // 45 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_55day_followup",
    timeFromCreated: 48 * 60 * 1000, // 48 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_60day_followup",
    timeFromCreated: 51 * 60 * 1000, // 51 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_70day_followup",
    timeFromCreated: 54 * 60 * 1000, // 54 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_80day_followup",
    timeFromCreated: 57 * 60 * 1000, // 57 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_90day_followup",
    timeFromCreated: 60 * 60 * 1000, // 60 minutes (1 hour)
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_100day_followup",
    timeFromCreated: 63 * 60 * 1000, // 63 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_110day_followup",
    timeFromCreated: 66 * 60 * 1000, // 66 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_115day_followup",
    timeFromCreated: 69 * 60 * 1000, // 69 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_118day_followup",
    timeFromCreated: 72 * 60 * 1000, // 72 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
  {
    name: "email_120day_followup",
    timeFromCreated: 75 * 60 * 1000, // 75 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000, // 1 minute tolerance window
  },
];

async function processScheduledFollowUps(supabase: any, communicationType?: "sms" | "email") {
  return processAllLeads(supabase, communicationType, FOLLOW_UP_RULES);
}

export { FOLLOW_UP_RULES, processScheduledFollowUps };
