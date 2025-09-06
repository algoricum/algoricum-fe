// _shared/nurturing-demo.ts

import { processAllLeads, type FollowUpRule } from './nurturing-service.ts'

// Demo follow-up rules - ONLY ADDED tolerance windows, everything else stays the same
const FOLLOW_UP_RULES: FollowUpRule[] = [
  // SMS FLOW - All set to 3 minutes
  {
    name: 'sms_5min_initial',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 5 minutes)
    leadStatus: ['New'],
    communicationType: 'sms',
    onlyOnce: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_2day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 2 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_5day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 5 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_10day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 10 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'sms_20day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 20 days)
    communicationType: 'sms',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  
  // EMAIL FLOW - All set to 3 minutes (changed from day-based schedule)
  {
    name: 'email_21day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 21 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_24day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 24 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_27day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 27 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_30day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 30 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_33day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 33 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_36day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 36 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_39day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 39 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_42day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 42 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_45day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 45 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_50day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 50 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_55day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 55 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_60day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 60 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_70day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 70 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_80day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 80 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_90day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 90 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_100day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 100 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_110day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 110 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_115day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 115 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_118day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 118 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  },
  {
    name: 'email_120day_followup',
    timeFromCreated: 3 * 60 * 1000, // 3 minutes (changed from 120 days)
    communicationType: 'email',
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000 // 1 minute tolerance window
  }
]

// Demo follow-up function that uses 3-minute timing for testing
async function processScheduledFollowUps(supabase: any, communicationType?: 'sms' | 'email') {
  return processAllLeads(supabase, communicationType, FOLLOW_UP_RULES)
}

export { 
  processScheduledFollowUps,
  FOLLOW_UP_RULES 
}