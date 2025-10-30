import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { staffQueries, staffMutations } from "@/lib/queryFunctions";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

// Query hooks for staff data fetching
export const useCurrentUserClinic = () => {
  return useQuery({
    queryKey: queryKeys.clinic.data(),
    queryFn: staffQueries.fetchCurrentUserClinic,
    staleTime: 10 * 60 * 1000, // 10 minutes - clinic ID doesn't change often
    retry: 1,
  });
};

export const useStaffList = (clinicId: string, page: number, pageSize: number) => {
  return useQuery({
    queryKey: queryKeys.staff.list(clinicId, page, pageSize),
    queryFn: () => staffQueries.fetchStaffList({ clinicId, page, pageSize }),
    enabled: !!clinicId,
    staleTime: 2 * 60 * 1000, // 2 minutes - staff data can change more frequently
    retry: 1,
  });
};

export const useStaffStats = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.staff.stats(clinicId),
    queryFn: () => staffQueries.fetchStaffStats(clinicId),
    enabled: !!clinicId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 1,
  });
};

// Mutation hooks for staff operations
export const useCreateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffMutations.createStaff,
    onSuccess: (data, variables) => {
      const successMessage = `Staff member created successfully! ${
        data.data?.emailSent
          ? `Login credentials have been sent to ${variables.email}`
          : `Please share the credentials manually: ${data.data?.tempPassword}`
      }`;
      SuccessToast(successMessage);

      // Invalidate staff-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.staff.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to create staff member");
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffMutations.updateStaff,
    onSuccess: () => {
      SuccessToast(`Staff member has been updated successfully.`);

      // Invalidate staff-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.staff.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to update staff member");
    },
  });
};

export const useDeleteStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: staffMutations.deleteStaff,
    onSuccess: () => {
      SuccessToast(`Staff member has been removed successfully.`);

      // Invalidate staff-related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.staff.all,
      });
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Failed to remove staff member");
    },
  });
};
