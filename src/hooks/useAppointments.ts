import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { appointmentsQueries, appointmentsMutations } from "@/lib/queryFunctions";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

// Query hooks for appointments data fetching
export const useCurrentUserClinic = () => {
  return useQuery({
    queryKey: queryKeys.clinic.data(),
    queryFn: appointmentsQueries.fetchCurrentUserClinic,
    staleTime: 10 * 60 * 1000, // 10 minutes - clinic ID doesn't change often
    retry: 1,
  });
};

export const useAppointmentsList = (clinicId: string, page: number, pageSize: number) => {
  return useQuery({
    queryKey: queryKeys.appointments.list(clinicId, page, pageSize),
    queryFn: () => appointmentsQueries.fetchAppointmentsList({ clinicId, page, pageSize }),
    enabled: !!clinicId,
    staleTime: 2 * 60 * 1000, // 2 minutes - appointments can change frequently
    retry: 1,
  });
};

export const useAppointmentStats = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.appointments.stats(clinicId),
    queryFn: () => appointmentsQueries.fetchAppointmentStats(clinicId),
    enabled: !!clinicId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 1,
  });
};

// Mutation hooks for appointments operations
export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: appointmentsMutations.createAppointment,
    onSuccess: () => {
      SuccessToast("Meeting schedule saved successfully!");

      // Invalidate appointments-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all,
      });

      // Also invalidate dashboard leads since appointments create leads
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to save meeting schedule");
    },
  });
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: appointmentsMutations.updateAppointment,
    onSuccess: () => {
      SuccessToast("Appointment updated successfully!");

      // Invalidate appointments-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update appointment");
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: appointmentsMutations.deleteAppointment,
    onSuccess: () => {
      SuccessToast("Appointment deleted successfully!");

      // Invalidate appointments-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to delete appointment");
    },
  });
};
