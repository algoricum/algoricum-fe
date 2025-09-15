import type React from "react";
import { CheckCircle, Clock, Calendar } from "lucide-react";
import type { StatusStats } from "@/utils/supabase/leads-helper";

export interface StatConfig {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  getValue: (statusStats: StatusStats[]) => number;
}

export const staffStatsConfig: StatConfig[] = [
  {
    key: "total",
    icon: <Calendar className="h-6 w-6 text-blue-600 md:h-7 md:w-7" />,
    iconBg: "bg-blue-100",
    title: "Total Leads",
    getValue: statusStats => statusStats.reduce((sum, stat) => sum + stat.count, 0),
  },
  {
    key: "Active",
    icon: <CheckCircle className="h-6 w-6 text-green-600 md:h-7 md:w-7" />,
    iconBg: "bg-green-100",
    title: "Active",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "active")?.count || 0,
  },
  {
    key: "Inactive",
    icon: <Clock className="h-6 w-6 text-yellow-600 md:h-7 md:w-7" />,
    iconBg: "bg-yellow-100",
    title: "Inactive",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "inactive")?.count || 0,
  },
];
