"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, Button, Alert } from "antd";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/config/client";
import { Header } from "@/components/common";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(relativeTime);

const supabase = createClient();

const BillingPage = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionEvents, setSubscriptionEvents] = useState<any[]>([]);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clinic = await getClinicData();
        if (!clinic) return;

        setClinicId(clinic.id);

        const { data: subscription } = await supabase
          .from("stripe_subscriptions")
          .select("id,status, trial_end, stripe_price_id, current_period_end, stripe_subscription_id")
          .eq("clinic_id", clinic.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: planData } = await supabase.from("plans").select("*").eq("active", true).order("amount", { ascending: true });

        setPlans(planData || []);

        if (subscription) {
          setSubscriptionStatus(subscription.status);
          setTrialEnd(subscription.trial_end);
          setCurrentPriceId(subscription.stripe_price_id);

          const matchedPlan = planData?.find(plan => plan.price_id === subscription.stripe_price_id);
          setCurrentPlan({
            ...matchedPlan,
            current_period_end: subscription.current_period_end,
          });

          if (subscription.stripe_subscription_id) {
            const { data: events } = await supabase
              .from("stripe_events")
              .select("*")
              .eq("subscription_id", subscription.id)
              .order("received_at", { ascending: false });

            setSubscriptionEvents(events || []);
          }
        }
      } catch (error) {
        console.error("Billing fetch error:", error);
        setErrorMessage("Failed to load billing data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hasActiveSubscription = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  const handleSubscribe = async (priceId: string) => {
    if (!clinicId) return;

    setSubscribingPlanId(priceId);
    setErrorMessage(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinic_id: clinicId,
          price_id: priceId,
        }),
      });

      if (!response.ok) throw new Error("Checkout session creation failed");

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error("Subscribe error:", err);
      setErrorMessage("Something went wrong while starting the subscription.");
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const trialDaysLeft = trialEnd ? Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const billingDate = currentPlan?.current_period_end ? new Date(currentPlan.current_period_end).toLocaleDateString() : null;

  return (
    <DashboardLayout header={<Header title="Lead Management" description="Manage and track your leads through the conversion process." />}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and view billing activity.</p>
        </div>

        {errorMessage && (
          <Alert
            message="Subscription Error"
            description={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            className="mb-4"
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow">
            <LoadingSpinner message="Loading billing information..." size="lg" />
          </div>
        )}

        {/* Active Subscription Display */}
        {!loading && hasActiveSubscription && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              {subscriptionStatus === "active" || subscriptionStatus === "trialing" ? (
                <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 mr-2" />
              )}
              <p className="text-gray-700 font-semibold">
                Subscription Status: <span className="capitalize">{subscriptionStatus}</span>
              </p>
            </div>

            {subscriptionStatus === "trialing" && trialEnd && (
              <p className="text-sm text-gray-500 mb-2">
                Trial ends on: {new Date(trialEnd).toLocaleDateString()}
                {trialDaysLeft !== null && trialDaysLeft >= 0 && ` (${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left)`}
              </p>
            )}

            {subscriptionStatus === "trialing" && trialDaysLeft !== null && trialDaysLeft <= 3 && (
              <div className="flex items-center text-yellow-600 text-sm mb-4">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Your trial is ending soon. Don&apos;t forget to add payment.
              </div>
            )}

            {subscriptionStatus === "active" && billingDate && (
              <p className="text-sm text-gray-500 mb-4">Next billing date: {billingDate}</p>
            )}

            {currentPlan && (
              <div className="mb-4">
                <h3 className="text-md font-semibold text-gray-800">Current Plan: {currentPlan.name}</h3>
                <p className="text-sm text-gray-600">
                  ${currentPlan.amount} {currentPlan.currency.toUpperCase()} / {currentPlan.interval}
                </p>
              </div>
            )}

            {subscribingPlanId === currentPriceId ? (
              <div className="mt-2 mb-6">
                <LoadingSpinner message="Redirecting to billing portal..." size="sm" />
              </div>
            ) : (
              <Button
                type="primary"
                className="mt-2 mb-6"
                onClick={() => currentPriceId && handleSubscribe(currentPriceId)}
                disabled={!currentPriceId}
              >
                Manage Subscription
              </Button>
            )}
          </div>
        )}

        {/* Plan Selection for Non-Subscribers */}
        {!hasActiveSubscription && !loading && (
          <div className="mt-6">
            <Tabs
              activeKey={billingCycle}
              onChange={setBillingCycle}
              items={[
                { key: "monthly", label: "Monthly" },
                { key: "annually", label: "Annually" },
              ]}
            />

            <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans
                .filter(plan => plan.interval === (billingCycle === "monthly" ? "month" : "year"))
                .map(plan => {
                  return (
                    <div key={plan.id} className="border rounded-md p-4 shadow-sm">
                      <h2 className="text-lg font-bold text-gray-800">{plan.name}</h2>
                      <p className="text-gray-600">
                        ${plan.amount} {plan.currency.toUpperCase()} / {plan.interval}
                      </p>
                      {plan.features && (
                        <ul className="text-sm text-gray-500 list-disc list-inside mt-2">
                          {plan.features.map((feature: string, i: number) => (
                            <li key={i}>{feature}</li>
                          ))}
                        </ul>
                      )}
                      {subscribingPlanId === plan.price_id ? (
                        <div className="mt-4">
                          <LoadingSpinner message="Setting up subscription..." size="sm" />
                        </div>
                      ) : (
                        <Button type="primary" className="mt-4" onClick={() => handleSubscribe(plan.price_id)}>
                          Subscribe
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Subscription Events */}
        {subscriptionEvents.length > 0 && (
          <div className="grid grid-cols-1 gap-6 mb-8">
            <div className="card">
              <h3 className="text-lg font-semibold mb-6">Recent Events</h3>
              {subscriptionEvents.length === 0 ? (
                <div className="text-sm text-gray-500">No recent events to show.</div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {subscriptionEvents.map(event => {
                    const { id, type, received_at, summary } = event;
                    const icon =
                      type.includes("payment_failed") || type.includes("subscription.deleted") ? (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="text-red-600 w-4 h-4" />
                        </div>
                      ) : type.includes("trial_will_end") || type.includes("upcoming") ? (
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <AlertTriangle className="text-yellow-600 w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="text-green-600 w-4 h-4" />
                        </div>
                      );

                    return (
                      <div key={id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">{summary}</p>
                            <span className="text-xs text-gray-400" title={dayjs.utc(received_at).local().format("YYYY-MM-DD hh:mm A")}>
                              {dayjs.utc(received_at).local().fromNow()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
