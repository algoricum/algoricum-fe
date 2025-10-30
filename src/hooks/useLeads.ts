import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { leadsQueries, leadsMutations } from "@/lib/queryFunctions";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

// Query hooks for leads data fetching
export const useCurrentUserClinic = () => {
  return useQuery({
    queryKey: queryKeys.clinic.data(),
    queryFn: leadsQueries.fetchCurrentUserClinic,
    staleTime: 10 * 60 * 1000, // 10 minutes - clinic ID doesn't change often
    retry: 1,
  });
};

export const useLeadsList = (clinicId: string, page: number, pageSize: number) => {
  return useQuery({
    queryKey: queryKeys.leads.list(clinicId, page, pageSize),
    queryFn: () => leadsQueries.fetchLeadsList({ clinicId, page, pageSize }),
    enabled: !!clinicId,
    staleTime: 2 * 60 * 1000, // 2 minutes - leads can change frequently
    retry: 1,
  });
};

export const useLeadStats = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.leads.stats(clinicId),
    queryFn: () => leadsQueries.fetchLeadStats(clinicId),
    enabled: !!clinicId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 1,
  });
};

export const useLeadMessages = (leadId: string, clinicId: string, threadId?: string) => {
  return useQuery({
    queryKey: queryKeys.leads.messages(leadId, clinicId),
    queryFn: () => leadsQueries.fetchLeadMessages({ leadId, clinicId, threadId }),
    enabled: !!leadId && !!clinicId,
    staleTime: 30 * 1000, // 30 seconds - messages should be fresh
    retry: 1,
  });
};

// Mutation hooks for leads operations
export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadsMutations.createLead,
    onSuccess: (_, variables) => {
      SuccessToast("Lead created successfully!");

      // Invalidate all leads-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all,
      });

      // Invalidate specific clinic leads if we have the clinic ID
      if (variables.clinic_id) {
        // Invalidate all leads list queries for this clinic (all pages)
        queryClient.invalidateQueries({
          queryKey: queryKeys.leads.all,
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.leads.stats(variables.clinic_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.leads(variables.clinic_id),
        });
      }

      // Invalidate dashboard queries since leads appear there
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });

      // Also invalidate integrations queries since they might affect lead counts
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });

      console.log("Lead created - invalidated queries for clinic:", variables.clinic_id);
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to create lead");
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadsMutations.updateLead,
    onSuccess: (_, variables) => {
      SuccessToast("Lead updated successfully!");

      // Invalidate all leads-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all,
      });

      // Invalidate specific lead by ID
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.byId(variables.leadId),
      });

      // Also invalidate dashboard since leads appear there
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update lead");
    },
  });
};

export const useUpdateLeadStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadsMutations.updateLeadStatus,
    onSuccess: () => {
      SuccessToast("Lead updated successfully!");

      // Invalidate leads-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all,
      });

      // Also invalidate dashboard since leads appear there
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update lead");
    },
  });
};

export const useSendMessageToLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadsMutations.sendMessageToLead,
    onSuccess: (_, variables) => {
      SuccessToast("Message sent successfully!");

      // Invalidate messages for this specific lead
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.messages(variables.leadId, variables.clinicId),
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to send message");
    },
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadsMutations.deleteLead,
    onSuccess: (_, variables) => {
      SuccessToast("Lead deleted successfully!");

      // Invalidate all leads-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all,
      });

      // Invalidate specific clinic leads if we have the clinic ID
      if (variables.clinicId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.leads.all,
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.leads.stats(variables.clinicId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.leads(variables.clinicId),
        });
      }

      // Invalidate dashboard queries since leads appear there
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });

      // Also invalidate integrations queries since they might affect lead counts
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.all,
      });

      console.log("Lead deleted - invalidated queries for clinic:", variables.clinicId);
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to delete lead");
    },
  });
};
