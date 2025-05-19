"use client";
import { liveEnvironments } from "@/constants";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CreateClinicProps } from "@/interfaces/services_type";
import { Form } from "antd";
import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import { CreateWorkSpaceForm } from ".";
import { createClinic } from "@/utils/supabase/clinic-helper";

const WorkpacePage = () => {
  const [form] = Form.useForm();
  const { push } = useRouter();

  const isLive = liveEnvironments.includes(process.env.NEXT_PUBLIC_ENV || "");

  const { mutate, isLoading } = useMutation((data: CreateClinicProps) => createClinic(data), {
    onSuccess: (data: any) => {
      setCookie("clinic-id", data.clinic.id, {
        secure: isLive,
        sameSite: isLive ? "none" : "lax",
      });
      SuccessToast("Clinic Created  successfully");
      push("/content/articles");
    },
    onError: (error: any) => {
      ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while creating clinic");
    },
  });

  return <CreateWorkSpaceForm form={form} mutate={mutate} isLoading={isLoading} />;
};

export default WorkpacePage;
