"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { createClient } from "@/utils/supabase/config/client";
import { Alert, Badge, Button, Divider, Modal, Select, Spin, Typography } from "antd";
import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { ModalProps } from "./types";

const { Text } = Typography;

interface FacebookPage {
  id: string;
  name: string;
  picture?: { data: { url: string } };
  connected_forms_count: number;
  has_pending_setup: boolean;
  connection_status: string;
}

interface FacebookForm {
  id: string;
  name: string;
  created_time: string;
  status: string;
  is_connected: boolean;
  connection_status?: string;
  days_since_created: number;
  is_recent: boolean;
  is_active: boolean;
  estimated_leads: number;
}

interface FacebookModalProps extends ModalProps {
  clinicId?: string;
  onDisconnect?: () => void;
  forceShowFormSelection?: boolean;
}

const supabase = createClient();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const FacebookLeadFormModal: React.FC<FacebookModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  buttonLoading,
  clinicId,
  onDisconnect,
  forceShowFormSelection = false,
}) => {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [forms, setForms] = useState<FacebookForm[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formsLoading, setFormsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFormSelection, setShowFormSelection] = useState(false);

  // Check if user has pending setup (authenticated but no forms selected)
  const checkPendingSetup = async () => {
    if (!clinicId) {
      console.log("No clinicId available for pending setup check");
      return;
    }

    console.log("Checking pending setup for clinic:", clinicId);

    try {
      const { data, error } = await supabase
        .from("facebook_lead_form_connections")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("lead_form_id", "pending_selection")
        .limit(1);

      console.log("Pending setup query result:", { data, error });

      if (data && data.length > 0) {
        console.log("Found pending setup, showing form selection");
        setShowFormSelection(true);
        await fetchPages();
      } else {
        console.log("No pending setup found");
      }
    } catch (error) {
      console.error("Error checking pending setup:", error);
    }
  };

  const fetchPages = async () => {
    if (!clinicId) return;

    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/facebook-lead-form/fetch-available-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId }),
      });

      const result = await response.json();
      if (result.success) {
        setPages(result.pages || []);
      } else {
        ErrorToast(result.error || "Failed to fetch Facebook pages");
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
      ErrorToast("Failed to fetch Facebook pages");
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async (pageId: string) => {
    if (!clinicId) return;

    setFormsLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/facebook-lead-form/fetch-available-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          facebook_page_id: pageId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setForms(result.forms || []);
        // Pre-select already connected forms
        const connectedForms = result.forms.filter((form: FacebookForm) => form.is_connected);
        setSelectedFormIds(connectedForms.map((form: FacebookForm) => form.id));
      } else {
        ErrorToast(result.error || "Failed to fetch forms");
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
      ErrorToast("Failed to fetch forms");
    } finally {
      setFormsLoading(false);
    }
  };

  const saveSelectedForms = async () => {
    if (!clinicId || !selectedPageId || selectedFormIds.length === 0) {
      ErrorToast("Please select at least one form");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/facebook-lead-form/save-selected-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          facebook_page_id: selectedPageId,
          selected_form_ids: selectedFormIds,
        }),
      });

      const result = await response.json();
      if (result.success) {
        SuccessToast(`Successfully connected ${result.successful} form(s)`);
        setShowFormSelection(false);
        onOk?.();
      } else {
        ErrorToast(result.error || "Failed to save form connections");
      }
    } catch (error) {
      console.error("Error saving forms:", error);
      ErrorToast("Failed to save form connections");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (open && status === "connected" && clinicId) {
      if (forceShowFormSelection) {
        setShowFormSelection(true);
        fetchPages();
      } else {
        checkPendingSetup();
      }
    }
  }, [open, status, clinicId, forceShowFormSelection]);

  useEffect(() => {
    if (selectedPageId) {
      fetchForms(selectedPageId);
    }
  }, [selectedPageId]);

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/facebook2.svg" alt="Facebook" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-800">{showFormSelection ? "Select Facebook Forms" : "Connect to Facebook"}</span>
        </div>
      }
      open={open}
      onOk={showFormSelection ? undefined : onOk}
      onCancel={onCancel}
      okText={status === "connected" && !showFormSelection ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{
        className: "!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800 !text-white",
        style: { backgroundColor: "#6b7280", borderColor: "#6b7280" },
      }}
      width={showFormSelection ? 800 : 500}
      centered
      footer={
        showFormSelection
          ? [
              <Button key="cancel" onClick={onCancel}>
                Cancel
              </Button>,
              onDisconnect && (
                <Button
                  key="disconnect"
                  danger
                  onClick={() => {
                    onDisconnect();
                    onCancel?.();
                  }}
                >
                  Disconnect
                </Button>
              ),
              <Button
                key="save"
                type="primary"
                loading={saving}
                disabled={selectedFormIds.length === 0}
                onClick={saveSelectedForms}
                className="!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800 !text-white"
              >
                Connect Selected Forms ({selectedFormIds.length})
              </Button>,
            ]
          : status === "connected" && onDisconnect
            ? [
                <Button key="cancel" onClick={onCancel}>
                  Cancel
                </Button>,
                <Button
                  key="disconnect"
                  danger
                  onClick={() => {
                    onDisconnect();
                    onCancel?.();
                  }}
                >
                  Disconnect
                </Button>,
                <Button key="ok" type="primary" onClick={onOk} className="!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800">
                  Continue
                </Button>,
              ]
            : undefined
      }
    >
      <div className="py-6">
        {status === "disconnected" && !showFormSelection && (
          <>
            <Alert
              message="Connect your Facebook Lead Ads"
              description="We can automatically sync leads from your Facebook Lead Ads to our platform."
              type="info"
              showIcon
              className="mb-6 !bg-blue-50 !border-blue-300 !text-gray-800"
            />
            <div className="text-center">
              <Button
                loading={buttonLoading}
                disabled={buttonLoading}
                type="primary"
                size="large"
                icon={<Image src="/facebook2.svg" alt="Facebook" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800 h-12 px-8 text-lg font-medium"
              >
                Connect to Facebook
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />
                  • You&apos;ll be redirected to Facebook to sign in
                  <br />• Grant permission to access your lead form responses
                  <br />• You&apos;ll select which forms to sync
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
            <BookingLinkComponent
              bgColor="bg-blue-50"
              borderColor="border-blue-200"
              textColor="blue-700"
              buttonBgColor="custom-blue"
              hoverBgColor="blue-800"
            />
          </>
        )}

        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to Facebook...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization process</Text>
            </div>
          </div>
        )}

        {showFormSelection && (
          <div className="max-h-96 overflow-y-auto">
            <Alert
              message="Select Lead Forms to Connect"
              description="Choose which Facebook Lead Ads forms you want to sync with your account."
              type="info"
              showIcon
              className="mb-4"
            />

            {loading ? (
              <div className="text-center py-8">
                <Spin size="large" />
                <div className="mt-4">
                  <Text>Loading your Facebook pages...</Text>
                </div>
              </div>
            ) : (
              <>
                {/* Page Selection */}
                <div className="mb-6">
                  <Text strong className="block mb-3">
                    Select a Facebook Page:
                  </Text>
                  <Select
                    value={selectedPageId}
                    onChange={setSelectedPageId}
                    placeholder="Choose a Facebook page..."
                    className="w-full"
                    size="large"
                    optionLabelProp="label"
                  >
                    {pages.map(page => (
                      <Select.Option key={page.id} value={page.id} label={page.name}>
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                              {page.picture?.data?.url ? (
                                <img src={page.picture.data.url} alt={page.name} className="w-8 h-8 rounded-full" />
                              ) : (
                                <span className="text-gray-500 text-sm">📄</span>
                              )}
                            </div>
                            <div>
                              <Text strong>{page.name}</Text>
                              <br />
                              <Text className="text-xs text-gray-500">{page.connected_forms_count} form(s) connected</Text>
                            </div>
                          </div>
                          <Badge status={page.connection_status === "active" ? "success" : "processing"} text={page.connection_status} />
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                {/* Forms Selection */}
                {selectedPageId && (
                  <>
                    <Divider />
                    <div>
                      <Text strong className="block mb-3">
                        Select Forms to Connect:
                      </Text>
                      <Select
                        mode="multiple"
                        value={selectedFormIds}
                        onChange={setSelectedFormIds}
                        placeholder="Choose forms to connect..."
                        className="w-full mb-4"
                        size="large"
                        optionLabelProp="label"
                      >
                        {forms.map(form => (
                          <Select.Option key={form.id} value={form.id} label={form.name}>
                            <div className="flex items-center justify-between py-2">
                              <div className="flex items-center">
                                <div>
                                  <Text strong>{form.name}</Text>
                                  <br />
                                  <div className="flex gap-2 mt-1">
                                    <Badge status={form.is_active ? "success" : "default"} text={form.status} />
                                    {form.is_recent && <Badge color="blue" text="Recent" />}
                                    {form.is_connected && <Badge color="green" text="Connected" />}
                                  </div>
                                  <Text className="text-xs text-gray-500">
                                    Created {form.days_since_created} days ago • {form.estimated_leads} leads
                                  </Text>
                                </div>
                              </div>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                      {formsLoading && (
                        <div className="text-center py-4">
                          <Spin />
                          <div className="mt-2">
                            <Text className="text-sm">Loading forms...</Text>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {status === "connected" && !showFormSelection && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your lead form integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4 text-center">
              <Text className="text-gray-600">
                ⚡ Your Facebook Lead Ads integration is ready! Need further help? Book a support meeting.
              </Text>
            </div>
            <BookingLinkComponent
              bgColor="bg-blue-50"
              borderColor="border-blue-200"
              textColor="blue-700"
              buttonBgColor="custom-blue"
              hoverBgColor="blue-800"
            />
          </>
        )}
      </div>
    </Modal>
  );
};
