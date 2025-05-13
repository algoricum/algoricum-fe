import { Modal as AntdModal, ModalProps, Typography } from "antd";

const { Text } = Typography;

const Modal = (props: ModalProps) => {
  const { children, className, title, ...modalProps } = props;
  return (
    <AntdModal title={<Text className="text-lg">{title}</Text>} className={`rounded-xl	 ${className}`} {...modalProps} footer={null}>
      {children}
    </AntdModal>
  );
};

export default Modal;
