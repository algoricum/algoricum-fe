"use client";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import DashboardLayout from "@/layouts/DashboardLayout";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Alert, Button, Col, Flex, Row } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { AlertTriangle, CheckCircle, Download, ExternalLink, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PaymentCard } from "@/components/common/PaymentCard/payment-card";
dayjs.extend(utc);
dayjs.extend(relativeTime);
const supabase = createClient();

const BillingPage = () => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>("active");
  const [subscriptionEvents, setSubscriptionEvents] = useState<any[]>([]);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>("demo-clinic");
  const [loading, setLoading] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>("price_demo");
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [last4, setLast4] = useState<string | null>("4242");
  const [expMonth, setExpMonth] = useState<number | null>(12);
  const [expYear, setExpYear] = useState<number | null>(2028);
  const [brand, setBrand] = useState<string | null>("visa");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  const hasActiveSubscription = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clinic = await getClinicData();
        if (!clinic) return;

        setClinicId(clinic.id);

        const { data: subscription } = await supabase
          .from("stripe_subscriptions")
          .select("id,status, trial_end, stripe_price_id, current_period_end, stripe_subscription_id, last4, exp_month, exp_year, brand")
          .eq("clinic_id", clinic.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: planData } = await supabase.from("plans").select("*").eq("active", true).order("amount", { ascending: true });

        if (subscription) {
          setSubscriptionStatus(subscription.status);
          setTrialEnd(subscription.trial_end);
          setCurrentPriceId(subscription.stripe_price_id);
          setLast4(subscription.last4);
          setExpMonth(subscription.exp_month);
          setExpYear(subscription.exp_year);
          setBrand(subscription.brand);

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

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!clinicId) return;
      const session = await getSupabaseSession();

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ clinic_id: clinicId }),
        });
        const { invoices } = await response.json();
        setInvoices(invoices || []);
      } catch (err) {
        console.error("Invoice fetch error:", err);
      }
    };
    fetchInvoices();
  }, [clinicId]);

  const handleSubscribe = async (priceId: string) => {
    if (!clinicId) return;

    setSubscribingPlanId(priceId);
    setErrorMessage(null);
    const session = await getSupabaseSession();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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

  const tabItems = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <div className="space-y-6">
          {errorMessage && (
            <Alert
              message="Subscription Error"
              description={errorMessage}
              type="error"
              showIcon
              closable
              onClose={() => setErrorMessage(null)}
              className="mx-4 md:mx-0"
            />
          )}

          {!loading && hasActiveSubscription && (
            <div className="px-4 md:px-0">
              <Row gutter={[24, 24]} className="mb-8">
                <Col xs={24} lg={14}>
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <div className="flex items-center mb-6">
                      {subscriptionStatus === "active" || subscriptionStatus === "trialing" ? (
                        <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 mr-3" />
                      )}
                      <p className="text-lg font-semibold text-gray-800">
                        Subscription Status: <span className="capitalize text-blue-600">{subscriptionStatus}</span>
                      </p>
                    </div>

                    {subscriptionStatus === "trialing" && trialEnd && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-6 shadow-sm">
                        <p className="text-sm text-blue-700 mb-1 font-medium">Trial ends on: {new Date(trialEnd).toLocaleDateString()}</p>
                        {trialDaysLeft !== null && trialDaysLeft >= 0 && (
                          <p className="text-sm text-blue-600">
                            {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                    )}

                    {subscriptionStatus === "trialing" && trialDaysLeft !== null && trialDaysLeft <= 3 && (
                      <div className="flex items-center bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-6 shadow-sm">
                        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span className="text-sm font-medium">Your trial is ending soon. Don't forget to add payment.</span>
                      </div>
                    )}

                    {subscriptionStatus === "active" && billingDate && (
                      <div className="bg-green-50 rounded-lg p-4 mb-6 shadow-sm">
                        <p className="text-sm text-green-700 font-medium">Next billing date: {billingDate}</p>
                      </div>
                    )}

                    {currentPlan && (
                      <div className="border-t border-gray-100 pt-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Plan: {currentPlan.name}</h3>
                        <p className="text-gray-600 text-base">
                          ${currentPlan.amount} {currentPlan.currency.toUpperCase()} / {currentPlan.interval}
                        </p>
                      </div>
                    )}

                    <Button
                      type="primary"
                      size="large"
                      loading={subscribingPlanId === currentPriceId}
                      onClick={() => currentPriceId && handleSubscribe(currentPriceId)}
                      disabled={!currentPriceId}
                      className="w-full md:w-auto px-8"
                      style={{ backgroundColor: "#A200E6" }}
                    >
                      {subscribingPlanId === currentPriceId ? "Redirecting..." : "Manage Subscription"}
                    </Button>
                  </div>
                </Col>

                <Col xs={24} lg={10}>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Payment Method</h3>
                      <div className="flex justify-end">
                        <PaymentCard
                          last4={last4 || "0000"}
                          expMonth={expMonth || 12}
                          expYear={expYear || 2025}
                          brand={brand || "default"}
                          cardholderName="***************"
                          variant="gradient"
                          className="w-full sm:w-auto"
                        />
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {loading && (
            <div className="py-12">
              <LoadingSpinner message="Loading billing information..." size="lg" />
            </div>
          )}

          {subscriptionEvents.length > 0 && (
            <div className="px-4 md:px-0">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-6">Recent Events</h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {subscriptionEvents.map(event => {
                    const { id, type, received_at, summary } = event;
                    const icon =
                      type.includes("payment_failed") || type.includes("subscription.deleted") ? (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <XCircle className="text-red-600 w-5 h-5" />
                        </div>
                      ) : type.includes("trial_will_end") || type.includes("upcoming") ? (
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="text-yellow-600 w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="text-green-600 w-5 h-5" />
                        </div>
                      );

                    return (
                      <div
                        key={id}
                        className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200 hover:shadow-md"
                      >
                        {icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium text-gray-900 leading-5">{summary}</p>
                            <span
                              className="text-xs text-gray-400 whitespace-nowrap"
                              title={dayjs.utc(received_at).local().format("YYYY-MM-DD hh:mm A")}
                            >
                              {dayjs.utc(received_at).local().fromNow()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "invoices",
      label: "Invoices",
      children: (
        <div className="px-4 md:px-0 py-6">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No invoices found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map(inv => (
                <div
                  key={inv.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex-1">
                    <p className="text-base font-semibold text-gray-800 mb-1">
                      {inv.status.toUpperCase()} — {inv.currency.toUpperCase()} ${(inv.amount_paid / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">{dayjs.unix(inv.created).format("MMMM DD, YYYY • hh:mm A")}</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      icon={<ExternalLink size={16} />}
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      type="default"
                      className="flex-1 sm:flex-none bg-[#A200E6] text-white rounded-xl shadow-md hover:bg-[#7a00b3]"
                    >
                      View
                    </Button>

                    <Button
                      icon={<Download size={16} />}
                      href={inv.invoice_pdf}
                      target="_blank"
                      type="default"
                      className="flex-1 sm:flex-none bg-[#A200E6] text-white rounded-xl shadow-md hover:bg-[#7a00b3]"
                    >
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  const TabButton = ({ isActive, onClick, label }: { isActive: boolean; onClick: () => void; label: string }) => {
    return (
      <button
        onClick={onClick}
        className={`flex-1 py-3 px-8 text-center transition-all rounded-[48px] font-medium ${
          isActive ? "bg-[#A200E6] text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-md"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <DashboardLayout
      header={<Header title="Billing" description="Manage your subscription and view billing activity." showHamburgerMenu={true} />}
    >
      <div className="max-w-7xl pl-4">
        <Flex className="mx-4 md:mx-0 border border-gray-200 rounded-[48px] p-2 gap-2 mb-8 mt-6 max-w-md bg-white shadow-lg">
          <TabButton isActive={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
          <TabButton isActive={activeTab === "invoices"} onClick={() => setActiveTab("invoices")} label="Invoices" />
        </Flex>

        {tabItems.find(tab => tab.key === activeTab)?.children}
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
