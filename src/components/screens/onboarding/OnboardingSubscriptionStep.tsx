"use client";

import { useEffect, useState } from "react";
import { Button, Card, Typography, Skeleton, Tabs } from "antd";
// import { CheckCircle } from 'lucide-react';
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { createClient } from "@/utils/supabase/config/client";
import { ErrorToast } from "@/helpers/toast";
const supabase = createClient();

interface OnboardingSubscriptionStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data?: any) => void;
}

export default function OnboardingSubscriptionStep({ onNext }: OnboardingSubscriptionStepProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [, setStatus] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      const clinic = await getClinicData();
      console.log(".......Clinic data:.....", clinic);
      if (!clinic) {
        ErrorToast("Clinic data not found.");
        return;
      }

      setClinicId(clinic.id);

      const { data: planData } = await supabase.from("plans").select("*").eq("active", true).order("amount", { ascending: true });

      setPlans(planData || []);

      await checkSubscription(clinic.id);
    };

    fetchInitialData();
  }, []);

  const checkSubscription = async (id: string) => {
    const { data: sub } = await supabase
      .from("stripe_subscriptions")
      .select("status")
      .eq("clinic_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.status === "active" || sub?.status === "trialing") {
      setStatus(sub.status);
      onNext(); // Move to next onboarding step
    } else {
      setStatus(sub?.status ?? null);
    }

    setLoading(false);
  };

  const handleSubscribe = async (priceId: string) => {
    if (!clinicId) return;
    const session = await getSupabaseSession();
    setSubscribingId(priceId);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clinic_id: clinicId, price_id: priceId }),
      });

      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Subscribe error:", err);
    } finally {
      setSubscribingId(null);
    }
  };

  interface PricingSelectorProps {
    plans: {
      id: string;
      name: string;
      interval: "month" | "year";
      price_id: string;
      amount: number;
      features?: string[];
    }[];
    subscribingId: string | null;
    // eslint-disable-next-line no-unused-vars
    handleSubscribe: (priceId: string) => void;
  }

  const PricingSelector = ({ plans, subscribingId, handleSubscribe }: PricingSelectorProps) => {
    const [billingCycle, setBillingCycle] = useState("month");
    const filteredPlans = plans.filter(plan => plan.interval === billingCycle);

    const tabItems = [
      { key: "month", label: "Monthly" },
      { key: "year", label: "Yearly" },
    ];

    return (
      <div className="mt-10 flex flex-col items-center">
        <Tabs defaultActiveKey="month" onChange={setBillingCycle} centered items={tabItems} className="px-6 mb-2" />

        <div className={`mt-6 mx-auto ${filteredPlans.length === 1 ? "flex justify-center" : "grid grid-cols-1 md:grid-cols-2 gap-10"}`}>
          {filteredPlans.map(plan => {
            const isPopular = plan.name.toLowerCase().includes("conversion"); // Highlight "Most Popular" plan
            const notAvailble = plan.name.toLowerCase().includes("nurturing"); // Highlight "Not Available" plan

            return (
              <Card
                key={plan.id}
                className={`rounded-2xl shadow-2xl border border-gray-100 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl ${
                  isPopular ? "border-brand-primary ring-2 ring-brand-primary/20" : ""
                } ${filteredPlans.length === 1 ? "w-96" : ""}`}
                styles={{
                  body: {
                    padding: "2rem",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
                style={{
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div className="flex flex-col flex-1 justify-between">
                  <div>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-800 break-words">{plan.name}</h3>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Start free for 14 days</h2>
                    <p className="text-base text-gray-600 mb-4">{`${plan.amount}/${plan.interval} after trial.Cancel anytime.`}</p>
                    <h4 className="text-lg font-bold text-gray-800 mb-3">What You get</h4>
                    <ul className="text-sm text-gray-700 space-y-2 mb-4">
                      {plan.features?.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-[2px] w-2 h-2 rounded-full" style={{ backgroundColor: "#A268F1" }}></span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    type="primary"
                    block
                    size="large"
                    disabled={notAvailble}
                    style={{
                      backgroundColor: notAvailble ? undefined : "#A268F1",
                      borderColor: notAvailble ? undefined : "#A268F1",
                    }}
                    className={`${notAvailble ? "hover:!bg-gray-200" : "hover:!bg-purple-600"} ${notAvailble ? "!text-gray" : "!text-white"} rounded-lg mt-4`}
                    onClick={() => handleSubscribe(plan.price_id)}
                    loading={subscribingId === plan.price_id}
                  >
                    {subscribingId === plan.price_id ? "Redirecting..." : "Subscribe"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col items-center">
      <Typography.Title level={1} className="text-center">
        Choose a Plan to Get Started
      </Typography.Title>

      {loading ? (
        <Skeleton active />
      ) : (
        <div className="mt-6">
          <PricingSelector plans={plans} subscribingId={subscribingId} handleSubscribe={handleSubscribe} />
        </div>
      )}
    </div>
  );
}
