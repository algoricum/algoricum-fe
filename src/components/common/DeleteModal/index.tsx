import { Button } from "@/components/elements";
import { DeleteIcon } from "@/icons";
import { Flex, Modal } from "antd";
import { ReactNode } from "react";

interface DeleteModalProps {
  open: boolean;
  onConfirm: () => void;
  loading?: boolean;
  children?: ReactNode;
  handleCancel: () => void;
}

const DeleteModal = ({ open, onConfirm, loading, children, handleCancel }: DeleteModalProps) => {
  return (
    <Modal
      title={
        <Flex align="center" gap={8}>
          <DeleteIcon color="var(--color-danger)" />
          <span className="max-h-fit text-xl font-helvetica-700 mt-1 capitalize">Delete</span>
        </Flex>
      }
      open={open}
      onCancel={handleCancel}
      footer={() => (
        <>
          <Button className="border !border-Gray400 !bg-Gray100 !text-Gray900" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="!bg-danger hover:!opacity-85 hover:!bg-danger !border-none" onClick={onConfirm} loading={loading}>
            Confirm
          </Button>
        </>
      )}
    >
      <p className="font-helvetica">Are you sure you want to delete?</p>
      {children}
    </Modal>
  );
};

export default DeleteModal;
