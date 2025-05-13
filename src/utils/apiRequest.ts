import { publicRoutes } from "@/constants";
import axios, { AxiosRequestConfig } from "axios";

export async function apiRequest(params: AxiosRequestConfig) {
  const { url, method = "GET", data = {}, withCredentials = true } = params;

  const config = {
    url,
    method,
    data,
    withCredentials,
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
