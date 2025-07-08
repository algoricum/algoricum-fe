"use client";

import { Card, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

interface SourceData {
  key: string;
  source: string;
  leads: number;
  converted: number;
  conversionRate: string;
}

const columns: ColumnsType<SourceData> = [
  {
    title: "Source",
    dataIndex: "source",
    key: "source",
    render: (text: string) => <span className="font-medium text-gray-900">{text}</span>,
  },
  {
    title: "Leads",
    dataIndex: "leads",
    key: "leads",
    align: "right",
    render: (value: number) => <span className="text-gray-900">{value}</span>,
  },
  {
    title: "Converted",
    dataIndex: "converted",
    key: "converted",
    align: "right",
    render: (value: number) => <span className="text-gray-900">{value}</span>,
  },
  {
    title: "Conversion Rate",
    dataIndex: "conversionRate",
    key: "conversionRate",
    align: "right",
    render: (value: string) => <span className="text-gray-900">{value}</span>,
  },
];

const sourceData: SourceData[] = [
  {
    key: "1",
    source: "Chatbot",
    leads: 24,
    converted: 9,
    conversionRate: "37.5%",
  },
  {
    key: "2",
    source: "Lead Form",
    leads: 24,
    converted: 9,
    conversionRate: "37.5%",
  },
  {
    key: "3",
    source: "Manual Entry",
    leads: 24,
    converted: 9,
    conversionRate: "37.5%",
  },
];

export default function SourceTable() {
  return (
    <Card className="rounded-xl border-1 shadow-sm overflow-hidden">
      <Table columns={columns} dataSource={sourceData} pagination={false} className="custom-table" />
      <style jsx global>{`
        .custom-table .ant-table-thead > tr > th {
          background-color: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          color: #1f2937;
          padding: 16px 24px;
        }
        .custom-table .ant-table-tbody > tr > td {
          padding: 16px 24px;
          border-bottom: 1px solid #f3f4f6;
        }
        .custom-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none;
        }
        .custom-table .ant-table-tbody > tr:hover > td {
          background-color: #f9fafb;
        }
      `}</style>
    </Card>
  );
}
