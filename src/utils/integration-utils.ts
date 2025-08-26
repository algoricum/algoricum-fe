import { createClient } from "@/utils/supabase/config/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ONBOARDING_LEADS_FILE_NAME } from "../constants/integration-constants";
import { toast } from "react-toastify";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { getUserData } from "@/utils/supabase/user-helper";

export const ErrorToast = (message: string) => toast.error(message);
export const SuccessToast = (message: string) => toast.success(message);
export const InfoToast = (message: string) => toast.info(message);

export const getClinicId = async () => {
  const clinic = await getClinicData();
  return clinic?.id || "";
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
    SuccessToast("Pipedrive leads synced successfully");
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

    if (!response.ok) throw new Error("Failed to sync Google Form leads");
    SuccessToast("Google Form leads synced successfully");
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
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-leads/sync-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ clinic_id: clinicId }),
    });

    if (!response.ok) throw new Error("Failed to sync Google Lead Form leads");
    SuccessToast("Google Lead Form leads synced successfully");
  } catch (error) {
    ErrorToast("Failed to sync Google Lead Form leads");
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
    const response = await fetch(`${SUPABASE_URL}/functions/v1/typeform-integration//update-forms`, {
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
    SuccessToast("Typeform leads synced successfully");
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
    SuccessToast("Jotform leads synced successfully");
    return true;
  } catch (error) {
    ErrorToast("Failed to sync Jotform leads");
    console.error(error);
    return false;
  }
};

export const clearOAuthState = () => {
  localStorage.removeItem("hubspot_oauth_status");
  localStorage.removeItem("pipedrive_oauth_status");
  localStorage.removeItem("google_form_oauth_status");
  localStorage.removeItem("google_lead_form_oauth_status");
  localStorage.removeItem("facebook_lead_form_oauth_status");
  localStorage.removeItem("typeform_oauth_status");
  localStorage.removeItem("hubspot_oauth_account_info");
  localStorage.removeItem("pipedrive_oauth_account_info");
  localStorage.removeItem("google_form_oauth_account_info");
  localStorage.removeItem("google_lead_form_oauth_account_info");
  localStorage.removeItem("facebook_lead_form_oauth_account_info");
  localStorage.removeItem("typeform_oauth_account_info");
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
export const connectToHubSpot = async () => {
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
        userId: await getCurrentUserId(),
        clinic_id: clinicId,
        redirectUrl: window.location.href,
      }),
    });

    if (!response.ok) {
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
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to HubSpot. Please try again"}`);
  }
};
const supabase = createClient();
export const connectToGHL = async()=>{
 try {
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/GHL-integration/auth/start?clinic_id=${await getClinicId()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Go High Level OAuth:", data.authUrl);
    window.location.href = data.url;
  } catch (error) {
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Go High Level. Please try again"}`);
  }  
}
export const connectToPipedrive = async () => {
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
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Pipedrive OAuth:", data.authUrl);
    window.location.href = data.authUrl;
  } catch (error) {
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Pipedrive. Please try again"}`);
  }
};

export const connectToGoogleForm = async () => {
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
        redirectUrl: window.location.href,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Response error:", response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log("Response data:", data);
    if (data.error) {
      throw new Error(data.error);
    }

    console.log("🚀 Redirecting to Google Form OAuth:", data.auth_url);
    window.location.href = data.auth_url;
  } catch (error) {
    console.error("Connection failed:", error);
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Google Form. Please try again"}`);
  }
};

export const connectToTypeform = async () => {
  const clinicId = await getClinicId();
  try {
    // Replace with your backend endpoint for Typeform OAuth
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/typeform-integration/auth/start?clinic_id=${clinicId}&redirect_to=${window.location.origin}/onboarding`,
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }

    const { url } = await res.json();

    window.location.href = url;
  } catch (error) {
    ErrorToast(`Connection Failed: ${error instanceof Error ? error.message : "Unable to connect to Typeform. Please try again"}`);
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
  const res = await supabase
    .from("integration_connections")
    .upsert(
      {
        clinic_id: clinicId,
        integration_id: integration?.id,
        status: "active",
        created_at: "now()",
        updated_at: "now()",
        auth_data: { forms: [], access_token: jotformToken },
      },
      { onConflict: "clinic_id,integration_id" },
    )
    
    if (res.error) {
      console.error("Error creating Jotform connection:", res.error);
      throw new Error("Failed to create Jotform connection");
    }
    return true
};
