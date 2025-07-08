"use client";

import { Row, Col } from "antd";
import LeadConversionSummary from "./lead-conversion-summary";
import EngagementMetrics from "./engagement-metrics";

export default function AnalyticsOverview() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Analytics Overview</h2>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <LeadConversionSummary />
        </Col>
        <Col xs={24} lg={12}>
          <EngagementMetrics />
        </Col>
      </Row>
    </div>
  );
}
