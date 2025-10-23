import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { userQueries } from "@/lib/queryFunctions";

// Query hook for current user
export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.user.current(),
    queryFn: userQueries.fetchCurrentUser,
    staleTime: 10 * 60 * 1000, // 10 minutes - user data doesn't change often
    retry: 1,
  });
};
