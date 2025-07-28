"use client";

import { Card } from "antd";
import { LineChartOutlined } from "@ant-design/icons";

const metricsData = [
  { label: "Avg. Chat Duration", value: "2m 15s" },
  { label: "Chat Drop-off Rate", value: "18%" },
  { label: "Booking Triggers (Chat)", value: "7" },
  { label: "Human Handoffs", value: "4" },
];

export default function EngagementMetrics() {
  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <LineChartOutlined />
          <span>Engagement Metrics</span>
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
        {metricsData.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="font-semibold text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
