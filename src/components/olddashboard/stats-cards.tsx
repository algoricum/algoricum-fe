"use client";

import { Card, Row, Col } from "antd";
import { AimOutlined, ClockCircleOutlined } from "@ant-design/icons";

const statsData = [
  {
    title: "New Lead This Week",
    value: "24",
    icon: <AimOutlined className="text-xl text-gray-600" />,
  },
  {
    title: "Conversion Rate",
    value: "35%",
    icon: <AimOutlined className="text-xl text-gray-600" />,
  },
  {
    title: "Time To Conversion",
    value: "2.3 Hours",
    icon: <ClockCircleOutlined className="text-xl text-gray-600" />,
  },
];

export default function StatsCards() {
  return (
    <Row gutter={[24, 24]}>
      {statsData.map((stat, index) => (
        <Col xs={24} md={8} key={index}>
          <Card className="h-full rounded-xl border-1 shadow-sm ">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="p-2 w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">{stat.icon}</p>
                <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
