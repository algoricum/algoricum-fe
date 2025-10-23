import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { settingsQueries, settingsMutations } from "@/lib/queryFunctions";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

// Query hooks for settings data fetching
export const useClinicSettings = () => {
  return useQuery({
    queryKey: queryKeys.settings.clinic(),
    queryFn: settingsQueries.fetchClinicSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes - clinic settings don't change often
    retry: 1,
  });
};

export const useTwilioPhoneNumber = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.settings.twilioPhone(clinicId),
    queryFn: () => settingsQueries.fetchTwilioPhoneNumber(clinicId),
    enabled: !!clinicId,
    staleTime: 10 * 60 * 1000, // 10 minutes - Twilio config changes rarely
  });
};

export const useChatbotSettings = () => {
  return useQuery({
    queryKey: queryKeys.settings.chatbot(),
    queryFn: settingsQueries.fetchChatbotSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

// Mutation hooks for settings updates
export const useUpdateClinicSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settingsMutations.updateClinicSettings,
    onSuccess: data => {
      SuccessToast("Clinic settings updated successfully!");

      // Invalidate and update clinic-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.clinic(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinic.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.clinic(),
      });

      // Optionally update the cache directly
      queryClient.setQueryData(queryKeys.settings.clinic(), data);
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update clinic settings");
    },
  });
};

export const useUploadClinicLogo = () => {
  return useMutation({
    mutationFn: settingsMutations.uploadClinicLogo,
    onSuccess: () => {
      SuccessToast("Logo uploaded successfully!");
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to upload logo");
    },
  });
};

export const useUpdateClinicWithLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settingsMutations.updateClinicWithLogo,
    onSuccess: data => {
      SuccessToast("Clinic settings and logo updated successfully!");

      // Invalidate all clinic-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.clinic(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinic.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.clinic(),
      });

      // Update the cache directly
      queryClient.setQueryData(queryKeys.settings.clinic(), data);
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update clinic settings");
    },
  });
};

// Combined mutation for updating clinic settings with optional logo upload
export const useUpdateClinicComplete = () => {
  const uploadLogoMutation = useUploadClinicLogo();
  const updateClinicMutation = useUpdateClinicWithLogo();

  return useMutation({
    mutationFn: async (params: { clinicData: any; logoFile?: File; userId?: string }) => {
      const { clinicData, logoFile, userId } = params;

      let logoPath: string | undefined;

      // Upload logo if provided
      if (logoFile && userId) {
        logoPath = await uploadLogoMutation.mutateAsync({
          file: logoFile,
          userId,
        });
      }

      // Update clinic with or without logo
      return await updateClinicMutation.mutateAsync({
        clinicData,
        logoPath,
      });
    },
    onSuccess: () => {
      // Success messages are handled by individual mutations
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update clinic");
    },
  });
};
