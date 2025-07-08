"use client";

import { Button, Table, Dropdown, Card } from "antd";
import { PlusOutlined, MoreOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd/es/menu";

interface StaffData {
  key: string;
  createdBy: string;
  name: string;
  email: string;
  role: string;
  password: string;
}

interface StaffManagementProps {
  onAddStaff: () => void;
}

const StaffManagement = ({ onAddStaff }: StaffManagementProps) => {
  // Sample data - replace with your actual data
  const staffData: StaffData[] = [
    {
      key: "1",
      createdBy: "Admin",
      name: "John Carter",
      email: "john@clinic.com",
      role: "Admin",
      password: "Admin",
    },
    {
      key: "2",
      createdBy: "Admin",
      name: "John Carter",
      email: "john@clinic.com",
      role: "Admin",
      password: "Admin",
    },
    {
      key: "3",
      createdBy: "Admin",
      name: "John Carter",
      email: "john@clinic.com",
      role: "Admin",
      password: "Admin",
    },
  ];

  // Dropdown menu items for actions
  const getActionItems = (record: StaffData): MenuProps["items"] => [
    {
      key: "edit",
      label: "Edit Staff",
      onClick: () => handleEdit(record),
    },
    {
      key: "delete",
      label: "Delete Staff",
      danger: true,
      onClick: () => handleDelete(record),
    },
    {
      key: "view",
      label: "View Details",
      onClick: () => handleView(record),
    },
  ];

  // Action handlers
  const handleEdit = (record: StaffData) => {
    console.log("Edit staff:", record);
    // Add your edit logic here
  };

  const handleDelete = (record: StaffData) => {
    console.log("Delete staff:", record);
    // Add your delete logic here
  };

  const handleView = (record: StaffData) => {
    console.log("View staff:", record);
    // Add your view logic here
  };

  // Table columns configuration
  const columns: ColumnsType<StaffData> = [
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      render: (text: string) => <span className="text-gray-700 text-sm">{text}</span>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <span className="text-gray-900 font-medium text-sm">{text}</span>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (text: string) => (
        <a href={`mailto:${text}`} className="text-blue-600 hover:text-blue-800 text-sm">
          {text}
        </a>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (text: string) => <span className="text-gray-700 text-sm">{text}</span>,
    },
    {
      title: "Password",
      dataIndex: "password",
      key: "password",
      render: (text: string) => <span className="text-gray-700 text-sm">{text}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      width: 80,
      render: (_, record) => (
        <Dropdown menu={{ items: getActionItems(record) }} trigger={["click"]} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} className="border-none shadow-none hover:bg-gray-100" size="small" />
        </Dropdown>
      ),
    },
  ];

  return (
    <Card className="rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-400 rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-400 rounded-sm"></div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Staff Table</h2>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddStaff}
          className="bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700 rounded-lg px-4 py-2 h-auto font-medium"
        >
          Add Staff Member
        </Button>
      </div>

      {/* Table */}
      <Table columns={columns} dataSource={staffData} pagination={false} className="staff-table" size="middle" />

      <style jsx global>{`
        .staff-table .ant-table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .staff-table .ant-table-thead > tr > th {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          color: #374151;
          padding: 12px 16px;
          font-size: 14px;
        }
        .staff-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 14px;
        }
        .staff-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none;
        }
        .staff-table .ant-table-tbody > tr:hover > td {
          background-color: #f9fafb;
        }
      `}</style>
    </Card>
  );
};

export default StaffManagement;
