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
import { useCurrentUserClinic } from "@/hooks/useBilling";
import { useIntegrationsWithStatus } from "@/hooks/useDashboard";
import DashboardLayout from "@/layouts/DashboardLayout";
import { IntegrationName, IntegrationStates, IntegrationWithStatus } from "@/types/integrations";
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
  getIntegrationConnection,
  syncGoogleLeadFormLeads,
  syncJotformLeads,
  syncPipedriveLeads,
  syncTypeformLeads,
} from "@/utils/integration-utils";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Button, Card, Col, Divider, Row } from "antd";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JSX, useEffect, useMemo, useState } from "react";
import {
  callSupabaseFunction,
  createOAuthCallbackHandler,
  deleteIntegrationConnections,
  updateIntegrationConnectionStatus,
} from "./integrationUtils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Icon mapping for different integrations
const getIntegrationIcon = (logo: string): JSX.Element => {
  return (
    <Image
      src={logo}
      alt="Integration service logo"
      width={24}
      height={24}
      className="object-contain"
      loading="lazy" // These load when user scrolls to integrations
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Cp9Xw=="
    />
  );
};

export default function IntegrationsContent() {
  const supabase = createClient();
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [googleFormTreeData, setGoogleFormTreeData] = useState<any[]>([]);
  const [buttonLoading, setButtonLoading] = useState(false);
  // React Query hooks
  const { data: clinicData, isLoading: clinicLoading } = useCurrentUserClinic();
  const clinicId = typeof clinicData === "string" ? clinicData : clinicData?.id || "";
  const { data: integrationsData, isLoading: integrationsLoading } = useIntegrationsWithStatus(clinicId);

  // Extract integrations and initial statuses from React Query data
  const integrations = integrationsData?.integrations || [];
  const initialStatuses = integrationsData?.statuses || {};

  // Memoized integration states using React Query data
  const [integrationStates, setIntegrationStates] = useState<IntegrationStates>(() => ({
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
  }));

  // Update integration statuses when React Query data changes
  useEffect(() => {
    if (initialStatuses && Object.keys(initialStatuses).length > 0) {
      setIntegrationStates(prev => ({
        ...prev,
        statuses: { ...prev.statuses, ...initialStatuses },
      }));
    }
  }, [initialStatuses]);

  // TypeForm
  const [TypeformTreeData, setTypeFormTreeData] = useState([]);
  const [selectedTypeformForms, setSelectedTypeformForms] = useState<any[]>([]);

  //jotform
  const [jotformTreeData, setJotformTreeData] = useState([]);
  const [selectedJotformForms, setSelectedJotformForms] = useState<any[]>([]);

  // Google Form

  //  pipedrive
  const [pipedriveAccountInfo, setPipedriveAccountInfo] = useState<any>(null);

  // Google Lead Forms
  const [googleLeadFormData, setGoogleLeadFormData] = useState<{
    accountInfo: any;
    availableForms: any[];
    connectionId: string;
    availableCustomerIds: string[];
  }>({
    accountInfo: null,
    availableForms: [],
    connectionId: "",
    availableCustomerIds: [],
  });

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

  // Utility functions for modal handlers
  const handleModalClose = (name: IntegrationName) => {
    setButtonLoading(false);
    toggleModal(name, false);
  };

  const handleModalOk = (name: IntegrationName) => {
    setButtonLoading(false);
    toggleModal(name, false);
  };

  // Utility function for disconnect handlers
  const handleDisconnect = async (
    name: IntegrationName,
    options?: {
      closeModal?: boolean;
      clearData?: () => void;
      skipConnectionDeletion?: boolean;
    },
  ) => {
    try {
      if (!options?.skipConnectionDeletion) {
        deleteIntegrationConnections(clinicId, name);
      }

      updateIntegrationStatus(name, "disconnected");

      // Close modal if requested
      if (options?.closeModal) {
        toggleModal(name, false);
      }

      // Clear specific data if provided
      if (options?.clearData) {
        options.clearData();
      }
    } catch (error) {
      console.error(`Error disconnecting ${name}:`, error);
    }
  };

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleOAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const errorMessage = urlParams.get("error_message");

      // Create OAuth callback handlers
      const handleHubSpotCallback = createOAuthCallbackHandler(
        "Hubspot",
        "hubspot_status",
        updateIntegrationStatus,
        SuccessToast,
        ErrorToast,
      );

      const handleGoogleFormsCallback = createOAuthCallbackHandler(
        "Google Forms",
        "google_form_status",
        updateIntegrationStatus,
        SuccessToast,
        ErrorToast,
      );

      // Handle Pipedrive OAuth callback (custom logic for account info)
      const pipedriveStatus = urlParams.get("pipedrive_status");
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

      // Handle other OAuth callbacks
      handleHubSpotCallback(urlParams, contactCount || undefined, errorMessage || undefined);
      handleGoogleFormsCallback(urlParams, urlParams.get("contact_count") || undefined, errorMessage || undefined);
    };

    handleOAuthRedirect();

    if (searchParams.toString()) {
      router.replace(pathname); // strips off all params
    }
  }, [pathname, searchParams, router]);

  // Handle Facebook OAuth callback
  useEffect(() => {
    const handleFacebookCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const facebookStatus = urlParams.get("facebook_lead_form_status");

      if (facebookStatus === "success" && clinicId) {
        // Actually check the database status
        const realStatus = await updateIntegrationConnectionStatus(clinicId, "Facebook Lead Forms");

        // Update the UI status (this will move it to connected section)
        updateIntegrationStatus("Facebook Lead Forms", realStatus);

        // Wait a moment for state to update, then open the modal
        setTimeout(() => {
          toggleModal("Facebook Lead Forms", true);
        }, 100);

        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete("facebook_lead_form_status");
        window.history.replaceState({}, "", url.toString());
      }
    };

    if (clinicId) {
      handleFacebookCallback();
    }
  }, [clinicId]);

  // Handle Google Lead Forms OAuth callback
  useEffect(() => {
    const handleGoogleLeadFormCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const googleLeadFormStatus = urlParams.get("google_lead_form_status");

      if (googleLeadFormStatus === "success" && clinicId) {
        // Actually check the database status
        const realStatus = await updateIntegrationConnectionStatus(clinicId, "Google Lead Forms");

        // Update the UI status (this will move it to connected section)
        updateIntegrationStatus("Google Lead Forms", realStatus);

        // Wait a moment for state to update, then open the modal
        setTimeout(() => {
          toggleModal("Google Lead Forms", true);
        }, 500);

        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete("google_lead_form_status");
        window.history.replaceState({}, "", url.toString());
      }
    };

    if (clinicId) {
      handleGoogleLeadFormCallback();
    }
  }, [clinicId]);

  // Fetch Typeform data when modal opens
  useEffect(() => {
    const fetchTypeformData = async () => {
      if (isModalOpen("Typeform") && getIntegrationStatus("Typeform") === "connected") {
        try {
          fetchTypeformForms(setTypeFormTreeData);
          const { data: typeform } = await getIntegrationConnection(clinicId, "Typeform");
          console.warn("typeform", typeform);
          setSelectedTypeformForms(typeform.auth_data?.forms);
        } catch (error) {
          console.error("Error fetching Typeform data:", error);
        }
      }
    };

    fetchTypeformData();
  }, [isModalOpen("Typeform"), clinicId]);

  // Fetch Jotform data when modal opens
  useEffect(() => {
    const fetchJotformData = async () => {
      if (isModalOpen("Jotform") && getIntegrationStatus("Jotform") === "connected") {
        try {
          fetchJotformForms(setJotformTreeData);
          const { data: jotformData } = await getIntegrationConnection(clinicId, "Jotform");
          setSelectedJotformForms(jotformData.auth_data?.forms.map((form: any) => form.form_id));
        } catch (error) {
          console.error("Error fetching Jotform data:", error);
        }
      }
    };

    fetchJotformData();
  }, [isModalOpen("Jotform"), clinicId]);

  // Fetch Google Lead Forms data when modal opens
  useEffect(() => {
    const fetchGoogleLeadFormData = async () => {
      const currentStatus = getIntegrationStatus("Google Lead Forms");

      // Don't re-fetch if we're already in a selection state - let user complete their selection
      if (currentStatus === "selecting_customer") {
        return;
      }

      if (isModalOpen("Google Lead Forms") && currentStatus !== "disconnected") {
        try {
          const { data: googleLeadFormConnection, error: connectionError } = await getIntegrationConnection(clinicId, "Google Lead Forms");
          if (connectionError) throw connectionError;
          if (googleLeadFormConnection) {
            // Determine the appropriate status based on auth_data
            let modalStatus: ConnectionStatus = "connected";

            // Priority order: customer setup > form selection > connected (with customer dropdown)
            if (
              googleLeadFormConnection.auth_data?.needs_customer_id_setup &&
              !googleLeadFormConnection.auth_data?.accessible_customer_ids?.length
            ) {
              // Only show manual input if we don't have any accessible customer IDs
              modalStatus = "needs_customer_id";
            } else {
              // Always show connected status - form selection is handled within the connected modal
              modalStatus = "connected";
            }

            // Only update status if it's different from current status to prevent loops
            const currentStatus = getIntegrationStatus("Google Lead Forms");
            if (currentStatus !== modalStatus) {
              updateIntegrationStatus("Google Lead Forms", modalStatus);
            } else {
              console.log("Status unchanged, staying at:", currentStatus);
            }

            setGoogleLeadFormData({
              accountInfo: {
                accountName: googleLeadFormConnection.auth_data?.account_name || "Google Ads",
                selectedFormsCount: googleLeadFormConnection.auth_data?.selected_forms?.length || 0,
              },
              availableForms: googleLeadFormConnection.auth_data?.available_forms || [],
              connectionId: googleLeadFormConnection.id,
              availableCustomerIds: googleLeadFormConnection.auth_data?.accessible_customer_ids || [],
            });
          }
        } catch (error) {
          console.error("Error fetching Google Lead Form data:", error);
        }
      }
    };

    fetchGoogleLeadFormData();
  }, [isModalOpen("Google Lead Forms"), clinicId]);

  // Fetch Google Forms data when modal opens
  useEffect(() => {
    if (isModalOpen("Google Forms") && getIntegrationStatus("Google Forms") === "connected") {
      fetchGoogleFormData();
    }
  }, [isModalOpen("Google Forms"), clinicId]);

  // Combined loading state
  const loading = clinicLoading || integrationsLoading;

  // Memoized filtered integrations
  const { connectedIntegrations, availableIntegrations } = useMemo(() => {
    const connected = integrations.filter(i => i.connected);
    const available = integrations.filter(i => !i.connected);
    return { connectedIntegrations: connected, availableIntegrations: available };
  }, [integrations]);

  const handleIntegrationClick = async (integration: IntegrationWithStatus) => {
    if (!integration.connected) {
      handleConnect(integration);
      return;
    }

    const name = integration.name as IntegrationName;

    if (name === "Google Forms") {
      toggleModal(name, true);
    } else if (name === "Gravity Form") {
      toggleModal(name, true);
    } else if (name === "Typeform") {
      toggleModal(name, true);
    } else if (name === "Jotform") {
      toggleModal(name, true);
    }
  };

  const fetchGoogleFormData = async () => {
    try {
      const clinicData = await getClinicData();
      if (!clinicData?.id) {
        ErrorToast("Clinic ID is not found.");
        return;
      }

      // Get Google Forms integration connection
      const { data: integrationConnection } = await getIntegrationConnection(clinicData.id, "Google Forms");

      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", integrationConnection?.id);

      if (savedError) throw savedError;
      console.error(savedSheets);
      const savedSheetKeys = savedSheets.map(s => `${s.spreadsheet_id}:${s.sheet_id}`);

      const { spreadsheets } = await callSupabaseFunction(
        "google-form-integration/list-spreadsheets",
        { connection_id: integrationConnection?.id },
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      );

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
      // Get Google Forms integration connection
      const { data: integrationConnection } = await getIntegrationConnection(clinicId, "Google Forms");

      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", integrationConnection?.id);

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
              .eq("connection_id", integrationConnection?.id)
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

      const result = await callSupabaseFunction(
        "google-form-integration/save-selected-sheets",
        {
          connection_id: integrationConnection?.id,
          selected_sheets: newSheetsPayload,
        },
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      );
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

                          {/* Special handling for Facebook Lead Forms and Google Lead Forms */}
                          {integration.name === "Facebook Lead Forms" ? (
                            <Button
                              type="primary"
                              size="small"
                              className="!bg-[#3D5DCF] !border-[#3D5DCF] hover:!bg-blue-800"
                              onClick={() => {
                                toggleModal("Facebook Lead Forms", true);
                              }}
                            >
                              Manage Forms
                            </Button>
                          ) : integration.name === "Google Lead Forms" ? (
                            <Button
                              type="primary"
                              size="small"
                              className="!bg-[#4285F4] !border-[#4285F4] hover:!bg-blue-600"
                              onClick={() => {
                                toggleModal("Google Lead Forms", true);
                              }}
                            >
                              Manage Forms
                            </Button>
                          ) : (
                            <Button
                              type="primary"
                              size="small"
                              className={` ${["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name)) ? "bg-[#10B981] text-white hover:bg-green-600" : "gray text-white bg-red-500 hover:bg-red-700 hover:text-gray-900"}`}
                              onClick={async () => {
                                if (["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name))) {
                                  handleIntegrationClick(integration);
                                } else {
                                  handleDisconnect(integration.name as IntegrationName);
                                }
                              }}
                            >
                              {!["Jotform", "Google Forms", "Typeform", "Gravity Form"].some(name => integration.name.includes(name))
                                ? "Disconnect"
                                : " Edit "}
                            </Button>
                          )}
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
          clinicId={clinicId}
          onCancel={() => handleModalClose("Facebook Lead Forms")}
          onOk={() => {
            handleModalOk("Facebook Lead Forms");
            // Refresh the integration status after form selection
            updateIntegrationConnectionStatus(clinicId, "Facebook Lead Forms").then(status => {
              updateIntegrationStatus("Facebook Lead Forms", status);
            });
          }}
          onConnect={async () => {
            setButtonLoading(true);
            window.location.href = `${SUPABASE_URL}/functions/v1/facebook-lead-form/auth/start?clinic_id=${clinicId}&redirect_to=${window.location.href}`;
          }}
          onDisconnect={() => handleDisconnect("Facebook Lead Forms")}
          buttonLoading={buttonLoading}
        />

        {/* Jotform Modal */}
        <JotformModal
          buttonLoading={buttonLoading}
          open={isModalOpen("Jotform")}
          status={getIntegrationStatus("Jotform")}
          onCancel={() => handleModalClose("Jotform")}
          onOk={() => handleModalOk("Jotform")}
          onConnect={async (token: any) => {
            setButtonLoading(true);
            const res = await createJotformConnection(clinicId, token);
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
            toggleModal("Jotform", false);
          }}
          onDisconnect={() => handleDisconnect("Jotform", { closeModal: true })}
        />

        {/* Google Lead Form Modal */}
        <GoogleLeadFormModal
          open={isModalOpen("Google Lead Forms")}
          status={(() => {
            const status = getIntegrationStatus("Google Lead Forms");
            return status;
          })()}
          accountInfo={googleLeadFormData.accountInfo}
          availableLeadForms={googleLeadFormData.availableForms}
          availableCustomerIds={googleLeadFormData.availableCustomerIds}
          connectionId={googleLeadFormData.connectionId}
          onCancel={() => handleModalClose("Google Lead Forms")}
          onOk={() => handleModalOk("Google Lead Forms")}
          onConnect={async () => {
            connectToGoogleLeadForm(setButtonLoading);
          }}
          onSetCustomerId={async (customerId: string) => {
            setButtonLoading(true);
            try {
              await callSupabaseFunction(
                "google-leads/set-customer-id",
                {
                  connection_id: googleLeadFormData.connectionId,
                  google_customer_id: customerId,
                },
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
              );

              // Refresh the modal data
              const realStatus = await updateIntegrationConnectionStatus(clinicId, "Google Lead Forms");
              updateIntegrationStatus("Google Lead Forms", realStatus);
            } catch (error) {
              console.error("Error setting customer ID:", error);
              ErrorToast("Failed to set customer ID");
            } finally {
              setButtonLoading(false);
            }
          }}
          onSelectCustomerId={async (selectedCustomerId: string) => {
            setButtonLoading(true);
            try {
              await callSupabaseFunction(
                "google-leads/select-customer",
                {
                  connection_id: googleLeadFormData.connectionId,
                  selected_customer_id: selectedCustomerId,
                },
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
              );
              await callSupabaseFunction(
                "google-leads/fetch-lead-forms",
                {
                  connection_id: googleLeadFormData.connectionId,
                },
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
              );

              // Refresh the modal data to show the next step
              const realStatus = await updateIntegrationConnectionStatus(clinicId, "Google Lead Forms");
              updateIntegrationStatus("Google Lead Forms", realStatus);

              // Also refresh the google lead form data
              const { data: googleLeadFormConnection } = await getIntegrationConnection(clinicId, "Google Lead Forms");

              if (googleLeadFormConnection) {
                setGoogleLeadFormData({
                  accountInfo: {
                    accountName: googleLeadFormConnection.auth_data?.account_name || "Google Ads",
                    selectedFormsCount: googleLeadFormConnection.auth_data?.selected_forms?.length || 0,
                  },
                  availableForms: googleLeadFormConnection.auth_data?.available_forms || [],
                  connectionId: googleLeadFormConnection.id,
                  availableCustomerIds: googleLeadFormConnection.auth_data?.accessible_customer_ids || [],
                });
              }
            } catch (error) {
              console.error("Error selecting customer:", error);
              ErrorToast("Failed to select customer");
            } finally {
              setButtonLoading(false);
            }
          }}
          onSaveSelectedForms={async (selectedForms: any[]) => {
            setButtonLoading(true);
            try {
              await callSupabaseFunction(
                "google-leads/save-selected-forms",
                {
                  connection_id: googleLeadFormData.connectionId,
                  selected_forms: selectedForms,
                },
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
              );

              // Refresh the modal data but keep modal open
              const realStatus = await updateIntegrationConnectionStatus(clinicId, "Google Lead Forms");
              updateIntegrationStatus("Google Lead Forms", realStatus);
              SuccessToast(`Successfully configured ${selectedForms.length} lead forms!`);
            } catch (error) {
              console.error("Error saving forms:", error);
              ErrorToast("Failed to save selected forms");
            } finally {
              setButtonLoading(false);
            }
          }}
          onSyncLeads={syncGoogleLeadFormLeads}
          onDisconnect={() =>
            handleDisconnect("Google Lead Forms", {
              closeModal: true,
              clearData: () =>
                setGoogleLeadFormData({
                  accountInfo: null,
                  availableForms: [],
                  connectionId: "",
                  availableCustomerIds: [],
                }),
            })
          }
          buttonLoading={buttonLoading}
          clinic_id={clinicId}
        />

        {/* Google Form Modal */}
        <GoogleFormModal
          open={isModalOpen("Google Forms")}
          status={getIntegrationStatus("Google Forms")}
          onCancel={() => handleModalClose("Google Forms")}
          onOk={() => handleModalOk("Google Forms")}
          onConnect={() => {
            connectToGoogleForm(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          accountInfo={{ accountName: "your GoogleForm account successfully" }}
          treeData={googleFormTreeData}
          selectedWorksheets={selectedSheets}
          onSelectWorksheets={setSelectedSheets}
          onSyncLeads={async () => {
            syncGoogleFormLeads();
            toggleModal("Google Forms", false);
          }}
          onDisconnect={() => handleDisconnect("Google Forms", { closeModal: true })}
        />

        {/* Hubspot Modal */}
        <HubspotModal
          open={isModalOpen("Hubspot")}
          status={getIntegrationStatus("Hubspot")}
          accountInfo={null}
          onCancel={() => handleModalClose("Hubspot")}
          onOk={() => handleModalOk("Hubspot")}
          onConnect={() => connectToHubSpot(setButtonLoading)}
          buttonLoading={buttonLoading}
        />

        {/* GoHighLevel Modal */}
        <GoHighLevelLeadFormModal
          open={isModalOpen("GoHighLevel")}
          status={getIntegrationStatus("GoHighLevel")}
          onCancel={() => handleModalClose("GoHighLevel")}
          onOk={() => handleModalOk("GoHighLevel")}
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
          onCancel={() => handleModalClose("Typeform")}
          onOk={() => handleModalOk("Typeform")}
          onConnect={() => {
            connectToTypeform(setButtonLoading);
          }}
          buttonLoading={buttonLoading}
          treeData={TypeformTreeData}
          accountInfo={{ accountName: "your typeform account successfully" }}
          onSyncLeads={() => {
            syncTypeformLeads(selectedTypeformForms);
            setButtonLoading(false);
            toggleModal("Typeform", false);
          }}
          onDisconnect={() => handleDisconnect("Typeform", { closeModal: true })}
          selectedForms={selectedTypeformForms}
          onSelectForms={setSelectedTypeformForms}
        />

        {/* Pipedrive Modal */}
        <PipedriveModal
          open={isModalOpen("Pipedrive")}
          status={getIntegrationStatus("Pipedrive")}
          accountInfo={pipedriveAccountInfo}
          onCancel={() => handleModalClose("Pipedrive")}
          onOk={() => handleModalOk("Pipedrive")}
          onConnect={() => connectToPipedrive(setButtonLoading)}
          onSyncLeads={syncPipedriveLeads}
          onDisconnect={() =>
            handleDisconnect("Pipedrive", {
              skipConnectionDeletion: true,
              clearData: () => setPipedriveAccountInfo(null),
            })
          }
          buttonLoading={buttonLoading}
        />

        {/* Gravity Form Modal */}
        <GravityFormModal
          open={isModalOpen("Gravity Form")}
          status={getIntegrationStatus("Gravity Form")}
          onCancel={() => handleModalClose("Gravity Form")}
          onOk={() => handleModalOk("Gravity Form")}
          onConnect={(token: any) => connnectToGravityForm(token, setButtonLoading)}
          onDisconnect={() => handleDisconnect("Gravity Form", { skipConnectionDeletion: true })}
          buttonLoading={buttonLoading}
        />

        {/* NextHealth Modal */}
        <NexHealthLeadFormModal
          open={isModalOpen("NextHealth")}
          status={getIntegrationStatus("NextHealth")}
          onCancel={() => handleModalClose("NextHealth")}
          onOk={() => handleModalOk("NextHealth")}
          onConnect={(token: any) => {
            connectToNextHealth(token, setButtonLoading);
          }}
          accountInfo={{ accountName: "your NexHealthLeadForm account successfully" }}
          buttonLoading={buttonLoading}
        />

        {/* CSV Upload Modal */}
        <CsvUploadModal
          open={isModalOpen("CSV Upload")}
          onCancel={() => handleModalClose("CSV Upload")}
          onOk={() => handleModalOk("CSV Upload")}
        />

        {/* Custom CRM Modal */}
        <CustomCrmModal
          open={isModalOpen("Custom CRM")}
          onCancel={() => handleModalClose("Custom CRM")}
          onOk={() => handleModalOk("Custom CRM")}
        />
      </div>
    </DashboardLayout>
  );
}
