import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { getUserData } from "@/utils/supabase/user-helper";
import { toast } from "react-toastify";
import { ONBOARDING_LEADS_FILE_NAME, SUPABASE_ANON_KEY, SUPABASE_URL } from "../constants/integration-constants";

export const ErrorToast = (message: string) => toast.error(message);
export const SuccessToast = (message: string) => toast.success(message);
export const InfoToast = (message: string) => toast.info(message);

export const getClinicId = async () => {
  const clinic = await getClinicData();
  return clinic?.id || "";
};

export const getIntegrationIdByName = async (integrationName: string) => {
  const supabase = createClient();
  const { data: connection, error } = await supabase.from("integrations").select("id").eq("name", integrationName).limit(1).single();

  if (error) {
    console.error(`Error fetching integration ID for ${integrationName}:`, error);
    return null;
  }

  return connection?.id || null;
};

export const getIntegrationConnection = async (clinicId: string, integrationName: string) => {
  const supabase = createClient();

  // Get the integration ID first
  const integrationId = await getIntegrationIdByName(integrationName);
  if (!integrationId) {
    return { data: null, error: new Error(`Integration ${integrationName} not found`) };
  }

  // Get the integration connection
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("integration_id", integrationId)
    .single();

  if (error) {
    console.error(`Error fetching integration connection for ${integrationName}:`, error);
  }

  return { data, error };
};

export const handleCsvUpload = async (leads: any) => {
  if (leads) {
    localStorage.setItem(ONBOARDING_LEADS_FILE_NAME, JSON.stringify(leads));
  }
};

export const syncPipedriveLeads = async () => {
  try {
    const clinicId = await getClinicId();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive/sync-leads`, {
      method: "POST",
      // headers: {
      //   "Content-Type": "application/json",
      //   Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      //   apikey: SUPABASE_ANON_KEY,
      // },
      body: JSON.stringify({ clinic_id: clinicId }),
    });

    if (!response.ok) throw new Error("Failed to sync Pipedrive leads");
    SuccessToast("Pipedrive leads sync in progress");
  } catch (error) {
    ErrorToast("Failed to sync Pipedrive leads");
    console.error(error);
  }
};

export const syncGoogleFormLeads = async (worksheets: any) => {
  try {
    const clinicId = await getClinicId();
    const { data: connection } = await createClient()
      .from("google_form_connections")
      .select("id")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/save-selected-sheets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        connection_id: connection?.id,
        selected_sheets: worksheets,
      }),
    });
    console.log("response");
    if (!response.ok) throw new Error("Failed to sync Google Form leads");
    SuccessToast("Google Form leads sync in progress");
    return true;
  } catch (error) {
    ErrorToast("Failed to sync Google Form leads");
    console.error(error);
    return false;
  }
};

export const syncGoogleLeadFormLeads = async () => {
  try {
    const clinicId = await getClinicId();

    // First check if forms are selected
    const { data: connection } = await getIntegrationConnection(clinicId, "Google Lead Forms");
    if (!connection) {
      ErrorToast("Google Lead Forms integration not found. Please connect first.");
      return;
    }

    if (!connection.auth_data?.selected_forms || connection.auth_data.selected_forms.length === 0) {
      ErrorToast("No forms selected for sync. Please open Google Lead Forms settings and select forms first.");
      return;
    }

    // Try the sync endpoint
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-leads/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ clinic_id: clinicId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error("Google Lead Forms sync endpoint not available. Please contact support.");
      } else if (response.status === 400 && errorData.error?.includes("No forms selected")) {
        throw new Error("No forms selected for sync. Please open Google Lead Forms settings and select forms first.");
      }
      throw new Error(`Failed to sync Google Lead Form leads: ${errorData.error || response.statusText}`);
    }

    SuccessToast("Google Lead Form leads sync in progress");
  } catch (error: any) {
    if (error?.message?.includes("not available")) {
      ErrorToast("Google Lead Forms sync not available yet. Please contact support.");
    } else if (error?.message?.includes("No forms selected")) {
      ErrorToast(error.message);
    } else {
      ErrorToast("Failed to sync Google Lead Form leads");
    }
    console.error(error);
  }
};

export const syncTypeformLeads = async (forms: string[]) => {
  console.log("Syncing Typeform leads for forms:", forms);
  if (!forms || forms.length === 0) {
    ErrorToast("No Typeform forms selected for syncing");
    return false;
  }
  try {
    const clinicId = await getClinicId();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/typeform-integration/update-forms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        forms: forms,
      }),
    });

    if (!response.ok) throw new Error("Failed to sync Typeform leads");
    SuccessToast("Typeform leads sync in progress");
    return true;
  } catch (error) {
    ErrorToast("Failed to sync Typeform leads");
    console.error(error);
    return false;
  }
};
export const syncJotformLeads = async (forms: string[]) => {
  console.log("Syncing Typeform leads for forms:", forms);
  if (!forms || forms.length === 0) {
    ErrorToast("No Jotform forms selected for syncing");
    return false;
  }
  try {
    const clinicId = await getClinicId();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/jotform-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        // apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: "save_forms",
        clinic_id: clinicId,
        forms: forms,
      }),
    });

    if (!response.ok) throw new Error("Failed to sync Typeform leads");
    SuccessToast("Jotform leads sync in progress");
    return true;
  } catch (error) {
    ErrorToast("Failed to sync Jotform leads");
    console.error(error);
    return false;
  }
};

export const clearOAuthState = () => {
  // Only clear temporary OAuth data, preserve connected status
  const preservedData: { [key: string]: string | null } = {};

  const keysToPreserve = [
    "hubspot_oauth_status",
    "pipedrive_oauth_status",
    "google_form_oauth_status",
    "google_lead_form_oauth_status",
    "facebook_lead_form_oauth_status",
    "typeform_oauth_status",
    "hubspot_oauth_account_info",
    "pipedrive_oauth_account_info",
    "google_form_oauth_account_info",
    "google_lead_form_oauth_account_info",
    "facebook_lead_form_oauth_account_info",
    "typeform_oauth_account_info",
  ];

  keysToPreserve.forEach(key => {
    const value = localStorage.getItem(key);
    if (value === "connected" || (key.includes("account_info") && value)) {
      preservedData[key] = value;
    }
  });

  // Clear all OAuth items
  keysToPreserve.forEach(key => {
    localStorage.removeItem(key);
  });

  // Restore preserved connected statuses and account info
  Object.entries(preservedData).forEach(([key, value]) => {
    if (value) {
      localStorage.setItem(key, value);
    }
  });
};

export const clearTemporaryOAuthState = () => {
  // Clear only temporary OAuth states, not connected ones
  const tempKeys = ["oauth_state", "oauth_code_verifier", "oauth_redirect_url", "oauth_form_data", "oauth_question_index"];

  tempKeys.forEach(key => {
    localStorage.removeItem(key);
  });
};

export const saveOAuthState = (platform: string, status: string, accountInfo?: any) => {
  localStorage.setItem(`${platform}_oauth_status`, status);
  if (accountInfo) {
    localStorage.setItem(`${platform}_oauth_account_info`, JSON.stringify(accountInfo));
  }
};
const getCurrentUserId = async () => {
  const user = await getUserData();
  return user?.id;
};
export const connectToHubSpot = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const clinicId = await getClinicId();
    if (!clinicId) {
      throw new Error("Clinic ID not found");
    }
    const response = await fetch(`${SUPABASE_URL}/functions/v1/hubspot-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        redirectUrl: window.location.href,
      }),
    });

    if (!response.ok) {
      setButtonLoading(false);
      const errorText = await response.text();
      console.error("Response error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to HubSpot OAuth:", data.authUrl);
    window.location.href = data.authUrl;
  } catch (error) {
    setButtonLoading(false);
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to HubSpot. Please try again"}`);
  }
};
const supabase = createClient();
export const connectToGHL = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/GHL-integration/auth/start?clinic_id=${await getClinicId()}&redirectTo=${window.location.href}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (!response.ok) {
      setButtonLoading(false);
      const errorText = await response.text();
      console.error("Response error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Go High Level OAuth:", data.authUrl);
    window.location.href = data.url;
  } catch (error) {
    setButtonLoading(false);
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Go High Level. Please try again"}`);
  }
};

export const connectToPipedrive = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    console.log("Session debug:", {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      sessionError: sessionError,
      tokenLength: session?.access_token ? session.access_token.length : 0,
    });

    if (!session?.access_token) {
      setButtonLoading(false);
      ErrorToast("Please log in to connect to Pipedrive.");
      throw new Error("No valid session found. Please log in again.");
    }

    console.log("Making request with token:", session.access_token.substring(0, 20) + "...");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: "Functions",
        userId: await getCurrentUserId(),
        clinic_id: await getClinicId(),
        redirectUrl: window.location.href,
      }),
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (!response.ok) {
      setButtonLoading(false);
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Pipedrive OAuth:", data.authUrl);

    window.location.href = data.authUrl;
  } catch (error) {
    setButtonLoading(false);
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Pipedrive. Please try again"}`);
  }
};

export const connectToGoogleForm = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/initiate-oauth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        userId: await getCurrentUserId(),
        clinic_id: await getClinicId(),
        redirectTo: window.location.href,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      setButtonLoading(false);
      console.error("Response error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log("Response data:", data);
    if (data.error) {
      setButtonLoading(false);
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Google Form OAuth:", data.auth_url);
    window.location.href = data.auth_url;
  } catch (error) {
    setButtonLoading(false);
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Google Form. Please try again"}`);
  }
};

export const connectToTypeform = async (setButtonLoading: any) => {
  setButtonLoading(true);
  const clinicId = await getClinicId();
  try {
    // Replace with your backend endpoint for Typeform OAuth
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/typeform-integration/auth/start?clinic_id=${clinicId}&redirectTo=${window.location.href}`,
    );

    if (!res.ok) {
      setButtonLoading(false);
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }

    const { url } = await res.json();

    window.location.href = url;
  } catch (error) {
    setButtonLoading(false);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Typeform. Please try again"}`);
  }
};
export const connectToNextHealth = async (apiKey: string, setButtonLoading: any) => {
  setButtonLoading(true);
  const clinicId = await getClinicId();
  try {
    const res = await fetch("https://ozmytbghfvrfhbjvabor.supabase.co/functions/v1/NextHealth-integration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // same as your curl
        Authorization: apiKey,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        api_key: apiKey,
      }),
    });

    if (!res.ok) {
      setButtonLoading(false);
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("NextHealth response:", data);
    //redirect
    SuccessToast("NextHealth connected successfully");
    window.location.href = window.location.href + "?next_health_status=success";

    return data;
  } catch (err) {
    setButtonLoading(false);
    ErrorToast("Connection Failed: " + err);
    console.error("Error connecting NextHealth:", err);
    throw err;
  }
};
export const connnectToGravityForm = async (token: any, setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const clinic_id = await getClinicId();
    console.log("Connecting to Gravity Form with token:", token);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/GravityForm-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        form_ids: token.form_ids || [],
        consumerKey: token.consumerKey,
        consmerSecret: token.consumerSecret,
        baseURL: token.baseURL,
        clinic_id: clinic_id,
      }),
    });

    if (!response.ok) {
      setButtonLoading(false);
      const errorText = await response.text();
      console.error("Response error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log("Response data:", data);
    if (data.error) {
      setButtonLoading(false);
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Gravity Form OAuth:", data.auth_url);
    window.location.href = window.location.href + "?gravity_form_status=success";
  } catch (error) {
    setButtonLoading(false);
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Gravity Form. Please try again"}`);
  }
};
export const findSheetDetails = (treeData: any, sheetValue: any) => {
  const [spreadsheetId, sheetId] = sheetValue.split(":");

  const spreadsheetNode = treeData.find((node: any) => node.value === spreadsheetId);
  if (!spreadsheetNode || !spreadsheetNode.children) return null;

  const sheetNode = spreadsheetNode.children.find((child: any) => child.value === sheetValue);
  if (!sheetNode) return null;

  return {
    spreadsheet_id: spreadsheetId,
    spreadsheet_title: spreadsheetNode.title,
    sheet_id: sheetId,
    sheet_title: sheetNode.title,
  };
};

export const createJotformConnection = async (clinicId: string, jotformToken: string) => {
  const { data: integration } = await supabase.from("integrations").select("id").eq("name", "Jotform").single();
  const res = await supabase.from("integration_connections").upsert(
    {
      clinic_id: clinicId,
      integration_id: integration?.id,
      status: "active",
      created_at: "now()",
      updated_at: "now()",
      auth_data: { forms: [], access_token: jotformToken },
    },
    { onConflict: "clinic_id,integration_id" },
  );

  if (res.error) {
    console.error("Error creating Jotform connection:", res.error);
    throw new Error("Failed to create Jotform connection");
  }
  return true;
};

export const connectToGoogleLeadForm = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/google-leads/start-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic_id: await getClinicId(), redirectTo: window.location.href }),
    });

    if (!res.ok) throw new Error("Failed to start Google auth");

    const data = await res.json();
    if (!data.auth_url) throw new Error("No auth URL returned");

    window.location.href = data.auth_url;
  } catch (err) {
    setButtonLoading(false);
    console.error("Error starting Google auth:", err);
    ErrorToast("Failed to start Google OAuth flow");
  }
};

export const connectToCalendly = async (setButtonLoading: any) => {
  setButtonLoading(true);
  try {
    const clinic_id = await getClinicId();

    // Call the Supabase edge function to initiate OAuth
    const response = await fetch(`${SUPABASE_URL}/functions/v1/calendly-integrations/oauth/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinic_id,
        redirect_uri: `${SUPABASE_URL}/functions/v1/calendly-integrations/oauth/callback`,
      }),
    });

    const data = await response.json();

    if (data.success && data.oauth_url) {
      // Redirect to Calendly OAuth
      window.location.href = data.oauth_url;
    } else {
      throw new Error(data.error || "Failed to start OAuth flow");
    }
  } catch (error) {
    setButtonLoading(false);
    console.error("Error initiating Calendly OAuth:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Calendly. Please try again"}`);
  }
};

export const fetchCalendlyEventTypes = async () => {
  try {
    const clinic_id = await getClinicId();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/calendly-integrations/event-types?clinic_id=${clinic_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    const data = await response.json();

    if (data.success) {
      return data.data.event_types;
    } else {
      throw new Error(data.error || "Failed to fetch event types");
    }
  } catch (error) {
    console.error("Error fetching Calendly event types:", error);
    ErrorToast(`Failed to fetch event types: ${error instanceof Error ? error.message : "Please try again"}`);
    return [];
  }
};

export const saveCalendlyEventType = async (selectedEventTypeUri: string) => {
  try {
    const clinic_id = await getClinicId();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/calendly-integrations/save-event-type`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinic_id,
        selected_event_type_uri: selectedEventTypeUri,
      }),
    });

    const data = await response.json();

    if (data.success) {
      SuccessToast("Calendly event type saved successfully!");
      return data.data;
    } else {
      throw new Error(data.error || "Failed to save event type");
    }
  } catch (error) {
    console.error("Error saving Calendly event type:", error);
    ErrorToast(`Failed to save event type: ${error instanceof Error ? error.message : "Please try again"}`);
    throw error;
  }
};

export const fetchGoogleFormSheets = async (setGoogleFormTreeData: any) => {
  try {
    const clinicId = await getClinicId();
    const { data: connection } = await supabase
      .from("google_form_connections")
      .select("id")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-form-integration/list-spreadsheets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
        connection_id: connection?.id || null,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Google Sheets");
    }

    const data = await response.json();
    setGoogleFormTreeData(
      (data.spreadsheets || []).map((spreadsheet: any) => ({
        title: spreadsheet.spreadsheet_title,
        value: spreadsheet.spreadsheet_id,
        selectable: false,
        children: (spreadsheet.sheets || []).map((sheet: any) => ({
          title: sheet.sheet_title,
          value: `${spreadsheet.spreadsheet_id}:${sheet.sheet_id}`,
          isLeaf: true,
        })),
      })),
    );
  } catch (error) {
    ErrorToast("Failed to fetch Google Sheets");
    console.error(error);
  }
};

export const fetchTypeformForms = async (setTypeFormTreeData: any) => {
  try {
    const clinicId = await getClinicId();
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/typeform-integration/getSheets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        clinic_id: clinicId,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch Typeform forms");

    const data = await response.json();
    setTypeFormTreeData(
      (data.forms || []).map((form: any) => ({
        title: form.title,
        value: form.id,
        isLeaf: true,
      })),
    );
  } catch (error) {
    ErrorToast("Failed to fetch Typeform forms");
    console.error(error);
  }
};
export const fetchJotformForms = async (setJotformTreeData: any) => {
  try {
    const clinicId = await getClinicId();
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/jotform-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: "get_forms",
        clinic_id: clinicId,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch Jotform forms");

    const data = await response.json();
    setJotformTreeData(
      (data.content || []).map((form: any) => ({
        title: form.title,
        value: form.id,
        isLeaf: true,
      })),
    );
  } catch (error) {
    ErrorToast("Failed to fetch Typeform forms");
    console.error(error);
  }
};

//
type FormDataType = Record<string, any>;

export const handleInput = ({
  value,
  currentQuestion,
  formData,
  setFormData,
  clearOAuthState,
  setHubspotStatus,
  setPipedriveStatus,
  setGoHighLevelStatus,
  setNextHealthStatus,
  setShowHubspotModal,
  setShowPipedriveModal,
  setShowGoHighLevelModal,
  setShowNexHealthModal,
  setShowFacebookLeadFormModal,
  setShowGoogleLeadFormModal,
  setShowGoogleFormModal,
  setShowTypeformModal,
  setShowJotformModal,
  setShowGravityFormModal,
  setShowManualLeadsModal,
  setShowCompletionButtons,
}: any) => {
  setFormData((prev: FormDataType) => ({ ...prev, [currentQuestion.id]: value }));
  const updatedFormData = { ...formData, [currentQuestion.id]: value };
  localStorage.setItem("oauth_form_data", JSON.stringify(updatedFormData));

  if (currentQuestion.id === "selectedCrm") {
    clearOAuthState();
    if (value === "HubSpot") {
      setHubspotStatus("disconnected");
      setShowHubspotModal(true);
      setShowCompletionButtons(true);
    } else if (value === "Pipedrive") {
      setPipedriveStatus("disconnected");
      setShowPipedriveModal(true);
      setShowCompletionButtons(true);
    } else if (value === "GoHighLevel") {
      setGoHighLevelStatus("disconnected");
      setShowGoHighLevelModal(true);
      setShowCompletionButtons(true);
    } else if (value === "NextHealth") {
      setNextHealthStatus("disconnected");
      setShowNexHealthModal(true);
      setShowCompletionButtons(true);
    } else if (value === "No CRM") {
      setShowCompletionButtons(true);
      setHubspotStatus("disconnected");
      setPipedriveStatus("disconnected");
      setGoHighLevelStatus("disconnected");
      setNextHealthStatus("disconnected");
    }
  }

  if (currentQuestion.id === "adsConnections") {
    if (value === "Facebook Lead Ads") {
      setShowFacebookLeadFormModal(true);
      setShowCompletionButtons(true);
    } else if (value === "Google Ads Lead Forms") {
      setShowGoogleLeadFormModal(true);
      setShowCompletionButtons(true);
    } else {
      setShowCompletionButtons(true);
    }
  }

  if (currentQuestion.id === "leadCaptureForms") {
    if (value === "Google Forms") {
      setShowGoogleFormModal(true);
      setShowCompletionButtons(true);
    } else if (value === "Typeform") {
      setShowTypeformModal(true);
      setShowCompletionButtons(true);
    } else if (value === "Jotform") {
      setShowJotformModal(true);
      setShowCompletionButtons(true);
    } else if (value === "Gravity Forms") {
      setShowGravityFormModal(true);
      setShowCompletionButtons(true);
      return;
    } else {
      setShowCompletionButtons(true);
    }
  }

  if (currentQuestion.id === "uploadLeads") {
    if (value === "Yes") {
      setTimeout(() => setShowManualLeadsModal(true), 500);
    }
    setShowCompletionButtons(true);
  }
};

export const handle_Next = ({
  currentQuestion,
  currentValue,
  currentQuestionIndex,
  filteredQuestions,
  formData,
  setFormData,
  hubspotStatus,
  pipedriveStatus,
  goHighLevelStatus,
  nextHealthStatus,
  gravityFormStatus,
  googleFormStatus,
  googleLeadFormStatus,
  facebookLeadFormStatus,
  setShowHubspotModal,
  setShowPipedriveModal,
  setShowGoHighLevelModal,
  setShowNexHealthModal,
  setShowFacebookLeadFormModal,
  setShowGoogleLeadFormModal,
  setShowGoogleFormModal,
  setShowTypeformModal,
  setShowJotformModal,
  setShowGravityFormModal,
  setShowCompletionButtons,
  setCurrentQuestionIndex,
  hubspotAccountInfo,
  pipedriveAccountInfo,
  googleFormAccountInfo,
  googleLeadFormAccountInfo,
  facebookLeadFormAccountInfo,
  onNext,
}: any) => {
  const savedFormData = localStorage.getItem("oauth_form_data");
  if (savedFormData) {
    try {
      const parsedFormData = JSON.parse(savedFormData);
      if (parsedFormData.selectedCrm !== formData.selectedCrm) {
        setFormData(parsedFormData);
      }
    } catch (error) {
      console.error("Error parsing saved form data in handleNext:", error);
    }
  }

  if (currentQuestion.id === "selectedCrm") {
    if (currentValue === "HubSpot" && hubspotStatus !== "connected") {
      setShowHubspotModal(true);
      return;
    } else if (currentValue === "Pipedrive" && pipedriveStatus !== "connected") {
      setShowPipedriveModal(true);
      return;
    } else if (currentValue === "GoHighLevel" && goHighLevelStatus !== "connected") {
      setShowGoHighLevelModal(true);
      return;
    } else if (currentValue === "NextHealth" && nextHealthStatus !== "connected") {
      setShowNexHealthModal(true);
      return;
    } else if (currentValue === "No CRM") {
      localStorage.setItem("oauth_form_data", JSON.stringify(formData));
    }
  } else if (currentQuestion.id === "adsConnections") {
    if (currentValue === "Facebook Lead Ads" && facebookLeadFormStatus !== "connected") {
      setShowFacebookLeadFormModal(true);
      return;
    } else if (currentValue === "Google Ads Lead Forms" && googleLeadFormStatus !== "connected") {
      setShowGoogleLeadFormModal(true);
      return;
    }
  } else if (currentQuestion.id === "leadCaptureForms") {
    if (currentValue === "Google Forms") {
      setShowGoogleFormModal(true);
      setShowCompletionButtons(true);
    } else if (currentValue === "Typeform") {
      setShowTypeformModal(true);
      setShowCompletionButtons(true);
    } else if (currentValue === "Jotform") {
      setShowJotformModal(true);
      setShowCompletionButtons(true);
    } else if (currentValue === "Gravity Forms" && gravityFormStatus !== "connected") {
      setShowGravityFormModal(true);
      setShowCompletionButtons(true);
      return;
    } else {
      setShowCompletionButtons(true);
    }
  }

  if (currentQuestionIndex < filteredQuestions.length - 1) {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
    localStorage.setItem("oauth_question_index", (currentQuestionIndex + 1).toString());
  } else {
    const finalData = {
      ...formData,
      hubspotConnected: hubspotStatus === "connected",
      pipedriveConnected: pipedriveStatus === "connected",
      goHighLevelConnected: goHighLevelStatus === "connected",
      nextHealthConnected: nextHealthStatus === "connected",
      gravityFormConnected: gravityFormStatus === "connected",
      googleFormConnected: googleFormStatus === "connected",
      googleLeadFormConnected: googleLeadFormStatus === "connected",
      facebookLeadFormConnected: facebookLeadFormStatus === "connected",
      hubspotAccountInfo,
      pipedriveAccountInfo,
      googleFormAccountInfo,
      googleLeadFormAccountInfo,
      facebookLeadFormAccountInfo,
      csvUploaded: localStorage.getItem(ONBOARDING_LEADS_FILE_NAME) !== null,
    };
    localStorage.setItem("oauth_form_data", JSON.stringify(formData));
    onNext(finalData);
  }
};
