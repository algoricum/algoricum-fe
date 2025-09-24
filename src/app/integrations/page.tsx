"use client";
import { ConnectionStatus } from "@/app/types/types";
import { Header } from "@/components/common";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import {
  CsvUploadModal,
  CustomCrmModal,
  FacebookLeadFormModal,
  GoHighLevelLeadFormModal,
  GoogleFormModal,
  GoogleLeadFormModal,
  GravityFormModal,
  HubspotModal,
  JotformModal,
  NexHealthLeadFormModal,
  PipedriveModal,
  TypeformModal,
} from "@/components/modals/Modals";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  connectToGHL,
  connectToGoogleForm,
  connectToGoogleLeadForm,
  connectToHubSpot,
  connectToNextHealth,
  connectToPipedrive,
  connectToTypeform,
  connnectToGravityForm,
  createJotformConnection,
  fetchJotformForms,
  fetchTypeformForms,
  getClinicId,
  syncGoogleLeadFormLeads,
  syncJotformLeads,
  syncPipedriveLeads,
  syncTypeformLeads,
} from "@/utils/integration-utils";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { getUserData } from "@/utils/supabase/user-helper";
import { Button, Card, Col, Divider, Row } from "antd";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JSX, useEffect, useState } from "react";
import { deleteIntegrationConnections, updateIntegrationConnectionStatus } from "./integrationUtils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Interface for integration data from RPC
interface IntegrationWithStatus {
  id: string;
  name: string;
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

// Integration types for better type safety
type IntegrationName =
  | "Facebook Lead Forms"
  | "Jotform"
  | "Google Lead Forms"
  | "Google Forms"
  | "Hubspot"
  | "GoHighLevel"
  | "Typeform"
  | "Pipedrive"
  | "Gravity Form"
  | "NextHealth"
  | "CSV Upload"
  | "Custom CRM";

// Refactored state management
interface IntegrationStates {
  statuses: Record<IntegrationName, ConnectionStatus>;
  modals: Record<IntegrationName, boolean>;
}

// Icon mapping for different integrations
const getIntegrationIcon = (logo: string): JSX.Element => {
  return <Image src={logo} alt={`${name} logo`} width={24} height={24} className="object-contain" />;
};

export default function IntegrationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [googleFormTreeData, setGoogleFormTreeData] = useState<any[]>([]);
  const [buttonLoading, setButtonLoading] = useState(false);

  // Refactored state management
  const [integrationStates, setIntegrationStates] = useState<IntegrationStates>({
    statuses: {
      "Facebook Lead Forms": "disconnected",
      Jotform: "disconnected",
      "Google Lead Forms": "disconnected",
      "Google Forms": "disconnected",
      Hubspot: "disconnected",
      GoHighLevel: "disconnected",
      Typeform: "disconnected",
      Pipedrive: "disconnected",
      "Gravity Form": "disconnected",
      NextHealth: "disconnected",
      "CSV Upload": "disconnected",
      "Custom CRM": "disconnected",
    },
    modals: {
      "Facebook Lead Forms": false,
      Jotform: false,
      "Google Lead Forms": false,
      "Google Forms": false,
      Hubspot: false,
      GoHighLevel: false,
      Typeform: false,
      Pipedrive: false,
      "Gravity Form": false,
      NextHealth: false,
      "CSV Upload": false,
      "Custom CRM": false,
    },
  });

  // hubspot
  const [hubspotAccountInfo] = useState<any>(null);

  // TypeForm
  const [TypeformTreeData, setTypeFormTreeData] = useState([]);
  const [selectedTypeformForms, setSelectedTypeformForms] = useState<any[]>([]);
  const [, setTypeformLeadsSynced] = useState(false);

  //jotform
  const [jotformTreeData, setJotformTreeData] = useState([]);
  const [selectedJotformForms, setSelectedJotformForms] = useState<any[]>([]);
  const [, setJotformLeadsSynced] = useState(false);

  // Google Form
  const [, setGoogleFormLeadsSynced] = useState(false);

  //  pipedrive
  const [pipedriveAccountInfo, setPipedriveAccountInfo] = useState<any>(null);

  // Helper functions for state management
  const updateIntegrationStatus = (name: IntegrationName, status: ConnectionStatus) => {
    setIntegrationStates(prev => ({
      ...prev,
      statuses: { ...prev.statuses, [name]: status },
    }));
  };

  const toggleModal = (name: IntegrationName, isOpen?: boolean) => {
    setIntegrationStates(prev => ({
      ...prev,
      modals: { ...prev.modals, [name]: isOpen ?? !prev.modals[name] },
    }));
  };

  const getIntegrationStatus = (name: IntegrationName): ConnectionStatus => {
    return integrationStates.statuses[name];
  };

  const isModalOpen = (name: IntegrationName): boolean => {
    return integrationStates.modals[name];
  };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleOAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pipedriveStatus = urlParams.get("pipedrive_status");
      const errorMessage = urlParams.get("error_message");
      const accountName = urlParams.get("account_name");
      const contactCount = urlParams.get("contact_count");
      const dealCount = urlParams.get("deal_count");

      if (pipedriveStatus === "success") {
        const accountInfo = {
          accountName: accountName || "Connected Account",
          contactCount: parseInt(contactCount || "0"),
          dealCount: parseInt(dealCount || "0"),
        };
        updateIntegrationStatus("Pipedrive", "connected");
        setPipedriveAccountInfo(accountInfo);

        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => syncPipedriveLeads(), 1000);
      } else if (pipedriveStatus === "error") {
        console.log("❌ Pipedrive OAuth error detected from URL:", errorMessage);
        updateIntegrationStatus("Pipedrive", "disconnected");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthRedirect();

    if (searchParams.toString()) {
      router.replace(pathname); // strips off all params
    }
  }, [pathname, searchParams, router]);
  useEffect(() => {
    const initializeAllIntegrationStatuses = async () => {
      setLoading(true);
      try {
        const clinicData = await getClinicData();
        if (!clinicData?.id) {
          ErrorToast("Clinic ID is not found.");
          setLoading(false);
          return;
        }

        // 1. Fetch all integrations from master table
        const { data: allIntegrations, error } = await supabase.from("integrations").select("*");

        if (error) {
          console.error("Error fetching integrations:", error);
          ErrorToast("Failed to fetch integrations");
          setLoading(false);
          return;
        }

        // 2. Check connection status for each integration
        const statusChecks = await Promise.allSettled(
          allIntegrations.map(int => updateIntegrationConnectionStatus(clinicData.id, int.name)),
        );

        // 3. Merge statuses with integrations
        const integrationsWithStatus = allIntegrations.map((int, idx) => {
          const check = statusChecks[idx];
          return {
            ...int,
            connected: check.status === "fulfilled" ? check.value === "connected" : false,
          };
        });

        setIntegrations(integrationsWithStatus);

        // 4. Update individual integration states
        const statusUpdates: Partial<Record<IntegrationName, ConnectionStatus>> = {};
        integrationsWithStatus.forEach(integration => {
          const name = integration.name as IntegrationName;
          statusUpdates[name] = integration.connected ? "connected" : "disconnected";
        });

        setIntegrationStates(prev => ({
          ...prev,
          statuses: { ...prev.statuses, ...statusUpdates },
        }));
      } catch (error) {
        console.error("Failed to initialize integration statuses:", error);
        ErrorToast("Failed to initialize integrations");
      } finally {
        setLoading(false);
      }
    };

    initializeAllIntegrationStatuses();
  }, [
    supabase,

    getIntegrationStatus("Facebook Lead Forms"),
    getIntegrationStatus("Jotform"),
    getIntegrationStatus("Google Lead Forms"),
    getIntegrationStatus("Google Forms"),
    getIntegrationStatus("Hubspot"),
    getIntegrationStatus("GoHighLevel"),
    getIntegrationStatus("Typeform"),
    getIntegrationStatus("Pipedrive"),
    getIntegrationStatus("Gravity Form"),
    getIntegrationStatus("NextHealth"),
    getIntegrationStatus("CSV Upload"),
    getIntegrationStatus("Custom CRM"),
  ]);

  const handleIntegrationClick = async (integration: IntegrationWithStatus) => {
    if (!integration.connected) {
      handleConnect(integration);
      return;
    }

    const name = integration.name as IntegrationName;

    if (name === "Google Forms") {
      await fetchGoogleFormData();
      toggleModal(name, true);
    } else if (name === "Gravity Form") {
      updateIntegrationStatus(name, "connecting");
      toggleModal(name, true);
    } else if (name === "Typeform") {
      fetchTypeformForms(setTypeFormTreeData);
      const { data: connection } = await supabase.from("integrations").select("id").eq("name", "Typeform").limit(1).single();

      const { data: typeform } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("clinic_id", await getClinicId())
        .eq("integration_id", connection?.id)
        .single();
      console.warn("typeform", typeform);
      setSelectedTypeformForms(typeform.auth_data?.forms);
      toggleModal(name, true);
    } else if (name === "Jotform") {
      fetchJotformForms(setJotformTreeData);
      const { data: connection } = await supabase.from("integrations").select("id").eq("name", "Jotform").limit(1).single();

      const { data: jotformData } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("clinic_id", await getClinicId())
        .eq("integration_id", connection?.id)
        .single();
      console.warn("jotformData", jotformData);
      setSelectedJotformForms(jotformData.auth_data?.forms.map((form: any) => form.form_id));
      toggleModal(name, true);
    }
  };

  const fetchGoogleFormData = async () => {
    try {
      const clinicData = await getClinicData();
      if (!clinicData?.id) {
        ErrorToast("Clinic ID is not found.");
        setLoading(false);
        return;
      }
      const { data: connection } = await supabase
        .from("google_form_connections")
        .select("id")
        .eq("clinic_id", clinicData.id)
        .limit(1)
        .single();
      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", connection?.id);

      if (savedError) throw savedError;
      console.error(savedSheets);
      const savedSheetKeys = savedSheets.map(s => `${s.spreadsheet_id}:${s.sheet_id}`);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/list-spreadsheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connection_id: connection?.id,
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
    try {
      const { data: connection } = await supabase
        .from("google_form_connections")
        .select("*")
        .eq("clinic_id", await getClinicId())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", connection?.id);

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
              .eq("connection_id", connection?.id)
              .eq("spreadsheet_id", spreadsheet_id)
              .eq("sheet_id", sheet_id);
          }),
        );
      }

      if (newSheets.length === 0) {
        SuccessToast("Sheets are already synced!");
        toggleModal("Google Forms", false);
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
          connection_id: connection?.id,
          selected_sheets: newSheetsPayload,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      SuccessToast(`Successfully synced ${result.sync_result.leads_created} leads from Google Lead Form!`);
      toggleModal("Google Forms", false);
    } catch (error) {
      console.error("Failed to sync leads:", error);
      ErrorToast("Failed to sync leads");
    }
  };

  const handleConnect = (integration: IntegrationWithStatus) => {
    const name = integration.name as IntegrationName;
    toggleModal(name, true);
  };

  const connectedIntegrations = integrations.filter(i => i.connected);
  const availableIntegrations = integrations.filter(i => !i.connected);
  console.log("connectedIntegrations", connectedIntegrations);
  console.log("available ");
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
                    <Col xs={24} sm={12} lg={8} key={integration.id}>
                      <Card className="bg-gray-50 hover:bg-gray-100  transition border border-green-200 rounded-lg h-full">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            {getIntegrationIcon(integration.integration_logo)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                            <p className="text-gray-500 text-sm">{integration.description || "No description available"}</p>
                          </div>
                          <Button
                            type="primary"
                            size="small"
                            className={` ${["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name)) ? "bg-[#10B981] text-white hover:bg-green-600" : "gray text-white bg-red-500 hover:bg-red-700 hover:text-gray-900"}`}
                            onClick={async () => {
                              if (["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name))) {
                                handleIntegrationClick(integration);
                              } else {
                                if (integration.name != "Hubspot") {
                                  const clinicId = await getClinicId();
                                  deleteIntegrationConnections(clinicId, integration.name);
                                } else {
                                  const user = await getUserData();
                                  deleteIntegrationConnections(user?.id || "", integration.name);
                                }
                                const currentStatus = getIntegrationStatus(integration.name as IntegrationName);
                                updateIntegrationStatus(
                                  integration.name as IntegrationName,
                                  currentStatus === "connected" ? "disconnected" : "connected",
                                );
                              }
                            }}
                          >
                            {!["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name))
                              ? "Disconnect"
                              : " Edit "}
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
                    <Col xs={24} sm={12} lg={8} key={integration.id}>
                      <Card
                        className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-lg h-full cursor-pointer"
                        onClick={() => handleIntegrationClick(integration)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            {getIntegrationIcon(integration.integration_logo)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
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
          open={isModalOpen("Facebook Lead Forms")}
          status={getIntegrationStatus("Facebook Lead Forms")}
          onCancel={() => {
            toggleModal("Facebook Lead Forms", false);
            setButtonLoading(false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Facebook Lead Forms", false);
          }}
          onConnect={async () => {
            setButtonLoading(true);
            window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${await getClinicId()}&redirect_to=${window.location.href}`;
          }}
          buttonLoading={buttonLoading}
        />

        {/* Jotform Modal */}
        <JotformModal
          buttonLoading={buttonLoading}
          open={isModalOpen("Jotform")}
          status={getIntegrationStatus("Jotform")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Jotform", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Jotform", false);
          }}
          onConnect={async (token: any) => {
            setButtonLoading(true);
            const res = await createJotformConnection(await getClinicId(), token);
            if (!res) {
              setButtonLoading(false);
              toggleModal("Jotform", false);
              toggleModal("Jotform", true);

              ErrorToast("Failed to connect to Jotform. Please try again.");
              return;
            }
            fetchJotformForms(setJotformTreeData);

            SuccessToast("Jotform connected successfully");
            updateIntegrationStatus("Jotform", "connected");
            setButtonLoading(false);
          }}
          treeData={jotformTreeData}
          selectedForms={selectedJotformForms}
          onSelectForms={setSelectedJotformForms}
          onSyncLeads={() => {
            syncJotformLeads(selectedJotformForms);
            setJotformLeadsSynced(true);
            toggleModal("Jotform", false);
          }}
          onDisconnect={async () => {
            deleteIntegrationConnections(await getClinicId(), "Jotform");
            toggleModal("Jotform", false);
            updateIntegrationStatus("Jotform", "disconnected");
          }}
        />

        {/* Google Lead Form Modal */}
        <GoogleLeadFormModal
          open={isModalOpen("Google Lead Forms")}
          status={getIntegrationStatus("Google Lead Forms")}
          onCancel={() => toggleModal("Google Lead Forms", false)}
          onOk={() => toggleModal("Google Lead Forms", false)}
          onConnect={() => connectToGoogleLeadForm(setButtonLoading)}
          accountInfo={{ accountName: "your GoogleLeadForm account successfully" }}
          onSyncLeads={syncGoogleLeadFormLeads}
          onDisconnect={async () => {
            deleteIntegrationConnections(await getClinicId(), "Google Lead Forms");
            toggleModal("Google Lead Forms", false);
            updateIntegrationStatus("Google Lead Forms", "disconnected");
          }}
          buttonLoading={buttonLoading}
        />

        {/* Google Form Modal */}
        <GoogleFormModal
          open={isModalOpen("Google Forms")}
          status={getIntegrationStatus("Google Forms")}
          onCancel={() => {
            toggleModal("Google Forms", false);
            setButtonLoading(false);
          }}
          onOk={() => {
            toggleModal("Google Forms", false);
            setButtonLoading(false);
          }}
          onConnect={() => {
            connectToGoogleForm(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          accountInfo={{ accountName: "your GoogleForm account successfully" }}
          treeData={googleFormTreeData}
          selectedWorksheets={selectedSheets}
          onSelectWorksheets={setSelectedSheets}
          onSyncLeads={async () => {
            // const selectedSheetsObjects = await selectedSheets.map(value => findSheetDetails(googleFormTreeData, value)).filter(Boolean);
            syncGoogleFormLeads();
            setGoogleFormLeadsSynced(true);
            toggleModal("Google Forms", false);
          }}
          onDisconnect={async () => {
            deleteIntegrationConnections(await getClinicId(), "Google Forms");
            toggleModal("Google Forms", false);
            updateIntegrationStatus("Google Forms", "disconnected");
          }}
        />

        {/* Hubspot Modal */}
        <HubspotModal
          open={isModalOpen("Hubspot")}
          status={getIntegrationStatus("Hubspot")}
          accountInfo={hubspotAccountInfo}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Hubspot", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Hubspot", false);
          }}
          onConnect={() => connectToHubSpot(setButtonLoading)}
          buttonLoading={buttonLoading}
        />

        {/* GoHighLevel Modal */}
        <GoHighLevelLeadFormModal
          open={isModalOpen("GoHighLevel")}
          status={getIntegrationStatus("GoHighLevel")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("GoHighLevel", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("GoHighLevel", false);
          }}
          onConnect={() => {
            connectToGHL(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          accountInfo={{ accountName: "your GoHighLevelForm account successfully" }}
        />

        {/* Typeform Modal */}
        <TypeformModal
          open={isModalOpen("Typeform")}
          status={getIntegrationStatus("Typeform")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Typeform", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Typeform", false);
          }}
          onConnect={() => {
            connectToTypeform(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          treeData={TypeformTreeData}
          accountInfo={{ accountName: "your typeform account successfully" }}
          onSyncLeads={() => {
            syncTypeformLeads(selectedTypeformForms);
            setTypeformLeadsSynced(true);
            setButtonLoading(false);
            toggleModal("Typeform", false);
          }}
          onDisconnect={async () => {
            deleteIntegrationConnections(await getClinicId(), "Typeform");
            toggleModal("Typeform", false);
            updateIntegrationStatus("Typeform", "disconnected");
          }}
          selectedForms={selectedTypeformForms}
          onSelectForms={setSelectedTypeformForms}
        />

        {/* Pipedrive Modal */}
        <PipedriveModal
          open={isModalOpen("Pipedrive")}
          status={getIntegrationStatus("Pipedrive")}
          accountInfo={pipedriveAccountInfo}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Pipedrive", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Pipedrive", false);
          }}
          onConnect={() => connectToPipedrive(setButtonLoading)}
          onSyncLeads={syncPipedriveLeads}
          onDisconnect={() => {
            updateIntegrationStatus("Pipedrive", "disconnected");
            setPipedriveAccountInfo(null);
          }}
          buttonLoading={buttonLoading}
        />

        {/* Gravity Form Modal */}
        <GravityFormModal
          open={isModalOpen("Gravity Form")}
          status={getIntegrationStatus("Gravity Form")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Gravity Form", false);
          }}
          onOk={() => toggleModal("Gravity Form", false)}
          onConnect={(token: any) => connnectToGravityForm(token, setButtonLoading)}
          onDisconnect={() => {
            updateIntegrationStatus("Gravity Form", "disconnected");
          }}
          buttonLoading={buttonLoading}
        />

        {/* NextHealth Modal */}
        <NexHealthLeadFormModal
          open={isModalOpen("NextHealth")}
          status={getIntegrationStatus("NextHealth")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("NextHealth", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("NextHealth", false);
          }}
          onConnect={(token: any) => {
            connectToNextHealth(token, setButtonLoading);
          }}
          accountInfo={{ accountName: "your NexHealthLeadForm account successfully" }}
          buttonLoading={buttonLoading}
        />

        {/* CSV Upload Modal */}
        <CsvUploadModal
          open={isModalOpen("CSV Upload")}
          onCancel={() => toggleModal("CSV Upload", false)}
          onOk={() => toggleModal("CSV Upload", false)}
        />

        {/* Custom CRM Modal */}
        <CustomCrmModal
          open={isModalOpen("Custom CRM")}
          onCancel={() => {
            setButtonLoading(false);
            toggleModal("Custom CRM", false);
          }}
          onOk={() => {
            setButtonLoading(false);
            toggleModal("Custom CRM", false);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
