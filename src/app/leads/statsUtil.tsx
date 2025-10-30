import { UserPlus, CheckCircle, Clock, SearchIcon, ChevronDown } from "lucide-react";
import type { StatConfig } from "@/types/leads";

export const leadsStatsConfig: StatConfig[] = [
  {
    key: "total",
    icon: <UserPlus className="h-6 w-6 text-blue-600 md:h-7 md:w-7" />,
    iconBg: "bg-blue-100",
    title: "Total Leads",
    getValue: statusStats => statusStats.reduce((sum, stat) => sum + stat.count, 0),
  },
  {
    key: "booked",
    icon: <CheckCircle className="h-6 w-6 text-green-600 md:h-7 md:w-7" />,
    iconBg: "bg-green-100",
    title: "Booked",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "booked")?.count || 0,
  },
  {
    key: "new",
    icon: <Clock className="h-6 w-6 text-yellow-600 md:h-7 md:w-7" />,
    iconBg: "bg-yellow-100",
    title: "New",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "new")?.count || 0,
  },
  {
    key: "cold",
    icon: <SearchIcon className="h-6 w-6 text-gray-600 md:h-7 md:w-7" />,
    iconBg: "bg-gray-100",
    title: "Cold",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "cold")?.count || 0,
  },
  {
    key: "engaged",
    icon: <ChevronDown className="h-6 w-6 text-orange-600 md:h-7 md:w-7" />,
    iconBg: "bg-orange-100",
    title: "Engaged",
    getValue: statusStats => statusStats.find(stat => stat.status.toLowerCase() === "engaged")?.count || 0,
  },
];
