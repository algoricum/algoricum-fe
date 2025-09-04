"use client";

import { Modal, Alert, Button, Typography, Spin, Input, Select } from "antd";
import { CalendarOutlined, LinkOutlined } from "@ant-design/icons";
import type React from "react";
import { useEffect, useState } from "react";
import CryptoJS from "crypto-js";
import { ModalProps } from "./types";
import Image from "next/image";
import { ErrorToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";
import { getClinicId } from "@/utils/integration-utils";
import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { commonAlertStyles } from "./utils";


const { Text } = Typography;
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
            <Image src="/GravityForm.png" alt="Google" width={50} height={50} />{" "}
          </div>
          <span className="text-xl font-semibold">Connect to Gravity Forms</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      centered
    >
      <div className="py-6">
        {(status === "disconnected" || status === "connecting") && (
          <>
            <Alert
              message="Connect your Gravity Forms Account"
              description="Enter your API credentials and Base URL to fetch available forms."
              type="info"
              className="mb-6 !bg-gray-100 !border-gray-300 !text-gray-800"
              style={{
                ...commonAlertStyles,
                backgroundColor: "#f9fafb",
                borderColor: "#d1d5db",
                color: "#1f2937",
              }}
            />

            <Input placeholder="Consumer Key" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} className="mb-3 h-12" />
            <Input.Password
              placeholder="Consumer Secret"
              value={consumerSecret}
              onChange={e => setConsumerSecret(e.target.value)}
              className="mb-3 h-12"
            />
            <Input
              placeholder="Base URL (e.g. https://yoursite.com)"
              value={baseURL}
              onChange={e => setBaseURL(e.target.value)}
              className="mb-4 h-12"
            />

            <Button
              type="default"
              onClick={fetchForms}
              disabled={!consumerKey || !consumerSecret || !validateUrl(baseURL)}
              className="mb-4 hover:bg-gray-50"
            >
              Fetch Forms
            </Button>

            {loadingForms && <Spin className="block mx-auto mb-4" />}

            {
              <Select
                disabled={loadingForms || !forms.length}
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="Select Forms"
                value={selectedForms}
                onChange={vals => setSelectedForms(vals)}
                className="mb-4 hover:bg-gray-50"
              >
                {forms.map((form: any) => (
                  <Select.Option key={form.id} value={form.id}>
                    {form.title}
                  </Select.Option>
                ))}
              </Select>
            }

            <Button
              loading={buttonLoading}
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={handleConnect}
              disabled={!selectedForms.length}
              className="bg-green-600 border-green-600 hover:bg-gray-50 h-12 px-8 text-lg font-medium"
            >
              Connect Selected Forms
            </Button>
            <BookingLinkComponent
              bgColor="bg-orange-50"
              borderColor="border-orange-400"
              textColor="orange-700"
              buttonBgColor="orange-400" // Normal button color (matches your Tailwind)
              hoverBgColor="orange-600" // Hover color (matches your Tailwind)
            />
          </>
        )}

        {status === "connected" && (
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
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/abdullah-salman-hashlogics/30min", "_blank")}
                className="mt-2 bg-green-600 border-green-600 hover:bg-green-700"
              >
                Book a Support Meeting
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
