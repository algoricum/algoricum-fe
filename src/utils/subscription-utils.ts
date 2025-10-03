import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

export interface ClinicSubscriptionInfo {
  isDemo: boolean;
  isPaid: boolean;
  roleType: string;
  planType: string;
}

// Check if clinic has paid subscription (prevent free users from Twilio setup)
export const checkClinicSubscription = async (clinicId: string): Promise<ClinicSubscriptionInfo> => {
  try {
    // Get user roles for this clinic
    const { data: userClinics, error: userClinicError } = await supabase
      .from("user_clinic")
      .select(
        `
        user_id,
        role_id,
        is_active,
        role!inner(
          type
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    if (userClinicError) {
      console.error("Error fetching clinic roles", userClinicError);
      return { isDemo: false, isPaid: false, roleType: "unknown", planType: "unknown" };
    }

    // Get subscription status
    const { data: subscription, error: subscriptionError } = await supabase
      .from("stripe_subscriptions")
      .select("stripe_price_id, status")
      .eq("clinic_id", clinicId)
      .single();

    if (subscriptionError && subscriptionError.code !== "PGRST116") {
      console.error("Error fetching subscription", subscriptionError);
    }

    // Determine demo status
    const roleTypes = userClinics?.map((uc: any) => uc.role?.type).filter(Boolean) || [];
    const isDemo = roleTypes.includes("demo_user");
    const roleType = roleTypes.join(", ") || "unknown";

    // Determine paid status based on plan name
    let isPaid = false;
    let planType = "free";

    if (subscription && subscription.stripe_price_id) {
      // Fetch plan name using the stripe_price_id
      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("name")
        .eq("price_id", subscription.stripe_price_id)
        .single();

      if (planError) {
        console.error("Error fetching plan details", planError);
        // Default to free if we can't determine the plan
        isPaid = false;
        planType = "unknown";
      } else if (plan) {
        const planName = plan.name;
        isPaid = planName !== "Free Plan";
        planType = planName;
      }
    }

    console.log(`Clinic ${clinicId} subscription: ${isDemo ? "demo" : "non-demo"} + ${isPaid ? "paid" : "free"} (plan: ${planType})`);

    return {
      isDemo,
      isPaid,
      roleType,
      planType,
    };
  } catch (error: any) {
    console.error("Error in checkClinicSubscription", error);
    return { isDemo: false, isPaid: false, roleType: "unknown", planType: "unknown" };
  }
};

export const shouldAllowTwilioSetup = (subscriptionInfo: ClinicSubscriptionInfo): boolean => {
  return subscriptionInfo.isPaid;
};
