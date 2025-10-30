"use client";
import { liveEnvironments } from "@/constants";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CreateClinicProps } from "@/interfaces/services_type";
import { createClinic } from "@/utils/supabase/clinic-helper";
import { useMutation } from "@tanstack/react-query";
import { Form } from "antd";
import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { CreateWorkSpaceForm } from ".";

const WorkpacePage = () => {
  const [form] = Form.useForm();
  const { push } = useRouter();

  const isLive = liveEnvironments.includes(process.env.NEXT_PUBLIC_ENV || "");

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateClinicProps) => createClinic(data),
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

  return <CreateWorkSpaceForm form={form} mutate={mutate} isLoading={isPending} />;
};

export default WorkpacePage;
