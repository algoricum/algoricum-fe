import type { FollowUpRule } from "./nurturing-types.ts";

// PAID PLAN - Full flow: 5 SMS + 15 emails = 20 total
const FOLLOW_UP_RULES_PAID: FollowUpRule[] = [
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

// DEMO RULES - PAID PLAN: SMS + Emails for testing
const FOLLOW_UP_RULES_DEMO_PAID: FollowUpRule[] = [
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

// FREE PLAN - Email only: 14 emails following sequence: 5min → 2d → 5d → 8d → 11d → 14d → 17d → 20d → 30d → 35d → 50d → 60d → 70d → 90d
const FOLLOW_UP_RULES_FREE: FollowUpRule[] = [
  {
    name: "email_5min_followup",
    timeFromCreated: 5 * 60 * 1000, // 5 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_2day_followup",
    timeFromCreated: 2 * 24 * 60 * 60 * 1000, // 2 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_5day_followup",
    timeFromCreated: 5 * 24 * 60 * 60 * 1000, // 5 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_8day_followup",
    timeFromCreated: 8 * 24 * 60 * 60 * 1000, // 8 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_11day_followup",
    timeFromCreated: 11 * 24 * 60 * 60 * 1000, // 11 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_14day_followup",
    timeFromCreated: 14 * 24 * 60 * 60 * 1000, // 14 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_17day_followup",
    timeFromCreated: 17 * 24 * 60 * 60 * 1000, // 17 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_20day_followup",
    timeFromCreated: 20 * 24 * 60 * 60 * 1000, // 20 days
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
    name: "email_35day_followup",
    timeFromCreated: 35 * 24 * 60 * 60 * 1000, // 35 days
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
    name: "email_90day_followup",
    timeFromCreated: 90 * 24 * 60 * 60 * 1000, // 90 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
  {
    name: "email_120day_followup",
    timeFromCreated: 120 * 24 * 60 * 60 * 1000, // 90 days
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
  },
];

// DEMO RULES - FREE PLAN: 14 emails matching free plan sequence with 3-minute intervals for testing
const FOLLOW_UP_RULES_DEMO_FREE: FollowUpRule[] = [
  {
    name: "email_5min_followup",
    timeFromCreated: 30 * 1000, // 30 seconds
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_2day_followup",
    timeFromCreated: 5 * 60 * 1000, // 3 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_5day_followup",
    timeFromCreated: 10 * 60 * 1000, // 6 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_8day_followup",
    timeFromCreated: 15 * 60 * 1000, // 9 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_11day_followup",
    timeFromCreated: 20 * 60 * 1000, // 12 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_14day_followup",
    timeFromCreated: 25 * 60 * 1000, // 15 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_17day_followup",
    timeFromCreated: 30 * 60 * 1000, // 18 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_20day_followup",
    timeFromCreated: 35 * 60 * 1000, // 21 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_30day_followup",
    timeFromCreated: 40 * 60 * 1000, // 24 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_35day_followup",
    timeFromCreated: 45 * 60 * 1000, // 27 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_50day_followup",
    timeFromCreated: 50 * 60 * 1000, // 30 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_60day_followup",
    timeFromCreated: 60 * 60 * 1000, // 33 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_70day_followup",
    timeFromCreated: 70 * 60 * 1000, // 36 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_90day_followup",
    timeFromCreated: 90 * 60 * 1000, // 39 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
  {
    name: "email_120day_followup",
    timeFromCreated: 95 * 60 * 1000, // 39 minutes
    communicationType: "email",
    onlyOnce: true,
    checkLastActivity: true,
    toleranceWindow: 1 * 60 * 1000,
  },
];

export type PlanType = "free" | "paid" | "demo_free" | "demo_paid";

// Function to determine plan type based on clinic configuration
export async function getClinicPlanType(clinicId: string, supabase?: any): Promise<PlanType> {
  try {
    // If no supabase client provided, default to free plan
    if (!supabase) {
      console.warn(`No Supabase client provided for clinic ${clinicId}, defaulting to free plan`);
      return "free";
    }

    // Check if clinic has an active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from("stripe_subscriptions")
      .select(
        `
        status,
        current_period_end,
        trial_end,
        stripe_price_id,
        plans!inner(
          name,
          features
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .single();

    if (subscriptionError) {
      console.log(`No subscription found for clinic ${clinicId}, defaulting to free plan`);
      return "free";
    }

    if (!subscription) {
      console.log(`No subscription data for clinic ${clinicId}, defaulting to free plan`);
      return "free";
    }

    // Check if subscription is active
    const now = new Date();
    const isActive =
      subscription.status === "active" ||
      subscription.status === "trialing" ||
      (subscription.trial_end && new Date(subscription.trial_end) > now) ||
      (subscription.current_period_end && new Date(subscription.current_period_end) > now);

    if (!isActive) {
      console.log(`Subscription inactive for clinic ${clinicId}, defaulting to free plan`);
      return "free";
    }

    // If subscription is active, return paid plan
    console.log(`Active subscription found for clinic ${clinicId}, using paid plan`);
    return "paid";
  } catch (error: any) {
    console.error(`Error checking plan type for clinic ${clinicId}:`, error);
    // Default to free plan on error
    return "free";
  }
}

// Get rules dynamically based on plan type
export async function getFollowUpRulesForClinic(clinicId: string, supabase?: any): Promise<FollowUpRule[]> {
  const planType = await getClinicPlanType(clinicId, supabase);
  return getFollowUpRules(planType);
}

// Function to determine demo plan type based on clinic configuration
export async function getDemoClinicPlanType(clinicId: string, supabase?: any): Promise<PlanType> {
  try {
    // Check subscription status to determine if demo_free or demo_paid
    const planType = await getClinicPlanType(clinicId, supabase);

    // Convert regular plan types to demo equivalents
    return planType === "paid" ? "demo_paid" : "demo_free";
  } catch (error: any) {
    console.error(`Error checking demo plan type for clinic ${clinicId}:`, error);
    // Default to demo_free on error
    return "demo_free";
  }
}

// Get demo rules dynamically based on plan type
export async function getDemoFollowUpRulesForClinic(clinicId: string, supabase?: any): Promise<FollowUpRule[]> {
  const planType = await getDemoClinicPlanType(clinicId, supabase);
  return getFollowUpRules(planType);
}

export const getFollowUpRules = (planType: PlanType): FollowUpRule[] => {
  switch (planType) {
    case "free":
      return FOLLOW_UP_RULES_FREE;
    case "paid":
      return FOLLOW_UP_RULES_PAID;
    case "demo_free":
      return FOLLOW_UP_RULES_DEMO_FREE;
    case "demo_paid":
      return FOLLOW_UP_RULES_DEMO_PAID;
    default:
      return FOLLOW_UP_RULES_FREE;
  }
};

export const getFollowUpRulesCounts = (planType: PlanType) => {
  const rules = getFollowUpRules(planType);
  const smsCount = rules.filter(rule => rule.communicationType === "sms").length;
  const emailCount = rules.filter(rule => rule.communicationType === "email").length;

  return {
    sms: smsCount,
    email: emailCount,
    total: smsCount + emailCount,
  };
};

// Export individual rule sets for backward compatibility
export { FOLLOW_UP_RULES_DEMO_FREE, FOLLOW_UP_RULES_DEMO_PAID, FOLLOW_UP_RULES_FREE, FOLLOW_UP_RULES_PAID };
