import { Modal } from "@/components/common";
import { Button } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import SetupService from "@/services/setup";

import { Flex, Form, Typography } from "antd";
import React from "react";
import { useMutation } from "react-query";

const { Text } = Typography;
interface RevokeModalProps {
  handleClose: () => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refetch?: () => void;
  id: string;
}

const RevokeModal = ({ id, refetch, handleClose, open, setOpen }: RevokeModalProps) => {
  const [form] = Form.useForm();
  const { mutate: mutateRevoke, isLoading: isLoadingRevoke } = useMutation(
    ["RevokeSecretKey", id],
    () => SetupService.RevokeSecretKey(id),
    {
      onSuccess: () => {
        setOpen(false);
        handleClose();
        refetch?.();

        SuccessToast("Secret Key Deleted successfully");
      },
      onError: (error: any) => {
        ErrorToast(
          error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred while Deleting secret  key",
        );
      },
    },
  );

  const onFinishRevoke = () => {
    mutateRevoke();
  };

  return (
    <Modal maskClosable={false} onCancel={handleClose} open={open} title="Revoke secret key">
      <Form form={form} name="revokeForm" onFinish={onFinishRevoke}>
        <Text>Are you sure you want to revoke this secret key?</Text>
        <Flex justify="flex-end" gap={10}>
          <Form.Item>
            <Button onClick={handleClose} className="w-fit border !border-Gray400 !bg-Gray100 !text-Gray900" type="default">
              Cancel
            </Button>
          </Form.Item>
          <Form.Item>
            <Button
              htmlType="submit"
              loading={isLoadingRevoke}
              type="primary"
              className="!bg-danger hover:!opacity-85 hover:!bg-danger !border-none"
            >
              Revoke Key
            </Button>
          </Form.Item>
        </Flex>
      </Form>
    </Modal>
  );
};

export default RevokeModal;
