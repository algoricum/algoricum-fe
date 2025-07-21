import { toast } from "react-toastify";

export const SuccessToast = (message: string) => {
  return toast.success(message || "Successfull");
};

export const ErrorToast = (message: string) => {
  return toast.error(message || "Error");
};


export const InfoToast = (message: string) => {
  return toast.info(message || "Info");
};

export const WarningToast = (message: string) => {
  return toast.warning(message || "Warning");
};