"use client";
import { JSX, useEffect, useState } from "react";
import { Card, Modal, Button, Alert, TreeSelect, Typography, Row, Col, Divider } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { createClient } from "@/utils/supabase/config/client";
import dayjs from "dayjs";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Header } from "@/components/common";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const { Text } = Typography;

// Interface for integration data from RPC
interface IntegrationWithStatus {
  integration_id: string;
  integration_name: string;
  integration_type: string;
  auth_type: string;
  connected: boolean;
  connection_id?: string;
  connection_status?: string;
  auth_data?: any;
  expires_at?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
  integration_logo: string;
  description: string; // ✅ new
}

// Icon mapping for different integrations
const getIntegrationIcon = (logo: string): JSX.Element => {
  return <img src={logo} alt="Integration Logo" style={{ width: "24px", height: "24px" }} />;
};

export default function IntegrationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationWithStatus | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [googleFormTreeData, setGoogleFormTreeData] = useState<any[]>([]);

  useEffect(() => {
    const fetchIntegrations = async () => {
      setLoading(true);
      try {
        const clinicData = await getClinicData();
        if (!clinicData?.id) {
          setLoading(false);
          return;
        }

        // Call the RPC function to get all integrations with connection status
        const { data, error } = await supabase.rpc("get_clinic_integrations_with_status", {
          clinic_uuid: clinicData.id,
        });

        if (error) {
          console.error("Error fetching integrations:", error);
          ErrorToast("Failed to fetch integrations");
          return;
        }

        setIntegrations(data || []);
      } catch (error) {
        console.error("Failed to fetch integrations:", error);
        ErrorToast("Failed to fetch integrations");
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, [supabase]);

  const handleIntegrationClick = async (integration: IntegrationWithStatus) => {
    if (!integration.connected) {
      handleConnect(integration);
      return;
    }

    if (integration.integration_name === "Google Forms" || integration.integration_name === "Google Lead Forms") {
      setSelectedIntegration(integration);
      await fetchGoogleFormData(integration);
      setShowModal(true);
    }
  };

  const fetchGoogleFormData = async (integration: IntegrationWithStatus) => {
    try {
      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", integration.connection_id);

      if (savedError) throw savedError;

      const savedSheetKeys = savedSheets.map(s => `${s.spreadsheet_id}:${s.sheet_id}`);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/list-spreadsheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connection_id: integration.connection_id,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const { spreadsheets } = await res.json();

      const treeData = (spreadsheets || []).map((spreadsheet: any) => ({
        title: spreadsheet.spreadsheet_title,
        value: spreadsheet.spreadsheet_id,
        selectable: false,
        children: (spreadsheet.sheets || []).map((sheet: any) => ({
          title: sheet.sheet_title,
          value: `${spreadsheet.spreadsheet_id}:${sheet.sheet_id}`,
          isLeaf: true,
        })),
      }));

      setGoogleFormTreeData(treeData);
      setSelectedSheets(savedSheetKeys);
    } catch (error) {
      console.error("Failed to fetch Google Forms data:", error);
      ErrorToast("Failed to fetch Google Forms data");
    }
  };

  const syncGoogleFormLeads = async () => {
    if (!selectedIntegration) return;

    try {
      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", selectedIntegration.connection_id);

      if (savedError) throw savedError;

      const savedKeys = savedSheets.map(s => `${s.spreadsheet_id}:${s.sheet_id}`);

      const newSheets = selectedSheets.filter(key => !savedKeys.includes(key));

      const removedSheets = savedKeys.filter(key => !selectedSheets.includes(key));
      if (removedSheets.length > 0) {
        await Promise.all(
          removedSheets.map(async key => {
            const [spreadsheet_id, sheet_id] = key.split(":");
            await supabase
              .from("google_form_sheets")
              .delete()
              .eq("connection_id", selectedIntegration.connection_id)
              .eq("spreadsheet_id", spreadsheet_id)
              .eq("sheet_id", sheet_id);
          }),
        );
      }

      if (newSheets.length === 0) {
        SuccessToast("✅ Sheets are already synced!");
        setShowModal(false);
        return;
      }

      const newSheetsPayload = newSheets.map(key => {
        const [spreadsheet_id, sheet_id] = key.split(":");
        const spreadsheet = googleFormTreeData.find(s => s.value === spreadsheet_id);
        const sheet = spreadsheet?.children?.find((c: any) => c.value === key);

        return {
          spreadsheet_id,
          spreadsheet_title: spreadsheet?.title || "",
          sheet_id,
          sheet_title: sheet?.title || "",
        };
      });

      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/save-selected-sheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connection_id: selectedIntegration.connection_id,
          selected_sheets: newSheetsPayload,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      SuccessToast(`✅ Successfully synced ${result.sync_result.leads_created} leads from Google Lead Form!`);
      setShowModal(false);
    } catch (error) {
      console.error("Failed to sync leads:", error);
      ErrorToast("Failed to sync leads");
    }
  };

  const handleConnect = (integration: IntegrationWithStatus) => {
    console.log(`Connecting to ${integration.integration_name}`);
    // Add connection logic here
  };

  const connectedIntegrations = integrations.filter(i => i.connected);
  const availableIntegrations = integrations.filter(i => !i.connected);

  return (
    <DashboardLayout
      header={
        <Header title="Integrations" description="Connect and manage your third-party services and integrations." showHamburgerMenu />
      }
    >
      <div className="p-6">
        {loading ? (
          <LoadingSpinner message="Loading integrations..." size="lg" />
        ) : (
          <div>
            {/* Connected Services */}
            {connectedIntegrations.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Connected Services</h2>
                  <p className="text-gray-400 text-sm">Services that are currently integrated and active</p>
                </div>
                <Row gutter={[16, 16]}>
                  {connectedIntegrations.map(integration => (
                    <Col xs={24} sm={12} lg={8} key={integration.integration_id}>
                      <Card
                        className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition border border-green-200 rounded-lg h-full"
                        onClick={() => handleIntegrationClick(integration)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            {getIntegrationIcon(integration.integration_logo)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">{integration.integration_name}</h3>
                            {/* ✅ show description if available */}
                            <p className="text-gray-500 text-sm">{integration.description || "No description available"}</p>
                            <p className="text-gray-400 text-xs mt-1">
                              {integration.last_sync_at
                                ? `Last sync: ${dayjs(integration.last_sync_at).format("MMM D, h:mm A")}`
                                : "Not synced yet"}
                            </p>
                          </div>
                          <Button
                            type="primary"
                            size="small"
                            style={{
                              backgroundColor: "#10B981",
                              borderColor: "#10B981",
                              cursor: "default",
                            }}
                            disabled
                          >
                            Connected
                          </Button>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {connectedIntegrations.length > 0 && availableIntegrations.length > 0 && <Divider style={{ borderColor: "#374151" }} />}

            {/* Available Integrations */}
            {availableIntegrations.length > 0 && (
              <div>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Available Integrations</h2>
                  <p className="text-gray-400 text-sm">Services ready to connect to enhance your workflow</p>
                </div>
                <Row gutter={[16, 16]}>
                  {availableIntegrations.map(integration => (
                    <Col xs={24} sm={12} lg={8} key={integration.integration_id}>
                      <Card
                        className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-lg h-full cursor-pointer"
                        onClick={() => handleIntegrationClick(integration)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            {getIntegrationIcon(integration.integration_logo)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">{integration.integration_name}</h3>
                            {/* ✅ show description */}
                            <p className="text-gray-500 text-sm">{integration.description || "Click to connect this service"}</p>
                          </div>
                          <Button
                            type="primary"
                            size="small"
                            style={{
                              backgroundColor: "#A200E6",
                              borderColor: "#A200E6",
                            }}
                          >
                            Connect
                          </Button>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
        )}

        {/* Google Forms/Lead Forms Modal */}
        <Modal
          title={
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <GoogleOutlined className="text-white text-lg" />
              </div>
              <span className="text-xl font-semibold">{selectedIntegration?.integration_name} Integration</span>
            </div>
          }
          open={showModal}
          onCancel={() => setShowModal(false)}
          footer={null}
          width={500}
          centered
        >
          <div className="py-6">
            <Alert
              message={`Connected to ${selectedIntegration?.integration_name}`}
              description={selectedIntegration?.description || "Integration is active and ready to sync"} // ✅ show description here too
              type="success"
              showIcon
              className="mb-4"
            />

            <div className="mb-4">
              <Text strong>Last Sync:</Text>{" "}
              {selectedIntegration?.last_sync_at ? dayjs(selectedIntegration.last_sync_at).format("MMM D, YYYY h:mm A") : "Never"}
            </div>

            <div className="mb-4">
              <Text className="block mb-2">Select worksheets to sync leads from:</Text>
              <TreeSelect
                style={{ width: "100%" }}
                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                placeholder="Select worksheets"
                treeData={googleFormTreeData}
                multiple
                treeCheckable
                value={selectedSheets}
                onChange={setSelectedSheets}
              />
            </div>

            <div className="flex justify-between items-center mt-6">
              <Button
                type="primary"
                onClick={syncGoogleFormLeads}
                className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                disabled={selectedSheets.length === 0}
              >
                Sync Leads
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
