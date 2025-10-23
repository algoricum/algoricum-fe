import { QueryClient } from "@tanstack/react-query";

// Create a client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 5 minutes - increased for better caching
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false, // Don't refetch on component mount if data is fresh
      refetchInterval: false, // Disable polling by default
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
});
