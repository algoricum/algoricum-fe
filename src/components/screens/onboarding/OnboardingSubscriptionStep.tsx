"use client";

import { ErrorToast } from "@/helpers/toast";
import { handleSubscribe } from "@/utils/stripe";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Button, Card, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
const supabase = createClient();

interface OnboardingSubscriptionStepProps {
  onNext: (data?: any) => void;
}

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
  handleSubscribe: (priceId: string) => void;
}

export default function OnboardingSubscriptionStep({ onNext }: OnboardingSubscriptionStepProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [subscribingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch plans immediately (no dependencies)
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await supabase.from("plans").select("*").eq("active", true).order("amount", { ascending: true });
        setPlans(data || []);
      } catch (error) {
        console.error("Error fetching plans:", error);
        ErrorToast("Failed to load plans.");
      }
    };
    fetchPlans();
  }, []);

  // Fetch clinic data
  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const clinic = await getClinicData();
        console.log(".......Clinic data:.....", clinic);
        if (clinic) {
          setClinicId(clinic.id);
        } else {
          ErrorToast("Clinic data not found.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching clinic data:", error);
        ErrorToast("Failed to load clinic data.");
        setLoading(false);
      }
    };
    fetchClinic();
  }, []);

  // Check subscription when clinic ID is available
  useEffect(() => {
    if (!clinicId) return;

    const checkSubscription = async () => {
      try {
        const { data: sub } = await supabase
          .from("stripe_subscriptions")
          .select("status")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub?.status === "active" || sub?.status === "trialing") {
          onNext();
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
        ErrorToast("Failed to check subscription status.");
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [clinicId, onNext]);

  const PricingSelector = ({ plans, subscribingId, handleSubscribe }: PricingSelectorProps) => {
    return (
      <div className="mt-10 flex flex-col items-center">
        <div className={`mt-6 mx-auto ${plans.length === 1 ? "flex justify-center" : "grid grid-cols-1 md:grid-cols-2 gap-10"}`}>
          {plans.map(plan => {
            const isPopular = plan.name.toLowerCase().includes("conversion"); // Highlight "Most Popular" plan
            const notAvailble = plan.name.toLowerCase().includes("nurturing"); // Highlight "Not Available" plan

            return (
              <Card
                key={plan.id}
                className={`rounded-2xl shadow-2xl border border-gray-100 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl ${
                  isPopular ? "border-brand-primary ring-2 ring-brand-primary/20" : ""
                } ${plans.length === 1 ? "w-96" : ""}`}
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
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {plan.name == "Free Plan" ? "Free for LifeTime" : "Premium Offerings"}
                    </h2>
                    <p className="text-base text-gray-600 mb-4">{`$${plan.amount}/${plan.interval} ${plan.amount == 0 ? "" : "Cancel anytime."}`}</p>
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
        Get started
      </Typography.Title>

      {loading ? (
        <Skeleton active />
      ) : (
        <div className="mt-6">
          <PricingSelector plans={plans} subscribingId={subscribingId} handleSubscribe={priceId => handleSubscribe(priceId, clinicId)} />
        </div>
      )}
    </div>
  );
}
