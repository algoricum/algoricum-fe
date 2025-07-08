"use client";

import { Modal, Form, Input, Select, Button } from "antd";
import { useState } from "react";

// Use this in parent too if needed
export interface StaffFormValues {
  name: string;
  email: string;
  role: string;
  password: string;
}

interface AddStaffModalProps {
  open: boolean;
  onCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (values: StaffFormValues) => void; // ✅ replaced `any` with StaffFormValues
}

const AddStaffModal = ({ open, onCancel, onSubmit }: AddStaffModalProps) => {
  const [form] = Form.useForm<StaffFormValues>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: StaffFormValues) => {
    setLoading(true);
    try {
      onSubmit(values); // ✅ properly typed
      form.resetFields();
      onCancel(); // Close the modal after submission
    } catch (error) {
      console.error("Error adding staff:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Staff Member" open={open} onCancel={onCancel} footer={null} width={500} className="add-staff-modal">
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <Form.Item name="name" label="Full Name" rules={[{ required: true, message: "Please enter staff name" }]}>
          <Input placeholder="Enter full name" className="rounded-lg" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email Address"
          rules={[
            { required: true, message: "Please enter email address" },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input placeholder="Enter email address" className="rounded-lg" />
        </Form.Item>

        <Form.Item name="role" label="Role" rules={[{ required: true, message: "Please select a role" }]}>
          <Select placeholder="Select role" className="rounded-lg">
            <Select.Option value="Admin">Admin</Select.Option>
            <Select.Option value="Manager">Manager</Select.Option>
            <Select.Option value="Staff">Staff</Select.Option>
            <Select.Option value="Receptionist">Receptionist</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: "Please enter password" },
            { min: 6, message: "Password must be at least 6 characters" },
          ]}
        >
          <Input.Password placeholder="Enter password" className="rounded-lg" />
        </Form.Item>

        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={onCancel} className="rounded-lg">
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className="bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700 rounded-lg"
          >
            Add Staff Member
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddStaffModal;
