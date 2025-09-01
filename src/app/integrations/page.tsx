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
import {
        FacebookLeadFormModal,
        CsvUploadModal, 
        CustomCrmModal,
        GoHighLevelLeadFormModal,
        GoogleFormModal,
        HubspotModal,
        JotformModal,
        GravityFormModal,
        GoogleLeadFormModal,
        PipedriveModal,
        TypeformModal,
        NexHealthLeadFormModal,
        // CsvUploadModalProps,
        // CustomCrmModalProps,
        // ModalProps 
        } from "@/components/modals/Modals"
import {ConnectionStatus} from "@/app/types/types"
import { updateIntegrationConnectionStatus } from "./integrationUtils";
import {
  getClinicId,
  // handleCsvUpload,
  syncPipedriveLeads,
  syncGoogleFormLeads,
  syncGoogleLeadFormLeads,
  syncTypeformLeads,
  // clearOAuthState,
  connectToHubSpot,
  connectToPipedrive,
  connectToGoogleForm,
  connectToTypeform,
  findSheetDetails,
  // InfoToast,
  createJotformConnection,
  syncJotformLeads,
  connectToGHL,
  connectToNextHealth,
  connnectToGravityForm,
  connectToGoogleLeadForm,
  // fetchGoogleFormSheets,
  // fetchTypeformForms,
  // fetchJotformForms,
  // handleInput,
  // handle_Next,
} from "@/utils/integration-utils";

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
  description: string; 
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
  const [buttonLoading,setButtonLoading]=useState(false)
  
  // hubspot 
  const [hubspotAccountInfo, ] = useState<any>(null);
  
  // TypeForm 
  const [TypeformTreeData, ] = useState([]);
  const [selectedTypeformForms, setSelectedTypeformForms] = useState<any[]>([]);
  const [typeformAccountInfo, setTypeformAccountInfo] = useState<any>(null);
  const [, setTypeformLeadsSynced] = useState(false);
 
  //jotform
  const [jotformTreeData, ] = useState([]);
  const [selectedJotformForms, setSelectedJotformForms] = useState<any[]>([]);
  const [, setJotformLeadsSynced] = useState(false);

  // Google Lead Form
  const [googleLeadFormAccountInfo, setGoogleLeadFormAccountInfo] = useState<any>(null);

  // Google Form
  const [googleFormAccountInfo, setGoogleFormAccountInfo] = useState<any>(null);
  const [selectedGoogleFormWorksheets, setSelectedGoogleFormWorksheets] = useState<any[]>([]);
  const [, setGoogleFormLeadsSynced] = useState(false);

  //  pipedrive
  const [pipedriveAccountInfo, setPipedriveAccountInfo] = useState<any>(null);

  // Integration status states
  const [facebookLeadFormStatus, setFacebookLeadFormStatus] = useState<ConnectionStatus>("disconnected");
  const [jotformStatus, setJotformStatus] = useState<ConnectionStatus>("disconnected");
  const [googleLeadFormStatus, setGoogleLeadFormStatus] = useState<ConnectionStatus>("disconnected");
  const [googleFormStatus, setGoogleFormStatus] = useState<ConnectionStatus>("disconnected");
  const [hubspotStatus, setHubspotStatus] = useState<ConnectionStatus>("disconnected");
  const [goHighLevelStatus, setGoHighLevelStatus] = useState<ConnectionStatus>("disconnected");
  const [typeformStatus, setTypeformStatus] = useState<ConnectionStatus>("disconnected");
  const [pipedriveStatus, setPipedriveStatus] = useState<ConnectionStatus>("disconnected");
  const [gravityFormStatus, setGravityFormStatus] = useState<ConnectionStatus>("disconnected");
  const [nexHealthStatus, setNexHealthStatus] = useState<ConnectionStatus>("disconnected");

  // Modal visibility states
  const [showFacebookLeadModal, setShowFacebookLeadModal] = useState(false);
  const [showJotformModal, setShowJotformModal] = useState(false);
  const [showGoogleLeadFormModal, setShowGoogleLeadFormModal] = useState(false);
  const [showGoogleFormModal, setShowGoogleFormModal] = useState(false);
  const [showHubspotModal, setShowHubspotModal] = useState(false);
  const [showGoHighLevelModal, setShowGoHighLevelModal] = useState(false);
  const [showTypeformModal, setShowTypeformModal] = useState(false);
  const [showPipedriveModal, setShowPipedriveModal] = useState(false);
  const [showGravityFormModal, setShowGravityFormModal] = useState(false);
  const [showNexHealthModal, setShowNexHealthModal] = useState(false);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [showCustomCrmModal, setShowCustomCrmModal] = useState(false);


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

  useEffect(() => {
    const initializeAllIntegrationStatuses = async () => {
      try {
        const clinicData = await getClinicData();
        if (!clinicData?.id) {
          ErrorToast("Clinic ID is not found.");
          setLoading(false);
          return;
        }

        // Check all integration statuses in parallel
        const statusChecks = await Promise.allSettled([
          updateIntegrationConnectionStatus(clinicData.id, "Facebook Lead Forms"),
          updateIntegrationConnectionStatus(clinicData.id, "Jotform"),
          updateIntegrationConnectionStatus(clinicData.id, "Google Lead Forms"),
          updateIntegrationConnectionStatus(clinicData.id, "Google Forms"),
          updateIntegrationConnectionStatus(clinicData.id, "Hubspot"),
          updateIntegrationConnectionStatus(clinicData.id, "GoHighLevel"),
          updateIntegrationConnectionStatus(clinicData.id, "Typeform"),
          updateIntegrationConnectionStatus(clinicData.id, "Pipedrive"),
          updateIntegrationConnectionStatus(clinicData.id, "Gravity Form"),
          updateIntegrationConnectionStatus(clinicData.id, "NextHealth")
        ]);

        // Update states based on results
        if (statusChecks[0].status === "fulfilled") setFacebookLeadFormStatus(statusChecks[0].value);
        if (statusChecks[1].status === "fulfilled") setJotformStatus(statusChecks[1].value);
        if (statusChecks[2].status === "fulfilled") setGoogleLeadFormStatus(statusChecks[2].value);
        if (statusChecks[3].status === "fulfilled") setGoogleFormStatus(statusChecks[3].value);
        if (statusChecks[4].status === "fulfilled") setHubspotStatus(statusChecks[4].value);
        if (statusChecks[5].status === "fulfilled") setGoHighLevelStatus(statusChecks[5].value);
        if (statusChecks[6].status === "fulfilled") setTypeformStatus(statusChecks[6].value);
        if (statusChecks[7].status === "fulfilled") setPipedriveStatus(statusChecks[7].value);
        if (statusChecks[8].status === "fulfilled") setGravityFormStatus(statusChecks[8].value);
        if (statusChecks[9].status === "fulfilled") setNexHealthStatus(statusChecks[9].value);

      } catch (error) {
        console.log("Failed to initialize integration statuses:", error);
      }
    };

    initializeAllIntegrationStatuses();
  }, []);

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

  // const syncGoogleFormLeads = async (selectedSheetsObjects: ({ spreadsheet_id: any; spreadsheet_title: any; sheet_id: any; sheet_title: any; } | null)[]) => {
  //   if (!selectedIntegration) return;

  //   try {
  //     const { data: savedSheets, error: savedError } = await supabase
  //       .from("google_form_sheets")
  //       .select("spreadsheet_id, sheet_id")
  //       .eq("connection_id", selectedIntegration.connection_id);

  //     if (savedError) throw savedError;

  //     const savedKeys = savedSheets.map(s => `${s.spreadsheet_id}:${s.sheet_id}`);

  //     const newSheets = selectedSheets.filter(key => !savedKeys.includes(key));

  //     const removedSheets = savedKeys.filter(key => !selectedSheets.includes(key));
  //     if (removedSheets.length > 0) {
  //       await Promise.all(
  //         removedSheets.map(async key => {
  //           const [spreadsheet_id, sheet_id] = key.split(":");
  //           await supabase
  //             .from("google_form_sheets")
  //             .delete()
  //             .eq("connection_id", selectedIntegration.connection_id)
  //             .eq("spreadsheet_id", spreadsheet_id)
  //             .eq("sheet_id", sheet_id);
  //         }),
  //       );
  //     }

  //     if (newSheets.length === 0) {
  //       SuccessToast("Sheets are already synced!");
  //       setShowModal(false);
  //       return;
  //     }

  //     const newSheetsPayload = newSheets.map(key => {
  //       const [spreadsheet_id, sheet_id] = key.split(":");
  //       const spreadsheet = googleFormTreeData.find(s => s.value === spreadsheet_id);
  //       const sheet = spreadsheet?.children?.find((c: any) => c.value === key);

  //       return {
  //         spreadsheet_id,
  //         spreadsheet_title: spreadsheet?.title || "",
  //         sheet_id,
  //         sheet_title: sheet?.title || "",
  //       };
  //     });

  //     const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/save-selected-sheets`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  //         apikey: SUPABASE_ANON_KEY,
  //       },
  //       body: JSON.stringify({
  //         connection_id: selectedIntegration.connection_id,
  //         selected_sheets: newSheetsPayload,
  //       }),
  //     });

  //     if (!response.ok) throw new Error(await response.text());

  //     const result = await response.json();
  //     SuccessToast(`Successfully synced ${result.sync_result.leads_created} leads from Google Lead Form!`);
  //     setShowModal(false);
  //   } catch (error) {
  //     console.error("Failed to sync leads:", error);
  //     ErrorToast("Failed to sync leads");
  //   }
  // };

  const handleConnect = (integration: IntegrationWithStatus) => {
    switch (integration.integration_name) {
      case "Facebook Lead Forms":
        setShowFacebookLeadModal(true);
        break;
      case "Jotform":
        setShowJotformModal(true);
        break;
      case "Google Lead Forms":
        setShowGoogleLeadFormModal(true);
        break;
      case "Google Forms":
        setShowGoogleFormModal(true);
        break;
      case "Hubspot":
        setShowHubspotModal(true);
        break;
      case "GoHighLevel":
        setShowGoHighLevelModal(true);
        break;
      case "Typeform":
        setShowTypeformModal(true);
        break;
      case "Pipedrive":
        setShowPipedriveModal(true);
        break;
      case "Gravity Form":
        setShowGravityFormModal(true);
        break;
      case "NextHealth":
        setShowNexHealthModal(true);
        break;
      default:
        console.log(`Connecting to ${integration.integration_name}`);
    }
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

        {/* All Integration Modals */}

        {/* Facebook Lead Form Modal */}
        <FacebookLeadFormModal
          open={showFacebookLeadModal}
          status={facebookLeadFormStatus}
          onCancel={() => {
            setShowFacebookLeadModal(false);
            setButtonLoading(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowFacebookLeadModal(false);
          }}
          onConnect={async () => {
            setButtonLoading(true);
            window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${await getClinicId()}`;
          }}
          buttonLoading={buttonLoading}
        />

        {/* Jotform Modal */}
        <JotformModal
          buttonLoading={buttonLoading}
          open={showJotformModal}
          status={jotformStatus}
          onCancel={() => {
            setButtonLoading(false);
            setShowJotformModal(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowJotformModal(false);
          }}
          onConnect={async (token: any) => {
            setButtonLoading(true);
            const res = await createJotformConnection(await getClinicId(), token);
            console.log(res);
            if (!res) {
              setButtonLoading(false);
              ErrorToast("Failed to connect to Jotform. Please try again.");
              return;
            }
            SuccessToast("Jotform connected successfully");
            setJotformStatus("connected");
            setButtonLoading(false);
          }}
          treeData={jotformTreeData}
          selectedForms={selectedJotformForms}
          onSelectForms={setSelectedJotformForms}
          onSyncLeads={() => {
            syncJotformLeads(selectedJotformForms);
            setJotformLeadsSynced(true);
            setShowJotformModal(false);
          }}
          onDisconnect={() => {
            setJotformStatus("disconnected");
          }}
        />

        {/* Google Lead Form Modal */}
        <GoogleLeadFormModal
          open={showGoogleLeadFormModal}
          status={googleLeadFormStatus}
          onCancel={() => setShowGoogleLeadFormModal(false)}
          onOk={() => setShowGoogleLeadFormModal(false)}
          onConnect={() => {
            () => connectToGoogleLeadForm(setButtonLoading);
          }}
          accountInfo={googleLeadFormAccountInfo}
          onSyncLeads={syncGoogleLeadFormLeads}
          onDisconnect={() => {
            setGoogleLeadFormStatus("disconnected");
            setGoogleLeadFormAccountInfo(null);
          }}
          buttonLoading={buttonLoading}
        />

        {/* Google Form Modal */}
        <GoogleFormModal
          open={showGoogleFormModal}
          status={googleFormStatus}
          onCancel={() => {
            setShowGoogleFormModal(false);
            setButtonLoading(false);
          }}
          onOk={() => {
            setShowGoogleFormModal(false);
            setButtonLoading(false);
          }}
          onConnect={() => {
            connectToGoogleForm(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          accountInfo={googleFormAccountInfo}
          treeData={googleFormTreeData}
          selectedWorksheets={selectedGoogleFormWorksheets}
          onSelectWorksheets={setSelectedGoogleFormWorksheets}
          onSyncLeads={async () => {
            const selectedSheetsObjects = await selectedGoogleFormWorksheets
              .map(value => findSheetDetails(googleFormTreeData, value))
              .filter(Boolean);
            syncGoogleFormLeads(selectedSheetsObjects);
            setGoogleFormLeadsSynced(true);
            setShowGoogleFormModal(false);
          }}
          onDisconnect={() => {
            setGoogleFormStatus("disconnected");
            setGoogleFormAccountInfo(null);
          }}
        />

        {/* Hubspot Modal */}
        <HubspotModal
          open={showHubspotModal}
          status={hubspotStatus}
          accountInfo={hubspotAccountInfo}
          onCancel={() => {
            setButtonLoading(false)
            setShowHubspotModal(false)
          }}
          onOk={() => {
            setButtonLoading(false)
            setShowHubspotModal(false)
          }}
          onConnect={() => connectToHubSpot(setButtonLoading)}
          buttonLoading={buttonLoading}
        />

        {/* GoHighLevel Modal */}
        <GoHighLevelLeadFormModal
          open={showGoHighLevelModal}
          status={goHighLevelStatus}
          onCancel={() => {
            setButtonLoading(false);
            setShowGoHighLevelModal(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowGoHighLevelModal(false);
          }}
          onConnect={() => {
            connectToGHL(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          accountInfo={null}
        />

        {/* Typeform Modal */}
        <TypeformModal
          open={showTypeformModal}
          status={typeformStatus}
          onCancel={() => {
            setButtonLoading(false);
            setShowTypeformModal(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowTypeformModal(false);
          }}
          onConnect={() => {
            connectToTypeform(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          treeData={TypeformTreeData}
          accountInfo={typeformAccountInfo}
          onSyncLeads={() => {
            syncTypeformLeads(selectedTypeformForms);
            setTypeformLeadsSynced(true);
            setButtonLoading(false);
            setShowTypeformModal(false);
          }}
          onDisconnect={() => {
            setTypeformStatus("disconnected");
            setTypeformAccountInfo(null);
          }}
          selectedForms={selectedTypeformForms}
          onSelectForms={setSelectedTypeformForms}
        />

        {/* Pipedrive Modal */}
        <PipedriveModal
          open={showPipedriveModal}
          status={pipedriveStatus}
          accountInfo={pipedriveAccountInfo}
          onCancel={() => {
            setButtonLoading(false);
            setShowPipedriveModal(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowPipedriveModal(false);
          }}
          onConnect={() => {
            connectToPipedrive(setButtonLoading);
          }}
          onDisconnect={() => {
            setPipedriveStatus("disconnected");
            setPipedriveAccountInfo(null);
          }}
          onSyncLeads={syncPipedriveLeads}
          buttonLoading={buttonLoading}
        />

        {/* Gravity Form Modal */}
        <GravityFormModal
          open={showGravityFormModal}
          status={gravityFormStatus}
          onCancel={() => {
            setButtonLoading(false);
            setShowGravityFormModal(false);
          }}
          onOk={() => setShowGravityFormModal(false)}
          onConnect={(token: any) => connnectToGravityForm(token, setButtonLoading)}
          onDisconnect={() => {
            setGravityFormStatus("disconnected");
          }}
          buttonLoading={buttonLoading}
        />

        {/* NextHealth Modal */}
        <NexHealthLeadFormModal
          open={showNexHealthModal}
          status={nexHealthStatus}
          onCancel={() => {
            setButtonLoading(false);
            setShowNexHealthModal(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            setShowNexHealthModal(false);
          }}
          onConnect={(token: any) => {
            connectToNextHealth(token, setButtonLoading);
          }}
          accountInfo={null}
          buttonLoading={buttonLoading}
        />

        {/* CSV Upload Modal */}
        <CsvUploadModal open={showCsvUploadModal} onCancel={() => setShowCsvUploadModal(false)} onOk={() => setShowCsvUploadModal(false)} />

        {/* Custom CRM Modal */}
        <CustomCrmModal open={showCustomCrmModal} onCancel={() => setShowCustomCrmModal(false)} onOk={() => setShowCustomCrmModal(false)} />

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
              description={selectedIntegration?.description || "Integration is active and ready to sync"}
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