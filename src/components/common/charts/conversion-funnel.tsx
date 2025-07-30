"use client";
import type React from "react";
import { TrendingUp } from "lucide-react";

interface ConversionFunnelProps {
  leadsData: any[];
  appointmentsData: any[];
}

const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ leadsData, appointmentsData }) => {
  // Calculate website visitors as leads + some multiplier (since not all visitors become leads)
  const websiteVisitors = leadsData.length > 0 ? Math.max(leadsData.length * 8, 100) : 100;
  const leadsGenerated = leadsData.length;
  const qualifiedLeads = leadsData.filter((lead: any) => lead.status === "booked" || lead.status === "attempted").length;
  const appointmentsBooked = appointmentsData.length;

  // Calculate real percentages
  const leadsPercentage = websiteVisitors > 0 ? ((leadsGenerated / websiteVisitors) * 100).toFixed(1) : "0";
  const qualifiedPercentage = websiteVisitors > 0 ? ((qualifiedLeads / websiteVisitors) * 100).toFixed(1) : "0";
  const appointmentsPercentage = websiteVisitors > 0 ? ((appointmentsBooked / websiteVisitors) * 100).toFixed(1) : "0";

  const funnelData = [
    {
      title: "Website Visitors",
      count: websiteVisitors,
      percentage: 100,
      color: "#722ed1",
      icon: "👥",
    },
    {
      title: "Leads Generated",
      count: leadsGenerated,
      percentage: Number.parseFloat(leadsPercentage),
      color: "#722ed1",
      icon: "📞",
    },
    {
      title: "Qualified Leads",
      count: qualifiedLeads,
      percentage: Number.parseFloat(qualifiedPercentage),
      color: "#722ed1",
      icon: "✅",
    },
    {
      title: "Appointments Booked",
      count: appointmentsBooked,
      percentage: Number.parseFloat(appointmentsPercentage),
      color: "#52c41a",
      icon: "📅",
    },
  ];

  // Show empty state if no data
  if (leadsData.length === 0 && appointmentsData.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No conversion data available</p>
        <p className="text-sm text-gray-400">Add leads and appointments to see the funnel</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {funnelData.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
              <span className="text-lg">{item.icon}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">{item.title}</span>
                <span className="font-bold text-lg text-gray-900">{item.count.toLocaleString()}</span>
              </div>
              <div className="flex items-center mb-2">
                <span className="text-sm text-gray-500">{item.percentage}% of total</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(item.percentage, 100)}%`,
                    backgroundColor: item.color,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversionFunnel;
