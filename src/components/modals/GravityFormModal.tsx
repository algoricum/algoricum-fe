"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { ErrorToast } from "@/helpers/toast";
import { getClinicId } from "@/utils/integration-utils";
import { createClient } from "@/utils/supabase/config/client";
import { InfoCircleOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Modal, Select, Spin, Typography } from "antd";
import CryptoJS from "crypto-js";
import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text, Title } = Typography;
const supabase = createClient();

export const GravityFormModal: React.FC<ModalProps> = ({ open, status, onCancel, onConnect, buttonLoading }) => {
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [forms, setForms] = useState<any[]>([]);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);

  const validateUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const fetchForms = async () => {
    if (!consumerKey || !consumerSecret || !validateUrl(baseURL)) {
      return;
    }

    setLoadingForms(true);

    const method = "GET";
    const endpoint = `${baseURL}/wp-json/gf/v2/forms`;

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_version: "1.0",
    };

    try {
      // Step 1: create parameter string (sorted & encoded)
      const paramString = Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
        .join("&");
      // Step 2: create base string
      const baseString = [method.toUpperCase(), encodeURIComponent(endpoint), encodeURIComponent(paramString)].join("&");
      // Step 3: sign it with consumerSecret + "&"
      const signingKey = `${encodeURIComponent(consumerSecret)}&`;
      const signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(baseString, signingKey));
      // Step 4: add signature to params
      const finalUrl = `${endpoint}?${paramString}&oauth_signature=${encodeURIComponent(signature)}`;

      const res = await fetch(finalUrl);
      if (!res.ok) {
        ErrorToast("Error fetching forms");
        return;
      }
      const data = await res.json();
      const formsArray = Object.values(data);
      setForms(formsArray);
      // if (Array.isArray(data)) {
      //   setForms(data);
      // } else if (data.forms) {
      //   setForms(data.forms);
      // } else {
      //   throw new Error("Unexpected response");
      // }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForms(false);
    }
  };

  async function getIntegrationData() {
    const clinicId = await getClinicId();
    const { data: connection } = await supabase.from("integrations").select("id").eq("name", "Gravity Form").single();
    const { data: auth_data } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("integration_id", connection?.id)
      .single();
    if (auth_data) {
      setConsumerKey(auth_data.auth_data.consumerKey);
      setConsumerSecret(auth_data.auth_data.consmerSecret);
      setBaseURL(auth_data.auth_data.baseURL);
    }
    await fetchForms();
    setSelectedForms(auth_data.auth_data.form_ids);
  }

  useEffect(() => {
    if (status === "connecting") {
      getIntegrationData();
    }
  }, [open, status]);

  const handleConnect = async () => {
    if (!selectedForms.length) return;
    onConnect?.({
      form_ids: selectedForms,
      consumerKey,
      consumerSecret,
      baseURL,
    });
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3">
            <Image src="/GravityForm.png" alt="Gravity Forms" width={50} height={50} />
          </div>
          <span className="text-xl font-semibold">Connect to Gravity Forms</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1000}
      centered
    >
      <div className="py-4">
        {status && (
          <>
            <Alert
              message="Connect your Gravity Forms Account"
              description="Enter your API credentials and Base URL to fetch available forms."
              type="info"
              className="mb-4 !bg-gray-100 !border-gray-300 !text-gray-800"
              style={{
                ...commonAlertStyles,
                backgroundColor: "#f9fafb",
                borderColor: "#d1d5db",
                color: "#1f2937",
              }}
            />

            <div className="flex gap-6">
              {/* Left Column - Form Inputs */}
              <div className="flex-1">
                <div className="space-y-3">
                  <Input placeholder="Consumer Key" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} className="h-11" />
                  <Input.Password
                    placeholder="Consumer Secret"
                    value={consumerSecret}
                    onChange={e => setConsumerSecret(e.target.value)}
                    className="h-11"
                  />
                  <Input
                    placeholder="Base URL (e.g. https://yoursite.com)"
                    value={baseURL}
                    onChange={e => setBaseURL(e.target.value)}
                    className="h-11"
                  />

                  <div className="flex gap-3">
                    <Button
                      type="default"
                      onClick={fetchForms}
                      disabled={!consumerKey || !consumerSecret || !validateUrl(baseURL)}
                      className="hover:bg-gray-50 h-11 flex-1"
                    >
                      {loadingForms ? <Spin size="small" /> : "Fetch Forms"}
                    </Button>
                  </div>

                  <Select
                    disabled={loadingForms || !forms.length}
                    mode="multiple"
                    style={{ width: "100%" }}
                    placeholder="Select Forms"
                    value={selectedForms}
                    onChange={vals => setSelectedForms(vals)}
                    className="hover:bg-gray-50"
                    size="large"
                  >
                    {forms.map((form: any) => (
                      <Select.Option key={form.id} value={form.id}>
                        {form.title}
                      </Select.Option>
                    ))}
                  </Select>

                  <Button
                    loading={buttonLoading}
                    type="primary"
                    size="large"
                    icon={<LinkOutlined />}
                    onClick={handleConnect}
                    disabled={!selectedForms.length}
                    className="bg-green-600 border-green-600 hover:bg-green-700 h-12 w-full text-lg font-medium"
                  >
                    Connect Selected Forms
                  </Button>
                </div>
              </div>

              {/* Right Column - Instructions */}
              <div className="flex-1">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg h-full">
                  <Title level={5} className="!mb-3 flex items-center">
                    <InfoCircleOutlined className="mr-2 text-blue-500" />
                    How to Connect
                  </Title>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Text strong>Step 1:</Text> Log in to your <Text code>WordPress Admin Dashboard</Text> and navigate to{" "}
                      <Text code>Forms → Settings → REST API</Text>.
                    </div>
                    <div>
                      <Text strong>Step 2:</Text> Generate a new <strong>API Key</strong> and copy your <Text strong>Consumer Key</Text> and{" "}
                      <Text strong>Consumer Secret</Text>.
                    </div>
                    <div>
                      <Text strong>Step 3:</Text> Enter your <Text code>WordPress Base URL</Text> (e.g.{" "}
                      <Text code>https://yourwebsite.com</Text>).
                    </div>
                    <div>
                      <Text strong>Step 4:</Text> Click <Text code>Fetch Forms</Text> to load all available Gravity Forms.
                    </div>
                    <div>
                      <Text strong>Step 5:</Text> Select one or more forms and click <Text code>Connect Selected Forms</Text>.
                    </div>
                    <div className="pt-2 border-t border-gray-300 mt-4">
                      <Text type="secondary">
                        ⚡ <strong>Tip:</strong> Ensure your WordPress site uses HTTPS and the Gravity Forms plugin is active.
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <BookingLinkComponent
                bgColor="bg-orange-50"
                borderColor="border-orange-400"
                textColor="orange-700"
                buttonBgColor="orange-400"
                hoverBgColor="orange-600"
              />
            </div>
          </>
        )}

        {/* {status === "connected" && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to Gravity Forms. Your Gravity Forms integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="flex flex-col items-center">
              <Text className="text-gray-600">⚡ Your Gravity Forms integration is ready! Need further help? Book a support meeting.</Text>
              <br />
            </div>
            <BookingLinkComponent
              bgColor="bg-orange-50"
              borderColor="border-orange-400"
              textColor="orange-700"
              buttonBgColor="orange-400"
              hoverBgColor="orange-600"
            />
          </>
        )} */}
      </div>
    </Modal>
  );
};
