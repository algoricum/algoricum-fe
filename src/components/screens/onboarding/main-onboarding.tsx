"use client";

import { useState, useEffect, useCallback } from "react";
import { Typography } from "antd";
import { useRouter } from "next/navigation";
import ClinicInfoStep from "./clinic-info-step";
import StaffHoursStep from "./staff-hours-step";
import ToneIdentityStep from "./tone-identity-step";
import AiAssistantStep from "./ai-assistant-step";
import BookingSetupStep from "./booking-setup-step";
import IntegrationsStep from "./integrations-step";

// Import your existing services and helpers
import apiKeyService from "@/services/apiKey";
import { Lead } from "@/interfaces/services_type";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads";
import { updateClinic, getClinicData, createEmailSettings } from "@/utils/supabase/clinic-helper";
import { getUserData } from "@/utils/supabase/user-helper";
import generateClinicInstructions from "@/utils/generateClinicInstructions";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { useAuth } from "@/hooks/useAuth";
import ChatbotSetupStep from "./chatbot-setup-step";

import { createClient } from "@/utils/supabase/config/client";
import getLeadSourceId from "@/utils/lead_source";
import getNormalizedLead from "@/utils/normalizeLeadData";
import downloadAndParseCSVWithPapa from "@/utils/downloadAndParseCSVWithPapa";

import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_STEP_KEY,
  ONBOARDING_COMPLETED_STEPS_KEY,
  ONBOARDING_LEADS_FILE_NAME,
} from "@/constants/localStorageKeys";

const { Text } = Typography;

const BASE_STEPS = [
  { id: "clinic-info", title: "Clinic Info", description: "Basic details", icon: "📋" },
  { id: "staff-hours", title: "Hours", description: "Schedule", icon: "👥" },
  { id: "tone-identity", title: "Tone", description: "Style", icon: "🎨" },
  { id: "ai-assistant", title: "AI Setup", description: "Documents", icon: "💬" },
  { id: "booking-setup", title: "Booking", description: "Appointments", icon: "⚙️" },
  { id: "chatbot-setup", title: "Chatbot-Integration", description: "AI Assistant", icon: "🤖" },
  { id: "integrations", title: "CRM-Integrations", description: "Tools", icon: "⚡" },
];

export default function MainOnboarding() {
  const supabase = createClient();
  const router = useRouter();
  const { logout } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [allData, setAllData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only use BASE_STEPS for sidebar and navigation
  const STEPS = BASE_STEPS;
  const currentStep = STEPS[currentStepIndex];
  // Helper functions for localStorage (same as old flow)
  const isBrowser = typeof window !== "undefined";

  const getStoredData = useCallback(
    (key: string) => {
      if (!isBrowser) return null;
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        ErrorToast("Error reading from localStorage");
        return null;
      }
    },
    [isBrowser],
  );

  // Restore onboarding progress from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = getStoredData(ONBOARDING_STORAGE_KEY);
      const savedStep = getStoredData(ONBOARDING_STEP_KEY);
      const savedCompleted = getStoredData(ONBOARDING_COMPLETED_STEPS_KEY);
      if (savedData) setAllData(savedData);
      if (typeof savedStep === "number") setCurrentStepIndex(savedStep);
      if (Array.isArray(savedCompleted)) setCompletedSteps(savedCompleted);
    }
  }, [getStoredData]);

  const setStoredData = (key: string, data: any) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      ErrorToast("Error writing to localStorage");
    }
  };

  const clearStoredProgress = () => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      localStorage.removeItem(ONBOARDING_STEP_KEY);
      localStorage.removeItem(ONBOARDING_COMPLETED_STEPS_KEY);
      localStorage.removeItem(ONBOARDING_LEADS_FILE_NAME);
    } catch (error) {
      ErrorToast("Error clearing localStorage");
    }
  };

  // Map new flow data to old flow structure for Supabase
  const mapDataForSubmission = (data: Record<string, any>) => {
    const clinicInfo = data["clinic-info"] || {};
    const staffHours = data["staff-hours"] || {};
    const toneIdentity = data["tone-identity"] || {};
    const aiAssistant = data["ai-assistant"] || {};
    const bookingSetup = data["booking-setup"] || {};
    const integrations = data["integrations"] || {};

    // Convert business hours to old format
    const businessHours: any = {};
    const newBusinessHours = staffHours.businessHours || {};

    Object.keys(newBusinessHours).forEach(day => {
      const dayData = newBusinessHours[day];
      businessHours[day] = {
        isOpen: dayData.enabled || false,
        openTime: dayData.start || "9:00 AM",
        closeTime: dayData.end || "5:00 PM",
      };
    });

    return {
      // Step 1 - Clinic Info
      legalBusinessName: clinicInfo.clinicName || "",
      dbaName: "", // Not collected in new flow
      clinicAddress: clinicInfo.businessAddress || "",
      businessHours: businessHours,

      // Step 2 - Contact Info
      fullName: "", // Not collected in new flow
      emailAddress: clinicInfo.primaryContactEmail || "",
      phoneNumber: clinicInfo.clinicPhone || "",
      calendlyLink: bookingSetup.hasBookingLink === "Yes, I have a booking link" ? bookingSetup.bookingLinkUrl : "",

      // Step 3 - Brand Config
      logo: aiAssistant.logoUpload?.[0]?.originFileObj || null,
      tone_selector: toneIdentity.toneSelector || "",
      sentence_length: toneIdentity.sentenceLength || "",
      formality_level: toneIdentity.formalityLevel || "",
      clinic_document: aiAssistant.clinicDetailsUpload?.[0]?.originFileObj || null,

      // Additional data from new flow
      clinicType: clinicInfo.clinicType || "",
      integrations: integrations,
    };
  };

  // Upload CSV leads to Supabase lead table
  const handleCsvLeadsUpload = async (clinic_id: string) => {
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
        const source_id = await getLeadSourceId("File");
        const leadsToInsert = getNormalizedLead(leads, source_id, clinic_id);
        const { error: insertError } = await supabase.from("lead").insert(leadsToInsert);
        if (insertError) {
          ErrorToast(insertError.message);
        }
      } catch (error) {
        ErrorToast(`${error}`);
      }
    } else {
      console.log("Faizan csv handler is running but no leads file found");
    }
  };

  // Main submission function (updated to use updateClinic)
  const handleCompleteOnboarding = async () => {
    try {
      setIsSubmitting(true);

      // Map the new flow data to the old structure
      const mappedData = mapDataForSubmission(allData);

      // Get current user
      const user = await getUserData();
      if (!user) {
        ErrorToast("User not found. Please logout and log in again.");
        setIsSubmitting(false);
        return;
      }

      // Get existing clinic
      const clinic = await getClinicData();
      if (!clinic || !clinic.id) {
        ErrorToast("No clinic found for user. Please try logging in again.");
        setIsSubmitting(false);
        return;
      }

      // Upload the logo if provided
      let logoUrl = undefined;
      if (mappedData.logo) {
        logoUrl = await uploadClinicLogo(user.id, mappedData.logo);
      }

      const clinicData = {
        id: clinic.id, // Include clinic ID for update
        owner_id: user.id,
        name: mappedData.legalBusinessName || `${user.email?.split("@")[0] || "User"}'s Clinic`,
        legal_business_name: mappedData.legalBusinessName || `${user.email?.split("@")[0] || "User"}'s Clinic`,
        dba_name: mappedData.dbaName,
        address: mappedData.clinicAddress,
        phone: mappedData.phoneNumber,
        email: mappedData.emailAddress || user.email,
        language: "en",
        business_hours: mappedData.businessHours,
        calendly_link: mappedData.calendlyLink,
        logo: logoUrl,
        tone_selector: mappedData.tone_selector,
        sentence_length: mappedData.sentence_length,
        formality_level: mappedData.formality_level,
        clinic_type: mappedData.clinicType,
        uses_hubspot: mappedData.integrations.usesHubspot === "Yes",
        uses_ads: mappedData.integrations.usesAds === "Yes",
        has_chatbot: mappedData.integrations.hasChatbot === "Yes",
        other_tools: mappedData.integrations.otherTools || "",
        widget_theme: {
          primary_color: "#2563EB",
          font_family: "Inter, sans-serif",
          border_radius: "8px",
        },
        dashboard_theme: {
          primary_color: "#2563EB",
        },
      };

      console.log("MainOnboarding clinicData:", clinicData);

      // Update clinic
      const updatedClinic = await updateClinic(clinicData);

      // Generate API key for the clinic
      const apiKeyName = `${mappedData.legalBusinessName} Primary Key`;
      await apiKeyService.create({
        name: apiKeyName,
        clinicId: updatedClinic.id,
      });

      // Handle document upload and assistant creation if we have a clinic ID
      if (updatedClinic.id && mappedData.clinic_document) {
        const hasDocument = !!mappedData.clinic_document;

        if (hasDocument) {
          // Prepare form data for the edge function
          const formDataToSend = new FormData();
          formDataToSend.append("clinic_document", mappedData.clinic_document);
          formDataToSend.append("clinic_id", updatedClinic.id);
          formDataToSend.append("name", mappedData.legalBusinessName);
          formDataToSend.append("description", `AI Assistant for ${mappedData.legalBusinessName}`);

          // Generate customized instructions based on clinic settings
          const clinicInstructions = generateClinicInstructions({
            name: mappedData.legalBusinessName,
            address: mappedData.clinicAddress,
            phone: mappedData.phoneNumber,
            email: mappedData.emailAddress || user.email,
            business_hours: mappedData.businessHours,
            calendly_link: mappedData.calendlyLink,
            tone_selector: mappedData.tone_selector,
            sentence_length: mappedData.sentence_length,
            formality_level: mappedData.formality_level,
            has_uploaded_document: true,
          });

          formDataToSend.append("instructions", clinicInstructions);
          formDataToSend.append("model", "gpt-4o");
          formDataToSend.append("tools", JSON.stringify([{ type: "file_search" }]));

          // Get the token for authorization
          const session = await getSupabaseSession();

          if (!session.access_token) {
            throw new Error("Not authenticated");
          }

          try {
            // Call the combined edge function
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: formDataToSend,
            });

            await response.json();

            if (!response.ok) {
              ErrorToast("Assistant creation error");
              // Continue with onboarding even if assistant creation fails
            }
          } catch (assistantError) {
            ErrorToast("Failed to create assistant");
            // Continue with onboarding even if assistant creation fails
          }
        }
      }

      try {
        const session = await getSupabaseSession();
        if (!session.access_token) {
          throw new Error("Not authenticated");
        }

        const twilioResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twillio-setup`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clinic_id: updatedClinic.id,
            phone_number: mappedData.phoneNumber,
            name: mappedData.legalBusinessName,
          }),
        });

        const twilioResult = await twilioResponse.json();

        if (!twilioResponse.ok) {
          console.error("Twilio setup error:", twilioResult.error);
        }
      } catch (twilioError) {
        console.error("Failed to set up Twilio:", twilioError);
      }

      await createEmailSettings(clinic.id);
      await handleCsvLeadsUpload(clinic.id);
      clearStoredProgress();

      SuccessToast("You're all set!");
      setTimeout(() => {
        router.push("/dashboard?onboarding=success");
      }, 2000);
    } catch (error: any) {
      ErrorToast(error.message || "Failed to update clinic");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepComplete = (stepData: any) => {
    // Save step data
    const newAllData = {
      ...allData,
      [currentStep?.id]: stepData,
    };

    setAllData(newAllData);

    // Save to localStorage for persistence
    setStoredData(ONBOARDING_STORAGE_KEY, newAllData);
    setStoredData(ONBOARDING_STEP_KEY, currentStepIndex + 1);

    // Mark step as completed
    let newCompletedSteps = completedSteps;
    if (!completedSteps.includes(currentStepIndex)) {
      newCompletedSteps = [...completedSteps, currentStepIndex];
      setCompletedSteps(newCompletedSteps);
      setStoredData(ONBOARDING_COMPLETED_STEPS_KEY, newCompletedSteps);
    }

    // Move to next step or complete onboarding
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleCompleteOnboarding();
    }
  };

  const handleStepPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setStoredData(ONBOARDING_STEP_KEY, currentStepIndex - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex) || stepIndex === currentStepIndex) {
      setCurrentStepIndex(stepIndex);
      setStoredData(ONBOARDING_STEP_KEY, stepIndex);
    }
  };

  const handleLogout = async () => {
    try {
      const success = await logout();
      if (success) {
        localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        localStorage.removeItem(ONBOARDING_STEP_KEY);
        localStorage.removeItem(ONBOARDING_COMPLETED_STEPS_KEY);
        localStorage.removeItem(ONBOARDING_LEADS_FILE_NAME);

        SuccessToast("Logout Successfully");
        router.push("/login");
      } else {
        ErrorToast("Logout failed. Please try again.");
      }
    } catch (error) {
      ErrorToast("Logout failed. Please try again.");
    }
  };

  const renderCurrentStep = () => {
    const stepData = allData[currentStep.id] || {};

    switch (currentStep.id) {
      case "clinic-info":
        return (
          <ClinicInfoStep
            onNext={handleStepComplete}
            onPrev={currentStepIndex > 0 ? handleStepPrevious : undefined}
            initialData={stepData}
          />
        );
      case "staff-hours":
        return <StaffHoursStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "tone-identity":
        return <ToneIdentityStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "ai-assistant":
        return <AiAssistantStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "booking-setup":
        return <BookingSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "chatbot-setup":
        return <ChatbotSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "integrations":
        return <IntegrationsStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-72 bg-gradient-to-b from-purple-500 to-purple-600 p-5 h-screen overflow-hidden">
        {/* Logo */}
        <div className="flex items-center mb-5">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center mr-2">
            <Text className="text-purple-500 text-sm font-bold">A</Text>
          </div>
          <Text className="text-white text-lg font-semibold">Algoricum</Text>
        </div>

        {/* Steps */}
        <div className="relative">
          {STEPS.map((step, index) => {
            const isCurrent = currentStepIndex === index;
            const isCompleted = completedSteps.includes(index);
            const isAccessible = index <= currentStepIndex || isCompleted;

            return (
              <div key={step.id} className={`relative ${index === STEPS.length - 1 ? "" : "mb-3"}`}>
                {/* Vertical connecting line */}
                {index < STEPS.length - 1 && <div className="absolute left-3 top-5 w-px h-3 bg-white bg-opacity-30 z-10" />}

                <div
                  className={`flex items-start cursor-pointer opacity-100 ${isAccessible ? "cursor-pointer" : "cursor-default opacity-70"}`}
                  onClick={() => isAccessible && handleStepClick(index)}
                >
                  {/* Icon Circle */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 flex-shrink-0 z-20 relative ${
                      isCurrent ? "bg-white bg-opacity-90" : "bg-white bg-opacity-20"
                    }`}
                  >
                    <Text className={`text-xs ${isCurrent ? "text-purple-500" : "text-white text-opacity-80"}`}>
                      {isCompleted ? "✓" : step.icon}
                    </Text>
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 pt-0">
                    <Text className="text-white text-opacity-80 text-xs font-normal block mb-0 tracking-wide">
                      {index + 1}/{STEPS.length}
                    </Text>
                    <Text className="text-white text-sm font-semibold block mb-0 leading-none">{step.title}</Text>
                    <Text className="text-white text-opacity-70 text-xs leading-tight block">{step.description}</Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-5 left-5 right-5">
          <button
            onClick={handleLogout}
            className="w-auto bg-white bg-opacity-20 border border-white border-opacity-30 text-white rounded-lg px-4 py-2 h-auto text-sm hover:bg-white hover:bg-opacity-30 transition-all flex items-center"
            disabled={isSubmitting}
          >
            <span className="mr-2">→</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-hidden relative">
        {/* Loading overlay when submitting */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Setting up your clinic...</p>
            </div>
          </div>
        )}

        <div className="h-full overflow-y-auto py-11 px-8">{renderCurrentStep()}</div>
      </div>
    </div>
  );
}
