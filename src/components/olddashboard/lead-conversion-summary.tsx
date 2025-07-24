"use client";

import { Card } from "antd";
import { BarChartOutlined } from "@ant-design/icons";

const summaryData = [
  { label: "Total Leads", value: "124" },
  { label: "New Leads This Period", value: "43" },
  { label: "Converted Leads", value: "14" },
  { label: "Conversion Rate", value: "32.5%" },
  { label: "Avg. Time to Conversion", value: "2 Days 4 Hours" },
];

export default function LeadConversionSummary() {
  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BarChartOutlined />
          <span>Lead And Conversion Summary</span>
        </div>
      }
      className="h-full rounded-xl border-1 shadow-sm"
      headStyle={{
        borderBottom: "1px solid #f0f0f0",
        fontSize: "16px",
        fontWeight: "600",
      }}
    >
      <div className="space-y-4">
        {summaryData.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="font-semibold text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
