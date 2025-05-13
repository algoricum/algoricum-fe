"use client";
import { Modal, TextArea } from "@/components/common";
import { Button, Input } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CreateSectionProps } from "@/interfaces/services_type";
import { Section } from "@/redux/models/section_modal";
import SectionService from "@/services/section";
import { Flex, Form } from "antd";
import { useMutation } from "react-query";

interface AddSectionProps {
  open: boolean;
  handleCancel: () => void;
  section?: Section;
  refetch?: () => void;
}

const AddSectionModal = ({ open, section, handleCancel, refetch }: AddSectionProps) => {
  const [form] = Form.useForm();

  const { mutate: sectionCreateMutate, isLoading: isSectionLoading } = useMutation(
    "createSection",
    (sectionData: CreateSectionProps) => SectionService.createSection(sectionData),
    {
      onSuccess: () => {
        handleCancel();
        SuccessToast("Section Created successfully");
        refetch?.();
      },
      onError: (error: any) => {
        ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred Creating Section");
      },
    },
  );

  const { mutate: sectionEditMutate, isLoading: isEditSectionLoading } = useMutation(
    "EditSection",
    (sectionData: CreateSectionProps) => SectionService.editSection(sectionData, section?.id || ""),
    {
      onSuccess: () => {
        handleCancel();
        SuccessToast("Section Edit successfully");
        refetch?.();
      },
      onError: (error: any) => {
        ErrorToast(error?.response?.data?.detail[0]?.msg || error?.response?.data?.detail || "An error occurred Editing Section");
      },
    },
  );

  const onFinish = (values: CreateSectionProps) => {
    if (section?.id) {
      sectionEditMutate(values);
    } else sectionCreateMutate(values);
  };

  return (
    <Modal title={section?.id ? "Edit New Section" : "Create New Section"} open={open} onCancel={handleCancel}>
      <Form<CreateSectionProps>
        layout="vertical"
        form={form}
        name="sectionForm"
        className="w-full flex flex-col gap-3"
        initialValues={{ ...section }}
        onFinish={onFinish}
      >
        <Form.Item rules={[{ required: true, message: "Please input the section name" }]} label="Section Name" name="title">
          <Input className="w-full" placeholder="Enter section name" />
        </Form.Item>
        <Form.Item label="Description" name="description" rules={[{ required: true, message: "Please input the  description" }]}>
          <TextArea className="border hover:!border-Primary1000" placeholder="Enter section description" />
        </Form.Item>
        <Flex justify="end" gap={8}>
          <Button
            onClick={handleCancel}
            disabled={isSectionLoading || isEditSectionLoading}
            className="w-fit border !border-Gray400 !bg-Gray100 !text-Gray900"
            type="primary"
            htmlType="button"
          >
            Cancel
          </Button>
          <Button loading={isSectionLoading || isEditSectionLoading} className="w-fit" type="primary" htmlType="submit">
            {section?.id ? "Edit Section" : "Create Section"}
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
};

export default AddSectionModal;
