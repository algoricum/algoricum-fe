import type React from "react";
import { UserPlus, CheckCircle, Clock, SearchIcon, ChevronDown } from "lucide-react";

export interface StatConfig {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  // eslint-disable-next-line no-unused-vars
  getValue: (leadsData: any[]) => number;
}

export const leadsStatsConfig: StatConfig[] = [
  {
    key: "total",
    icon: <UserPlus className="h-6 w-6 text-blue-600 md:h-7 md:w-7" />,
    iconBg: "bg-blue-100",
    title: "Total Leads",
    getValue: leadsData => leadsData.length,
  },
  {
    key: "booked",
    icon: <CheckCircle className="h-6 w-6 text-green-600 md:h-7 md:w-7" />,
    iconBg: "bg-green-100",
    title: "Booked",
    getValue: leadsData => leadsData.filter(l => l.status.toLowerCase() === "booked").length,
  },
  {
    key: "new",
    icon: <Clock className="h-6 w-6 text-yellow-600 md:h-7 md:w-7" />,
    iconBg: "bg-yellow-100",
    title: "New",
    getValue: leadsData => leadsData.filter(l => l.status.toLowerCase() === "new").length,
  },
  {
    key: "converted",
    icon: <CheckCircle className="h-6 w-6 text-purple-600 md:h-7 md:w-7" />,
    iconBg: "bg-purple-100",
    title: "Converted",
    getValue: leadsData => leadsData.filter(l => l.status.toLowerCase() === "converted").length,
  },
  {
    key: "cold",
    icon: <SearchIcon className="h-6 w-6 text-gray-600 md:h-7 md:w-7" />,
    iconBg: "bg-gray-100",
    title: "Cold",
    getValue: leadsData => leadsData.filter(l => l.status.toLowerCase() === "cold").length,
  },
  {
    key: "engaged",
    icon: <ChevronDown className="h-6 w-6 text-orange-600 md:h-7 md:w-7" />,
    iconBg: "bg-orange-100",
    title: "Engaged",
    getValue: leadsData => leadsData.filter(l => l.status.toLowerCase() === "engaged").length,
  },
];
