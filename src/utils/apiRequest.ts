import { publicRoutes } from "@/constants";
import { store } from "@/redux/store";
import axios, { AxiosRequestConfig } from "axios";

export async function apiRequest(params: AxiosRequestConfig) {
  const { url, method = "GET", data = {}, withCredentials = true } = params;
  const clinicId = store.getState()?.clinic?.clinic?.id;

  const config = {
    url,
    method,
    data,
    withCredentials,
    headers: {
      "clinic-id": clinicId,
    },
  };

  const isPublic = publicRoutes.some(route => route === window.location.pathname);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 401 && !isPublic) {
      window.location.href = "/login";
    }
    throw error;
  }
}
