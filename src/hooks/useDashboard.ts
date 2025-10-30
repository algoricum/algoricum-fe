import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { dashboardQueries, clinicQueries, integrationQueries } from "@/lib/queryFunctions";

// Hook for fetching leads data
export const useLeads = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.dashboard.leads(clinicId),
    queryFn: () => dashboardQueries.fetchLeads(clinicId),
    enabled: !!clinicId,
    staleTime: 3 * 60 * 1000, // 3 minutes - leads data changes frequently
  });
};

// Hook for fetching tasks
export const useTasks = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.dashboard.tasks(clinicId),
    queryFn: () => dashboardQueries.fetchTasks(clinicId),
    enabled: !!clinicId,
    staleTime: 2 * 60 * 1000, // 2 minutes - tasks change frequently
  });
};

// Hook for fetching integration statuses
export const useIntegrationStatuses = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.integrations.statuses(clinicId),
    queryFn: () => dashboardQueries.fetchIntegrationStatuses(clinicId),
    enabled: !!clinicId,
    staleTime: 10 * 60 * 1000, // 10 minutes - integration status changes less frequently
  });
};

// Hook for fetching lead metrics
export const useLeadMetrics = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.dashboard.leadMetrics(clinicId),
    queryFn: () => dashboardQueries.fetchLeadMetrics(clinicId),
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching clinic data
export const useClinicData = () => {
  return useQuery({
    queryKey: queryKeys.clinic.data(),
    queryFn: clinicQueries.fetchClinicData,
    staleTime: 15 * 60 * 1000, // 15 minutes - clinic data rarely changes
  });
};

// Hook for fetching Twilio config
export const useTwilioConfig = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.clinic.twilio(clinicId),
    queryFn: () => clinicQueries.fetchTwilioConfig(clinicId),
    enabled: !!clinicId,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Hook for adding a task (mutation)
export const useAddTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: {
      clinic_id: string;
      task: string;
      priority: string;
      time: string;
      due_at: string;
      completed: boolean;
      is_automated: boolean;
    }) => {
      const { createClient } = await import("@/utils/supabase/config/client");
      const supabase = createClient();

      const { error } = await supabase.from("tasks").insert(taskData);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch tasks for this clinic
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.tasks(variables.clinic_id),
      });
    },
  });
};

// Hook for toggling a task (mutation)
export const useToggleTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { taskId: string; completed: boolean; clinicId: string }) => {
      const { createClient } = await import("@/utils/supabase/config/client");
      const supabase = createClient();

      const { error } = await supabase.from("tasks").update({ completed: data.completed }).eq("id", data.taskId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch tasks for this clinic
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.tasks(variables.clinicId),
      });
    },
  });
};

// Hook for fetching integrations with status
export const useIntegrationsWithStatus = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.integrations.withStatus(clinicId),
    queryFn: () => integrationQueries.fetchIntegrationsWithStatus(clinicId),
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000, // 5 minutes - integration status changes less frequently
  });
};
