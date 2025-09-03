"use client";
import { Button, Input } from "@/components/elements";
import { CreateClinicProps } from "@/interfaces/services_type";
import { Flex, Form } from "antd";

interface CreateWorkSpaceProps {
  form: any;
   
  mutate: (values: CreateClinicProps) => void;
  isLoading: boolean;
}
const CreateWorkSpaceForm = ({ form, mutate, isLoading }: CreateWorkSpaceProps) => {
  const onFinish = (values: CreateClinicProps) => {
    mutate(values);
  };
  return (
    <Flex className="w-full">
      <Form
        form={form}
        name="clinic"
        layout="vertical"
        className="w-full flex flex-col gap-9"
        initialValues={{ remember: true }}
        onFinish={onFinish}
      >
        <Form.Item name="name" label="Clinic Name" rules={[{ required: true, message: "Please input  the WorkSpace!" }]}>
          <Input className="w-full" placeholder="clinic name" />
        </Form.Item>

        <Form.Item>
          <Button loading={isLoading} className="w-full" htmlType="submit">
            Save and Continue
          </Button>
        </Form.Item>
      </Form>
    </Flex>
  );
};

export default CreateWorkSpaceForm;
