import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { billingQueries, billingMutations } from "@/lib/queryFunctions";
import { ErrorToast } from "@/helpers/toast";

// Query hooks for billing data fetching
export const useCurrentUserClinic = () => {
  return useQuery({
    queryKey: queryKeys.clinic.data(),
    queryFn: billingQueries.fetchCurrentUserClinic,
    staleTime: 10 * 60 * 1000, // 10 minutes - clinic data doesn't change often
    retry: 1,
  });
};

export const useSubscription = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.billing.subscription(clinicId),
    queryFn: () => billingQueries.fetchSubscription(clinicId),
    enabled: !!clinicId,
    staleTime: 2 * 60 * 1000, // 2 minutes - subscription can change
    retry: 1,
  });
};

export const useSubscriptionEvents = (subscriptionId: string) => {
  return useQuery({
    queryKey: queryKeys.billing.events(subscriptionId),
    queryFn: () => billingQueries.fetchSubscriptionEvents(subscriptionId),
    enabled: !!subscriptionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - events don't change often
    retry: 1,
  });
};

export const usePlans = () => {
  return useQuery({
    queryKey: queryKeys.billing.plans(),
    queryFn: billingQueries.fetchPlans,
    staleTime: 15 * 60 * 1000, // 15 minutes - plans rarely change
    retry: 1,
  });
};

export const useInvoices = (clinicId: string) => {
  return useQuery({
    queryKey: queryKeys.billing.invoices(clinicId),
    queryFn: () => billingQueries.fetchInvoices(clinicId),
    enabled: !!clinicId,
    staleTime: 5 * 60 * 1000, // 5 minutes - invoices don't change often
    retry: 1,
  });
};

// Mutation hooks for billing operations
export const useCreateCheckoutSession = () => {
  return useMutation({
    mutationFn: billingMutations.createCheckoutSession,
    onSuccess: data => {
      // Redirect to checkout URL
      window.location.href = data.url;
    },
    onError: (error: any) => {
      ErrorToast(error.message || "Something went wrong while starting the subscription.");
    },
  });
};
