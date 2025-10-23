import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { onboardingQueries, onboardingMutations } from "@/lib/queryFunctions";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

// Query hooks for onboarding data fetching
export const useOnboardingUser = () => {
  return useQuery({
    queryKey: queryKeys.onboarding.user(),
    queryFn: onboardingQueries.fetchUserData,
    staleTime: 10 * 60 * 1000, // 10 minutes - user data rarely changes during onboarding
    retry: 1, // Only retry once for user data
  });
};

export const useOnboardingClinic = () => {
  return useQuery({
    queryKey: queryKeys.onboarding.clinic(),
    queryFn: onboardingQueries.fetchClinicData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

export const useCalendlyLink = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.onboarding.calendlyLink(clinicId),
    queryFn: () => onboardingQueries.fetchCalendlyLink(clinicId),
    enabled: !!clinicId,
    staleTime: 15 * 60 * 1000, // 15 minutes - Calendly links don't change often
  });
};

export const useSubscriptionStatus = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.onboarding.subscription(clinicId),
    queryFn: () => onboardingQueries.fetchSubscriptionStatus(clinicId),
    enabled: !!clinicId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation hooks for onboarding actions
export const useUpdateClinic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: onboardingMutations.updateClinic,
    onSuccess: data => {
      // Invalidate and update clinic queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.clinic(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinic.all,
      });

      // Optionally update the cache directly
      queryClient.setQueryData(queryKeys.onboarding.clinic(), data);
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update clinic");
    },
  });
};

export const useSetupMailgun = () => {
  return useMutation({
    mutationFn: onboardingMutations.setupMailgunDomain,
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to setup Mailgun domain");
    },
  });
};

export const useUpdateMailgunSettings = () => {
  return useMutation({
    mutationFn: onboardingMutations.updateMailgunSettings,
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update Mailgun settings");
    },
  });
};

export const useCreateApiKey = () => {
  return useMutation({
    mutationFn: onboardingMutations.createApiKey,
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to create API key");
    },
  });
};

export const useSetupTwilio = () => {
  return useMutation({
    mutationFn: onboardingMutations.setupTwilio,
    onSuccess: () => {
      SuccessToast("Twilio setup completed successfully");
    },
    onError: (error: any) => {
      console.error("Twilio setup error:", error.message);
      // Don't show error toast for Twilio since it's not critical for onboarding
    },
  });
};

export const useCreateAssistant = () => {
  return useMutation({
    mutationFn: onboardingMutations.createAssistantWithDocuments,
    onSuccess: result => {
      console.log(`✅ Assistant created with ${result.filesUploaded} documents: ${result.updatedDocumentTypes?.join(", ")}`);
    },
    onError: (error: any) => {
      console.error("Failed to create assistant:", error.message);
      // Don't show error toast since assistant creation is not critical for onboarding flow
    },
  });
};

export const useSendConfirmationEmail = () => {
  return useMutation({
    mutationFn: onboardingMutations.sendConfirmationEmail,
    onError: (error: any) => {
      console.error("Failed to send confirmation email:", error.message);
      // Don't show error toast since this is not critical
    },
  });
};

// Combined mutation hook for complete onboarding flow
export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();

  const updateClinicMutation = useUpdateClinic();
  const setupMailgunMutation = useSetupMailgun();
  const updateMailgunSettingsMutation = useUpdateMailgunSettings();
  const createApiKeyMutation = useCreateApiKey();
  const setupTwilioMutation = useSetupTwilio();
  const createAssistantMutation = useCreateAssistant();
  const sendConfirmationEmailMutation = useSendConfirmationEmail();

  return useMutation({
    mutationFn: async (params: {
      clinicData: any;
      mailgunSetupData: any;
      slug: string;
      apiKeyName: string;
      assistantFormData?: FormData;
      subscriptionData: any;
      confirmationEmailData: any;
    }) => {
      const { clinicData, mailgunSetupData, slug, apiKeyName, assistantFormData, subscriptionData, confirmationEmailData } = params;

      // Step 1: Update clinic
      const updatedClinic = await updateClinicMutation.mutateAsync(clinicData);

      // Step 2: Setup Mailgun domain
      const mailgunResponse = await setupMailgunMutation.mutateAsync({
        clinicData: updatedClinic,
        formData: mailgunSetupData,
        slug,
      });

      // Step 3: Update Mailgun settings if successful
      if (mailgunResponse?.success && mailgunResponse.data) {
        await updateMailgunSettingsMutation.mutateAsync({
          clinicId: updatedClinic.id,
          domain: mailgunResponse.data.domain,
          email: mailgunResponse.data.email,
        });
      }

      // Step 4: Create assistant with documents (if provided)
      if (assistantFormData) {
        await createAssistantMutation.mutateAsync(assistantFormData);
      }

      // Step 5: Create API key
      await createApiKeyMutation.mutateAsync({
        name: apiKeyName,
        clinicId: updatedClinic.id,
      });

      // Step 6: Setup Twilio (if subscription allows)
      if (subscriptionData.canSetupTwilio) {
        await setupTwilioMutation.mutateAsync({
          clinicId: updatedClinic.id,
          phoneNumber: clinicData.phone,
          clinicName: clinicData.legal_business_name,
        });
      }

      // Step 7: Send confirmation email
      await sendConfirmationEmailMutation.mutateAsync(confirmationEmailData);

      return updatedClinic;
    },
    onSuccess: () => {
      SuccessToast("You're all set!");

      // Invalidate all relevant queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinic.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to complete onboarding");
    },
  });
};
