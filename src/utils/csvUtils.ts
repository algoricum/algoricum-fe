import { ONBOARDING_LEADS_FILE_NAME } from "@/constants/localStorageKeys";
import { ErrorToast, WarningToast, SuccessToast } from "@/helpers/toast";
import { Lead } from "@/interfaces/services_type";
import downloadAndParseCSVWithPapa from "@/utils/downloadAndParseCSVWithPapa";
import getLeadSourceId from "@/utils/lead_source";
import getNormalizedLead from "@/utils/normalizeLeadData";
import { createClient } from "@/utils/supabase/config/client";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import { getUserData } from "@/utils/supabase/user-helper";
import Papa from "papaparse";

const supabase = createClient();

// Upload CSV leads to Supabase lead table
export const handleCsvLeadsUpload = async (clinic_id: string, flag: boolean = false) => {
  const leadsFileName = localStorage.getItem(ONBOARDING_LEADS_FILE_NAME);

  if (leadsFileName) {
    const result = await downloadAndParseCSVWithPapa("lead-uploads", leadsFileName);

    // Properly type and extract data
    const leads: Partial<Lead>[] =
      result && typeof result === "object" && "data" in result && Array.isArray((result as any).data)
        ? (result as { data: Partial<Lead>[] }).data
        : [];

    // Get source_id for 'File'
    try {
      const source_id = await getLeadSourceId("Csv_File ");

      if (!source_id) {
        ErrorToast("Lead source 'Csv_File' not found");
      }

      const leadsToInsert = getNormalizedLead(leads, source_id, clinic_id);
      const { error: insertError } = await supabase.from("lead").insert(leadsToInsert);

      if (insertError?.code === "23505") {
        throw new Error("Upload failed: This email address is already associated with a lead in this clinic.");
      }

      if (insertError) {
        throw new Error(`Upload failed: ${insertError.message}`);
      }

      if (flag) {
        SuccessToast("Leads uploaded successfully");
      }
    } catch (error) {
      // Catch and display any errors during the upload process
      ErrorToast(`${error}`);
    }
  } else {
    // WarningToast("No CSV file found for upload");
  }
};
// Upload CSV file to Supabase storage and handle leads upload
export const handleCsvUpload = async (leadsData: any, flag: boolean) => {
  try {
    if (!leadsData) {
      WarningToast("No CSV file selected");
    }

    const user = await getUserData();
    if (!user) {
      ErrorToast("User not found. Please log in again.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `leads-${user.id}-${timestamp}.csv`;
    const filePath = `${user.id}/${fileName}`;

    let csvData;
    if (Array.isArray(leadsData)) {
      csvData = Papa.unparse(leadsData);
    } else {
      csvData = leadsData;
    }

    const { error } = await supabase.storage.from("lead-uploads").upload(filePath, csvData, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("Upload error:", error);
      throw new Error(`Failed to upload CSV: ${error.message}`);
    }

    localStorage.setItem(ONBOARDING_LEADS_FILE_NAME, filePath);

    if (flag) {
      const clinic_id = await getCurrentUserClinic();
      if (clinic_id) {
        await handleCsvLeadsUpload(clinic_id, true);
      } else {
        ErrorToast("Clinic not found. Please check your clinic settings.");
      }
    }
  } catch (error) {
    console.error("Error uploading CSV:", error);
  }
};
