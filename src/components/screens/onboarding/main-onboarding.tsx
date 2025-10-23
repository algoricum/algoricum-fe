"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { BASE_STEPS, BOOKING_LINK } from "@/constants/";
import {
  ONBOARDING_COMPLETED_STEPS_KEY,
  ONBOARDING_LEADS_FILE_NAME,
  ONBOARDING_STEP_KEY,
  ONBOARDING_STORAGE_KEY,
} from "@/constants/localStorageKeys";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useOnboardingUser,
  useOnboardingClinic,
  useCalendlyLink,
  useSubscriptionStatus,
  useCompleteOnboarding,
} from "@/hooks/useOnboarding";
import { handleCsvLeadsUpload } from "@/utils/csvUtils";
import generateClinicInstructions from "@/utils/generateClinicInstructions";
import { createClient } from "@/utils/supabase/config/client";
import Button from "antd/es/button";
import Typography from "antd/es/typography";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BookingSetupStep from "./booking-setup-step";
import ClinicInfoStep from "./clinic-info-step";
import IntegrationsStep from "./Integration";
import OnboardingSubscriptionStep from "./OnboardingSubscriptionStep";
import StaffHoursStep from "./staff-hours-step";

const { Text } = Typography;
const supabase = createClient();

// Helper function to generate slug from clinic name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
};

export default function MainOnboarding() {
  const router = useRouter();
  const { logout } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [allData, setAllData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  // React Query hooks
  const { data: userData, isLoading: userLoading, error: userError } = useOnboardingUser();
  const { data: clinicData, isLoading: clinicLoading, error: clinicError } = useOnboardingClinic();
  const { data: calendlyLink, isLoading: calendlyLoading } = useCalendlyLink(clinicData?.id || "");
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscriptionStatus(clinicData?.id || "");
  const completeOnboardingMutation = useCompleteOnboarding();

  // Only use BASE_STEPS for sidebar and navigation
  const STEPS = BASE_STEPS;
  const currentStep = STEPS[currentStepIndex];

  // Combined loading state for all React Query operations
  const isLoading = userLoading || clinicLoading || calendlyLoading || subscriptionLoading || completeOnboardingMutation.isPending;

  // Handle errors from React Query
  useEffect(() => {
    if (userError) {
      ErrorToast("Failed to load user data. Please refresh and try again.");
    }
    if (clinicError) {
      ErrorToast("Failed to load clinic data. Please refresh and try again.");
    }
  }, [userError, clinicError]);

  // Helper functions for localStorage (same as old flow)
  const isBrowser = typeof window !== "undefined";

  const getStoredData = useCallback(
    (key: string) => {
      if (!isBrowser) return null;
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.error("Error parsing JSON:", error);
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
      console.error("Error writing to localStorage:", error);
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
      localStorage.removeItem("oauth_form_data"); // Clear any OAuth form data
    } catch (error) {
      console.error("Error clearing localStorage:", error);
      ErrorToast("Error clearing localStorage");
    }
  };

  const mapDataForSubmission = (data: Record<string, any>) => {
    const clinicInfo = data["clinic-info"] || {};
    const staffHours = data["staff-hours"] || {};
    const toneIdentity = data["tone-identity"] || {};
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

    const mappedData = {
      // Step 1 - Clinic Info
      legalBusinessName: clinicInfo.clinicName || "",
      dbaName: clinicInfo.primaryContactName || "",
      clinicAddress: clinicInfo.businessAddress || "",
      businessHours: businessHours,

      // Step 2 - Contact Info
      fullName: "", // Not collected in new flow
      emailAddress: clinicInfo.primaryContactEmail || "",
      phoneNumber: clinicInfo.clinicPhone || "",
      calendlyLink: bookingSetup.bookingLinkUrl || "",

      // AI Assistant Configuration
      toneSelector: toneIdentity.toneSelector || "friendly",
      sentenceLength: clinicInfo.sentenceLength || "medium",
      formalityLevel: clinicInfo.formalityLevel || "formal",

      // Additional data from new flow
      clinicType: clinicInfo.clinicType || "",
      integrations: integrations,

      // Three document types with their paths
      servicesDocumentPath: clinicInfo.servicesDocument?.[0]?.path || null,
      pricingDocumentPath: clinicInfo.pricingDocument?.[0]?.path || null,
      testimonialsDocumentPath: clinicInfo.testimonialsDocument?.[0]?.path || null,

      // Business hours for generateClinicInstructions
      businessHoursText: clinicInfo.businessHours || "",
    };

    return mappedData;
  };

  // Helper function to convert file path to File object
  async function getFileAsFile(bucket: any, path: any) {
    if (!path) return null;

    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);

      if (error) {
        console.error("Error downloading file:", error);
        return null;
      }

      // Convert blob to File
      const fileName = path.split("/").pop() || "file";
      const file = new File([data], fileName, { type: data.type });
      return file;
    } catch (error) {
      console.error("Error converting file:", error);
      return null;
    }
  }

  // Streamlined onboarding completion using React Query
  const handleCompleteOnboarding = async (dataToUse?: Record<string, any>) => {
    if (!userData || !clinicData || !subscriptionData) {
      ErrorToast("Required data not loaded. Please refresh and try again.");
      return;
    }

    try {
      const finalData = dataToUse || allData;
      const mappedData = mapDataForSubmission(finalData);

      // Use Calendly link from React Query or fallback
      const calendlyBookingLink = calendlyLink || mappedData.calendlyLink || BOOKING_LINK;

      // Generate slug from clinic name
      const clinicSlug = generateSlug(mappedData.legalBusinessName || clinicData.name || "clinic");

      if (!clinicSlug || clinicSlug.trim() === "") {
        throw new Error("Failed to generate valid clinic slug");
      }

      // Prepare clinic update data
      const clinicUpdateData = {
        id: clinicData.id,
        owner_id: userData.id,
        name: mappedData.legalBusinessName || `${userData.email?.split("@")[0] || "User"}'s Clinic`,
        legal_business_name: mappedData.legalBusinessName || `${userData.email?.split("@")[0] || "User"}'s Clinic`,
        dba_name: mappedData.dbaName,
        slug: clinicSlug,
        address: mappedData.clinicAddress,
        phone: mappedData.phoneNumber,
        email: mappedData.emailAddress || userData.email,
        language: "en",
        business_hours: mappedData.businessHours,
        calendly_link: calendlyBookingLink,
        tone_selector: mappedData.toneSelector,
        sentence_length: mappedData.sentenceLength,
        formality_level: mappedData.formalityLevel,
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

      // Prepare Mailgun setup data
      const clinicInfoData = allData["clinic-info"] || {};
      const mailgunSetupData = {
        ...clinicInfoData,
        clinicName: mappedData.legalBusinessName,
        clinicType: mappedData.clinicType,
        primaryContactEmail: mappedData.emailAddress,
        clinicPhone: clinicInfoData.clinicPhone || mappedData.phoneNumber,
        businessAddress: mappedData.clinicAddress,
      };

      // Prepare assistant FormData if documents exist
      let assistantFormData: FormData | undefined;
      const hasDocuments = mappedData.servicesDocumentPath || mappedData.pricingDocumentPath || mappedData.testimonialsDocumentPath;

      if (hasDocuments) {
        assistantFormData = new FormData();
        assistantFormData.append("clinic_id", clinicData.id);
        assistantFormData.append("name", mappedData.legalBusinessName || "Assistant");

        const clinicInstructions = generateClinicInstructions({
          name: mappedData.legalBusinessName || "",
          address: mappedData.clinicAddress || "",
          phone: mappedData.phoneNumber || "",
          email: mappedData.emailAddress || userData.email || "",
          business_hours: mappedData.businessHoursText || "",
          calendly_link: mappedData.calendlyLink || "",
          tone_selector: mappedData.toneSelector || "professional",
          sentence_length: mappedData.sentenceLength || "medium",
          formality_level: mappedData.formalityLevel || "formal",
          has_uploaded_document: true,
        });

        assistantFormData.append("instructions", clinicInstructions);

        // Download and append files
        if (mappedData.servicesDocumentPath) {
          const serviceFile = await getFileAsFile("Assistant-File", mappedData.servicesDocumentPath);
          if (serviceFile) assistantFormData.append("service_document", serviceFile);
        }

        if (mappedData.pricingDocumentPath) {
          const pricingFile = await getFileAsFile("Assistant-File", mappedData.pricingDocumentPath);
          if (pricingFile) assistantFormData.append("pricing_document", pricingFile);
        }

        if (mappedData.testimonialsDocumentPath) {
          const testimonialsFile = await getFileAsFile("Assistant-File", mappedData.testimonialsDocumentPath);
          if (testimonialsFile) assistantFormData.append("testimonials_document", testimonialsFile);
        }
      }

      // Execute complete onboarding mutation
      await completeOnboardingMutation.mutateAsync({
        clinicData: clinicUpdateData,
        mailgunSetupData,
        slug: clinicSlug,
        apiKeyName: `${mappedData.legalBusinessName} Primary Key`,
        assistantFormData,
        subscriptionData,
        confirmationEmailData: {
          name: clinicUpdateData.legal_business_name,
          email: clinicUpdateData.email || userData.email || "",
        },
      });

      // Handle CSV leads upload
      await handleCsvLeadsUpload(clinicData.id);

      // Clear stored progress
      clearStoredProgress();

      setIsOnboardingComplete(true);
    } catch (error: any) {
      console.error("Onboarding completion error:", error);
      ErrorToast(error.message || "Failed to complete onboarding");
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
      handleCompleteOnboarding(newAllData);
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
        // localStorage.clear();
        // localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        // localStorage.removeItem(ONBOARDING_STEP_KEY);
        // localStorage.removeItem(ONBOARDING_COMPLETED_STEPS_KEY);
        // localStorage.removeItem(ONBOARDING_LEADS_FILE_NAME);

        SuccessToast("Logout Successfully");
        router.push("/login");
      } else {
        ErrorToast("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Error during logout:", error);
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
      case "booking-setup":
        return <BookingSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "integrations":
        return <IntegrationsStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "billing":
        return <OnboardingSubscriptionStep onNext={handleStepComplete} />;

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
            <Text className="text-purple-500 text-sm font-bold">
              <Image src="logo.svg" alt="Logo" width={50} height={50} />
            </Text>
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
                {index < STEPS.length - 1 && <div className="absolute left-3 top-6 w-px h-6 bg-white bg-opacity-30 z-10" />}

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
            disabled={isLoading}
          >
            <span className="mr-2">→</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-hidden relative">
        {/* Loading overlay when processing */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
            <LoadingSpinner message={completeOnboardingMutation.isPending ? "Setting up your clinic..." : "Loading..."} size="lg" />
          </div>
        )}

        {/* <div className="h-full overflow-y-auto py-11 px-8">{renderCurrentStep()}</div> */}
        <div className="h-full overflow-y-auto py-11 px-8">
          {isOnboardingComplete ? (
            <div className="max-w-xl mx-auto text-center mt-32">
              <h1 className="text-2xl font-semibold mb-4">You&apos;re all set! 🎉</h1>
              <p className="text-lg text-gray-700">Algoricum is now live and following up with your leads.</p>
              <p className="text-md text-gray-600 mt-4">
                <strong>Check your inbox</strong> for next steps and tips to get the most out of Algoricum.
              </p>
              <Button type="primary" className="mt-6" onClick={() => router.push("/dashboard?onboarding=success")}>
                Go to Dashboard
              </Button>
            </div>
          ) : (
            renderCurrentStep()
          )}
        </div>
      </div>
    </div>
  );
}
