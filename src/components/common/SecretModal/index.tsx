"use client";
import { Button, Input } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CreateSecretKeyProps } from "@/interfaces/services_type";
import SetupService from "@/services/setup";
import { Flex, Form, Typography } from "antd";
import { useState } from "react";
import { useMutation } from "react-query";
import Modal from "../Modal";
const { Text } = Typography;

interface SecretFormProps {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  setOpen: (open: boolean) => void;
  refetch: () => void;
}
const SecretModal = ({ refetch, setOpen, open }: SecretFormProps) => {
  const [form] = Form.useForm();
  const [formStep, setFormStep] = useState("create");

  const { mutate: mutateSecretKey, isLoading: isLoadingSecret } = useMutation(
    "createSecretKey",
    (data: CreateSecretKeyProps) => SetupService.createSecretKey(data),
    {
      onSuccess: (data: any) => {
        form.setFieldValue("secretKey", data?.api_key);
        setFormStep("copy");
        refetch?.();
        SuccessToast("Secret Key Created successfully");
      },
      onError: (error: any) => {
        ErrorToast(
          error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while creating secret  key",
        );
      },
    },
  );

  const handleClose = () => {
    form.resetFields();
    setFormStep("create");
    setOpen(false);
  };

  function onFinish(values: CreateSecretKeyProps) {
    mutateSecretKey(values);
  }

  return (
    <Modal maskClosable={false} onCancel={handleClose} open={open} title="Create new secret key">
      <Form
        form={form}
        onFinish={onFinish}
        requiredMark={"optional"}
        name="secretForm"
        layout="vertical"
        className="w-full flex flex-col gap-5"
      >
        {formStep == "create" ? (
          <Form.Item name="name" rules={[{ required: true, message: "Please input your Secret Key name" }]}>
            <Input className="w-full h-8" placeholder="Enter the Secret Key Name" />
          </Form.Item>
        ) : (
          formStep === "copy" && (
            <Flex gap={10} align="flex-end">
              <Form.Item required name="secretKey" label="This Secret Key Is Visible Only Once—Please Save It Carefully">
                <Input className="w-full h-8" placeholder="Secret Key" readOnly />
              </Form.Item>
              <Form.Item name="copy_btn">
                <Text className="custom-copy" copyable={{ text: form.getFieldValue("secretKey") }}></Text>
              </Form.Item>
            </Flex>
          )
        )}
        <Flex justify="end" gap={5}>
          <Form.Item>
            <Button
              onClick={handleClose}
              htmlType="button"
              type="primary"
              className="w-fit border !border-Gray400 !bg-Gray100 !text-Gray900"
            >
              Cancel
            </Button>
          </Form.Item>
          {formStep == "create" && (
            <Form.Item>
              <Button loading={isLoadingSecret} htmlType="submit">
                Create Secret Key
              </Button>
            </Form.Item>
          )}
        </Flex>
      </Form>
    </Modal>
  );
};

export default SecretModal;
