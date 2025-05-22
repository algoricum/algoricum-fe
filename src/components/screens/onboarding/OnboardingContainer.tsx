"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"
import OnboardingLayout from "./OnboardingLayout"
import Step1ClinicInfo from "./Step1ClinicInfo"
import Step2ContactInfo from "./Step2ContactInfo"
import Step3BrandConfig from "./Step3BrandConfig"
import { ErrorToast, SuccessToast } from "@/helpers/toast"
import apiKeyService from "@/services/apiKey"
import { BusinessHours } from "@/interfaces/services_type"
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads"
import { createClinic } from "@/utils/supabase/clinic-helper"
import { getUserData } from "@/utils/supabase/user-helper"
import generateClinicInstructions from "@/utils/generateClinicInstructions"
import { getSupabaseSession } from "@/utils/supabase/auth-helper"


export interface OnboardingData {
  // Step 1
  legalBusinessName: string
  dbaName: string
  clinicAddress: string
  businessHours: BusinessHours

  // Step 2
  fullName: string
  emailAddress: string
  phoneNumber: string
  calendlyLink: string

  // Step 3
  logo: File | null
  tone_selector: string
  sentence_length: string
  formality_level: string
  clinic_document: File | null
}

const defaultBusinessHours: BusinessHours = {
  Monday: { isOpen: true, openTime: "9:00 AM", closeTime: "10:00 PM" },
  Tuesday: { isOpen: true, openTime: "9:00 AM", closeTime: "10:00 PM" },
  Wednesday: { isOpen: true, openTime: "9:00 AM", closeTime: "10:00 PM" },
  Thursday: { isOpen: true, openTime: "9:00 AM", closeTime: "10:00 PM" },
  Friday: { isOpen: true, openTime: "9:00 AM", closeTime: "10:00 PM" },
  Saturday: { isOpen: false, openTime: "", closeTime: "" },
  Sunday: { isOpen: false, openTime: "", closeTime: "" },
}

const OnboardingContainer = () => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<OnboardingData>({
    // Step 1
    legalBusinessName: "",
    dbaName: "",
    clinicAddress: "",
    businessHours: defaultBusinessHours,

    // Step 2
    fullName: "",
    emailAddress: "",
    phoneNumber: "",
    calendlyLink: "",

    // Step 3
    logo: null,
    tone_selector: "",
    sentence_length: "",
    formality_level: "",
    clinic_document: null,
  })

  const updateFormData = (data: Partial<OnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1)
    } else {
      // Submit the form data
      handleCompleteOnboarding()
    }
  }
  // Import the instruction generator at the top of your file

  // Updated handleCompleteOnboarding function
  const handleCompleteOnboarding = async () => {
    if (currentStep === 3) {
      try {
        setIsSubmitting(true);

        // Get current user
        const user = await getUserData();
        if (!user) {
          ErrorToast("User not found. Please logout and log in again.");
          setIsSubmitting(false);
          return;
        }

        // First, upload the logo if provided
        let logoUrl = undefined;
        if (formData.logo) {
          logoUrl = await uploadClinicLogo(user.id, formData.logo);
        }

        const clinicData = {
          // Map form fields to database fields
          name: formData.legalBusinessName, // Use legal business name as primary name
          legal_business_name: formData.legalBusinessName,
          dba_name: formData.dbaName,
          address: formData.clinicAddress,
          phone: formData.phoneNumber,
          email: formData.emailAddress || user.email,
          language: "en", // Default language or add language selection in your form
          owner_id: user.id,
          business_hours: formData.businessHours,
          calendly_link: formData.calendlyLink,
          logo: logoUrl,

          // Brand settings
          tone_selector: formData.tone_selector,
          sentence_length: formData.sentence_length,
          formality_level: formData.formality_level,

          // Keeping existing theming structure but could merge with new branding fields
          widget_theme: {
            primary_color: "#2563EB",
            font_family: "Inter, sans-serif",
            border_radius: "8px"
          },
          dashboard_theme: {
            primary_color: "#2563EB"
          }
        };

        // Create clinic (this will also create the clinic-user relationship)
        const clinic = await createClinic(clinicData);

        // Generate API key for the clinic
        const apiKeyName = `${formData.legalBusinessName} Primary Key`;
        await apiKeyService.create({
          name: apiKeyName,
          clinicId: clinic.id
        });

        // Now handle document upload and assistant creation if we have a clinic ID
        if (clinic.id && formData.clinic_document) {
          // Check if we have a document
          const hasDocument = !!formData.clinic_document;

          if (hasDocument) {
            // Prepare form data for the edge function
            const formDataToSend = new FormData();
            formDataToSend.append('clinic_document', formData.clinic_document);
            formDataToSend.append('clinic_id', clinic.id);
            formDataToSend.append('name', formData.legalBusinessName);
            formDataToSend.append('description', `AI Assistant for ${formData.legalBusinessName}`);

            // Generate customized instructions based on clinic settings
            const clinicInstructions = generateClinicInstructions({
              name: formData.legalBusinessName,
              address: formData.clinicAddress,
              phone: formData.phoneNumber,
              email: formData.emailAddress || user.email,
              business_hours: formData.businessHours,
              calendly_link: formData.calendlyLink,
              tone_selector: formData.tone_selector,
              sentence_length: formData.sentence_length,
              formality_level: formData.formality_level,
              has_uploaded_document: true
            });

            formDataToSend.append('instructions', clinicInstructions);
            formDataToSend.append('model', 'gpt-3.5-turbo');
            formDataToSend.append('tools', JSON.stringify([{ type: "file_search" }]));

            // Get the token for authorization
             const session =  await getSupabaseSession()

            if (!session.access_token) {
              throw new Error("Not authenticated");
            }

            try {
              // Call the combined edge function
              const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-assistant-with-files`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: formDataToSend,
              });

              const result = await response.json();

              if (!response.ok) {
                console.error("Assistant creation error:", result.error);
                // We'll still continue with the onboarding process even if assistant creation fails
              }
            } catch (assistantError) {
              console.error("Failed to create assistant:", assistantError);
              // Continue with onboarding even if assistant creation fails
            }
          }
        }

        SuccessToast("Clinic created successfully!");
        setTimeout(() => {
          router.push('/dashboard?onboarding=success');
        }, 2000);
      } catch (error: any) {
        ErrorToast(error.message || "Failed to create clinic");
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <OnboardingLayout currentStep={currentStep}>
      {currentStep === 1 && (
        <Step1ClinicInfo formData={formData} updateFormData={updateFormData} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === 2 && (
        <Step2ContactInfo formData={formData} updateFormData={updateFormData} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === 3 && (
        <Step3BrandConfig
          formData={formData}
          updateFormData={updateFormData}
          isSubmitting={isSubmitting}
          onComplete={handleNext}
          onBack={handleBack}
        />
      )}
    </OnboardingLayout>
  )
}

export default OnboardingContainer
