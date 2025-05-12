import { apiRequest } from "@/utils/apiRequest";
import { userRoutes } from "@/utils/routes";

const userService = {
  me: () => {
    return apiRequest({ url: userRoutes.me, method: "POST" });
  },
};

export default userService;
