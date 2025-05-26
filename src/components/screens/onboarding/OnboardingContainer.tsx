"use client"

import { useState, useEffect } from "react"

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

const ONBOARDING_STORAGE_KEY = 'clinic_onboarding_progress'
const ONBOARDING_STEP_KEY = 'clinic_onboarding_step'

const OnboardingContainer = () => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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

  // Helper function to check if we're in browser environment
  const isBrowser = typeof window !== 'undefined'

  // Helper function to safely access localStorage
  const getStoredData = (key: string) => {
    if (!isBrowser) return null
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return null
    }
  }

  // Helper function to safely store in localStorage
  const setStoredData = (key: string, data: any) => {
    if (!isBrowser) return
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }

  // Helper function to clear stored onboarding data
  const clearStoredProgress = () => {
    if (!isBrowser) return
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY)
      localStorage.removeItem(ONBOARDING_STEP_KEY)
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }

  // Load saved progress on component mount
  useEffect(() => {
    if (!isBrowser) {
      setIsLoading(false)
      return
    }

    const loadSavedProgress = () => {
      try {
        // Load saved form data
        const savedData = getStoredData(ONBOARDING_STORAGE_KEY)
        const savedStep = getStoredData(ONBOARDING_STEP_KEY)

        if (savedData) {
          // Merge saved data with defaults, excluding file fields
          const restoredData = {
            ...savedData,
            logo: null, // Files can't be stored in localStorage
            clinic_document: null, // Files can't be stored in localStorage
            businessHours: savedData.businessHours || defaultBusinessHours
          }
          setFormData(restoredData)
        }

        if (savedStep && savedStep >= 1 && savedStep <= 3) {
          setCurrentStep(savedStep)
        }
      } catch (error) {
        console.error('Error loading saved progress:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedProgress()
  }, [])

  // Save progress whenever formData or currentStep changes
  useEffect(() => {
    if (!isLoading && isBrowser) {
      // Create a copy of formData without file objects for storage
      const dataToStore = {
        ...formData,
        logo: null, // Files can't be stored in localStorage
        clinic_document: null // Files can't be stored in localStorage
      }
      
      setStoredData(ONBOARDING_STORAGE_KEY, dataToStore)
      setStoredData(ONBOARDING_STEP_KEY, currentStep)
    }
  }, [formData, currentStep, isLoading])

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
              const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
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

        // Clear stored progress after successful completion
        clearStoredProgress();

        SuccessToast("You're all set!");
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

  // Show loading state while restoring data
  if (isLoading) {
    return (
      <OnboardingLayout currentStep={currentStep}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your progress...</p>
          </div>
        </div>
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout currentStep={currentStep}>
      {/* Progress restoration notification */}
      {isBrowser && getStoredData(ONBOARDING_STORAGE_KEY) && currentStep > 1 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></div>
            <p className="text-sm text-blue-800">
              <strong>Welcome back!</strong> We've restored your progress from where you left off.
            </p>
          </div>
        </div>
      )}

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
