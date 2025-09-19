"use client";

import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { BOOKING_LINK } from "@/constants/";
import {
  ONBOARDING_COMPLETED_STEPS_KEY,
  ONBOARDING_LEADS_FILE_NAME,
  ONBOARDING_STEP_KEY,
  ONBOARDING_STORAGE_KEY,
} from "@/constants/localStorageKeys";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { useAuth } from "@/hooks/useAuth";
import apiKeyService from "@/services/apiKey";
import { handleCsvLeadsUpload } from "@/utils/csvUtils";
import generateClinicInstructions from "@/utils/generateClinicInstructions";
import { handleSubscribe } from "@/utils/stripe";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import { getClinicData, updateClinic, updateMailgunDomainSettings } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { getUserData } from "@/utils/supabase/user-helper";
import { Button, Typography } from "antd";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BookingSetupStep from "./booking-setup-step";
import ClinicInfoStep from "./clinic-info-step";
import IntegrationsStep from "./Integration";
import StaffHoursStep from "./staff-hours-step";

const { Text } = Typography;
const supabase = createClient();
const BASE_STEPS = [
  { id: "clinic-info", title: "Clinic Profile", description: "Basic details", icon: "📋" },
  { id: "staff-hours", title: "Hours of operation", description: "Schedule", icon: "👥" },
  // { id: "billing", title: "Billing", description: "Plan & Payment", icon: "💳" },
  // { id: "tone-identity", title: "Tone", description: "Style", icon: "🎨" },
  // { id: "ai-assistant", title: "AI Setup", description: "Documents", icon: "💬" },
  // { id: "chatbot-setup", title: "Chatbot-Integration", description: "AI Assistant", icon: "🤖" },
  { id: "integrations", title: "Lead Capture Setup", description: "Tools", icon: "⚡" },
  { id: "booking-setup", title: "Booking Link Setup", description: "Appointments", icon: "⚙️" },
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  const checkSubscription = async (id: string) => {
    const { data: sub } = await supabase
      .from("stripe_subscriptions")
      .select("id,status")
      .eq("clinic_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) {
      const { data: planData } = await supabase.from("plans").select("*").limit(1);
      if (planData && planData[0]?.price_id) {
        console.log("asdf", !sub, planData);
        await handleSubscribe(planData[0]?.price_id, id);
      }
    }
  };
  useEffect(() => {
    const fetchInitialData = async () => {
      const clinic = await getClinicData();
      console.log(".......Clinic data:.....", clinic);
      if (!clinic) {
        ErrorToast("Clinic data not found.");
        return;
      }

      await checkSubscription(clinic.id);
    };
    if (currentStepIndex > 1) {
      fetchInitialData();
    }
  }, [currentStepIndex]);
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

  // Mailgun setup function
  const setupMailgunDomain = async (clinicData: any, formData: any, slug: string) => {
    console.log("🚀 Starting Mailgun domain setup...");

    if (!clinicData?.id) {
      console.error("Clinic ID not available. Cannot proceed with mailgun setup.");
      return;
    }

    if (!slug) {
      console.error("Slug not available. Cannot proceed with mailgun setup.");
      return;
    }

    try {
      const requestPayload = {
        ...formData,
        clinicId: clinicData.id,
        slug: slug, // Pass the generated slug
      };

      console.log("📡 Mailgun setup request payload:", requestPayload);

      const response = await fetch("/api/mailgun-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Mailgun setup failed:", data.error || `HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      console.log("✅ Mailgun setup completed:", data);
      return data;
    } catch (error) {
      console.error("❌ Mailgun setup failed:", error);
    }
  };

  // Map new flow data to old flow structure for Supabase
  // Map new flow data to old flow structure for Supabase
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

    return {
      // Step 1 - Clinic Info
      legalBusinessName: clinicInfo.clinicName || "",
      dbaName: clinicInfo.primaryContactName || "",
      clinicAddress: clinicInfo.businessAddress || "",
      businessHours: businessHours,

      // Step 2 - Contact Info
      fullName: "", // Not collected in new flow
      emailAddress: clinicInfo.primaryContactEmail || "",
      phoneNumber: clinicInfo.clinicPhone || "",
      calendlyLink: bookingSetup.hasBookingLink === "Yes, I have a booking link" ? bookingSetup.bookingLinkUrl : "",

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

  // Main submission function (updated to handle three document types)
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

      // Fetch Calendly booking link if available
      let calendlyBookingLink = mappedData.calendlyLink || "https://tinyurl.com/35c3wr42";
      try {
        const { data: calendlyIntegration } = await supabase
          .from("calendly_integrations")
          .select("clinic_booking_link")
          .eq("clinic_id", clinic.id)
          .eq("status", "active")
          .single();

        if (calendlyIntegration?.clinic_booking_link) {
          calendlyBookingLink = calendlyIntegration.clinic_booking_link;
          console.log("📅 Using Calendly booking link:", calendlyBookingLink);
        }
      } catch (error) {
        console.log("📅 No Calendly integration found, using default/provided link", error);
      }

      // Generate slug from clinic name
      const clinicSlug = generateSlug(mappedData.legalBusinessName || clinic.name || "clinic");

      // Ensure slug is valid
      if (!clinicSlug || clinicSlug.trim() === "") {
        throw new Error("Failed to generate valid clinic slug");
      }

      console.log("🏷️ Generated clinic slug:", clinicSlug);

      const clinicData = {
        id: clinic.id, // Include clinic ID for update
        owner_id: user.id,
        name: mappedData.legalBusinessName || `${user.email?.split("@")[0] || "User"}'s Clinic`,
        legal_business_name: mappedData.legalBusinessName || `${user.email?.split("@")[0] || "User"}'s Clinic`,
        dba_name: mappedData.dbaName,
        slug: clinicSlug, // Add the generated slug
        address: mappedData.clinicAddress,
        phone: mappedData.phoneNumber,
        email: mappedData.emailAddress || user.email,
        language: "en",
        business_hours: mappedData.businessHours,
        calendly_link: mappedData.calendlyLink || calendlyBookingLink || BOOKING_LINK,
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

      console.log("MainOnboarding clinicData:", clinicData);

      // Update clinic
      const updatedClinic = await updateClinic(clinicData);

      // Setup Mailgun domain after clinic update
      const clinicInfoData = allData["clinic-info"] || {};
      // Ensure all required fields are included
      const mailgunSetupData = {
        ...clinicInfoData,
        clinicName: mappedData.legalBusinessName,
        clinicType: mappedData.clinicType,
        primaryContactEmail: mappedData.emailAddress,
        clinicPhone: clinicInfoData.clinicPhone || mappedData.phoneNumber,
        businessAddress: mappedData.clinicAddress,
      };

      const mailgunResponse = await setupMailgunDomain(updatedClinic, mailgunSetupData, clinicSlug);

      if (mailgunResponse?.success && mailgunResponse.data) {
        await updateMailgunDomainSettings(updatedClinic.id, {
          domain: mailgunResponse?.data.domain,
          email: mailgunResponse.data.email,
        });
      } else {
        console.warn("Mailgun setup response missing or unsuccessful, skipping email settings save");
      }

      // Handle multiple document uploads to enhanced edge function
      const hasDocuments = mappedData.servicesDocumentPath || mappedData.pricingDocumentPath || mappedData.testimonialsDocumentPath;

      if (hasDocuments) {
        try {
          const formDataToSend = new FormData();
          const session = await getSupabaseSession();

          // Add basic fields
          formDataToSend.append("clinic_id", updatedClinic.id);
          formDataToSend.append("name", mappedData.legalBusinessName || "Assistant");

          // Generate clinic instructions with all collected data
          const clinicInstructions = generateClinicInstructions({
            name: mappedData.legalBusinessName || "",
            address: mappedData.clinicAddress || "",
            phone: mappedData.phoneNumber || "",
            email: mappedData.emailAddress || user.email || "",
            business_hours: mappedData.businessHoursText || "",
            calendly_link: mappedData.calendlyLink || "",
            tone_selector: mappedData.toneSelector || "professional",
            sentence_length: mappedData.sentenceLength || "medium",
            formality_level: mappedData.formalityLevel || "formal",
            has_uploaded_document: true,
          });

          formDataToSend.append("instructions", clinicInstructions);

          // Download and append files based on their document type
          if (mappedData.servicesDocumentPath) {
            const serviceFile = await getFileAsFile("Assistant-File", mappedData.servicesDocumentPath);
            if (serviceFile) {
              formDataToSend.append("service_document", serviceFile);
            }
          }

          if (mappedData.pricingDocumentPath) {
            const pricingFile = await getFileAsFile("Assistant-File", mappedData.pricingDocumentPath);
            if (pricingFile) {
              formDataToSend.append("pricing_document", pricingFile);
            }
          }

          if (mappedData.testimonialsDocumentPath) {
            const testimonialsFile = await getFileAsFile("Assistant-File", mappedData.testimonialsDocumentPath);
            if (testimonialsFile) {
              formDataToSend.append("testimonials_document", testimonialsFile);
            }
          }

          // Call the enhanced edge function
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formDataToSend,
          });

          const result = await response.json();

          if (!response.ok) {
            console.error("Assistant creation failed:", result.error);
            // Continue onboarding even if assistant creation fails
          } else {
            console.log("Assistant created successfully:", result);
            console.log(`✅ Assistant created with ${result.filesUploaded} documents: ${result.updatedDocumentTypes?.join(", ")}`);
          }
        } catch (error) {
          console.error("Failed to create assistant with documents:", error);
          // Continue onboarding even if assistant creation fails
        }
      }

      // Generate API key for the clinic
      const apiKeyName = `${mappedData.legalBusinessName} Primary Key`;
      await apiKeyService.create({
        name: apiKeyName,
        clinicId: updatedClinic.id,
      });

      // Setup Twilio phone number for cinic
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

      await handleCsvLeadsUpload(clinic.id);
      clearStoredProgress();

      SuccessToast("You're all set!");
      await fetch("/api/sendConfiramtionMail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: clinicData.legal_business_name,
          email: clinicData.email || user.email || "",
        }),
      });
      setIsOnboardingComplete(true);
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
        localStorage.clear();
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
      // case "tone-identity":
      //   return <ToneIdentityStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      // case "ai-assistant":
      //   return <AiAssistantStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "booking-setup":
        return <BookingSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      // case "chatbot-setup":
      //   return <ChatbotSetupStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      case "integrations":
        return <IntegrationsStep onNext={handleStepComplete} onPrev={handleStepPrevious} initialData={stepData} />;
      // case "billing":
      //   return <OnboardingSubscriptionStep onNext={handleStepComplete} />;

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
            <LoadingSpinner message="Setting up your clinic..." size="lg" />
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
