"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Button,
  Skeleton,
  Alert,
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Flex,
} from "antd";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Download,
} from "lucide-react";
import { createClient } from "@/utils/supabase/config/client";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { Header } from "@/components/common";

dayjs.extend(utc);
dayjs.extend(relativeTime);

const supabase = createClient();

const BillingPage = () => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionEvents, setSubscriptionEvents] = useState<any[]>([]);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [last4, setLast4] = useState<string | null>(null);
  const [expMonth, setExpMonth] = useState<number | null>(null);
  const [expYear, setExpYear] = useState<number | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
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

        const { data: planData } = await supabase
          .from("plans")
          .select("*")
          .eq("active", true)
          .order("amount", { ascending: true });

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
        <>
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

          {!loading && hasActiveSubscription && (
            <Row gutter={10} className="justify-between mb-6">
              <Col xs={18} md={10}>
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
                      Your trial is ending soon. Don’t forget to add payment.
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

                  <Button
                    type="primary"
                    className="mt-2 mb-6"
                    loading={subscribingPlanId === currentPriceId}
                    onClick={() => currentPriceId && handleSubscribe(currentPriceId)}
                    disabled={!currentPriceId}
                  >
                    {subscribingPlanId === currentPriceId ? "Redirecting..." : "Manage Subscription"}
                  </Button>
                </div>
              </Col>

              <Col xs={24} md={10}>
                <Card
                  title="Payment Method"
                  style={{ background: "#9333ea", color: "#fff", borderRadius: "1rem" }}
                  headStyle={{ color: "#fff", borderBottom: "none" }}
                  bodyStyle={{ padding: "1.5rem" }}
                >
                  <Typography.Text style={{ color: "#fff", fontSize: "1rem" }}>Cardholder: {"***************"}</Typography.Text>
                  <div style={{ margin: "0.75rem 0", fontSize: "1.25rem", color: "#fff", letterSpacing: "2px" }}>
                    •••• •••• •••• {last4}
                  </div>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Tag color="gold" style={{ borderRadius: "8px" }}>
                        {brand?.toUpperCase() || "Unknown"}
                      </Tag>
                    </Col>
                    <Col>
                      <Typography.Text style={{ color: "#fff", fontSize: "0.85rem" }}>
                        Exp: {expMonth?.toString().padStart(2, "0")}/{expYear?.toString().slice(-2) || "--"}
                      </Typography.Text>
                    </Col>
                  </Row>
                  <Button
                    block
                    className="mt-4"
                    type="primary"
                    onClick={() => currentPriceId && handleSubscribe(currentPriceId)}
                    loading={subscribingPlanId === currentPriceId}
                    disabled={!currentPriceId}
                  >
                    {subscribingPlanId === currentPriceId ? "Redirecting..." : "Update Payment Method"}
                  </Button>
                </Card>
              </Col>
            </Row>
          )}

          {loading && <Skeleton active paragraph={{ rows: 6 }} className="mt-6" />}

          {subscriptionEvents.length > 0 && (
            <div className="grid grid-cols-1 gap-6 mb-8">
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Recent Events</h3>

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
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      key: "invoices",
      label: "Invoices",
      children: (
        <>
          {invoices.length === 0 ? (
            <p className="text-gray-500 mt-4">No invoices found.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {invoices.map(inv => (
                <div key={inv.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {inv.status.toUpperCase()} — {inv.currency.toUpperCase()} {inv.amount_paid / 100}
                    </p>
                    <p className="text-xs text-gray-500">{dayjs.unix(inv.created).format("YYYY-MM-DD hh:mm A")}</p>
                  </div>
                  <div className="space-x-2">
                    <Button icon={<ExternalLink size={14} />} href={inv.hosted_invoice_url} target="_blank">
                      View
                    </Button>
                    <Button icon={<Download size={14} />} href={inv.invoice_pdf} target="_blank">
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ),
    },
  ];
const TabButton = ({ isActive, onClick, label }: { isActive: boolean; onClick: () => void; label: string }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-6 text-center transition-all rounded-[48px] ${
        isActive ? "bg-brand-primary text-white" : "bg-Gray100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
};
  return (
    <DashboardLayout header={<Header title="Billing" description="Manage your subscription and view billing activity." />}>
      <Flex className="border border-[#E8EAEC] rounded-[48px] p-2 gap-4 w-fit mb-6">
        <TabButton isActive={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
        <TabButton isActive={activeTab === "invoices"} onClick={() => setActiveTab("invoices")} label="Invoices" />
      </Flex>

      {tabItems.find(tab => tab.key === activeTab)?.children}
    </DashboardLayout>
  );
};

export default BillingPage;
