import { toast } from "react-toastify";

export const SuccessToast = (message: string) => {
  return toast.success(message || "Successfull");
};

export const ErrorToast = (message: string) => {
  return toast.error(message || "Error");
};
