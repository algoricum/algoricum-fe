import { CreateSecretKeyProps } from "@/interfaces/services_type";
import { apiRequest } from "@/utils/apiRequest";
import { setupRoutes } from "@/utils/routes";

const SetupService = {
  createSecretKey: (data: CreateSecretKeyProps) => {
    return apiRequest({ url: setupRoutes.createSecretKey, method: "POST", data });
  },
  fetchSecretKeys: (page: number, pageSize: number) => {
    return apiRequest({ url: setupRoutes.fetchSecretKeys(page, pageSize), method: "GET" });
  },
  RevokeSecretKey: (id: string) => {
    return apiRequest({ url: setupRoutes.revokeSecretKey(id), method: "Delete" });
  },
};

export default SetupService;
