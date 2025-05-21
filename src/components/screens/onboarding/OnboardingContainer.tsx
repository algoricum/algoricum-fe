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
  clinic_document:File | null
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
