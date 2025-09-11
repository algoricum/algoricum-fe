"use client";
import { Skeleton } from "antd";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { Calendar, TrendingUp, UserPlus } from "lucide-react";
import { type JSX, useEffect, useState } from "react";

dayjs.extend(isBetween);

type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  date: string;
  source_id: string | null;
  sourceName: string | null;
};

type Stats = {
  totalLeads: { thisMonth: number; lastMonth: number; change: number };
  appointments: { thisMonth: number; lastMonth: number; change: number };
  conversionRate: { thisMonth: number; lastMonth: number; change: number };
};

interface StatsGridProps {
  clinicId: string;
  leadsData: LeadRow[];
}

export default function StatsGrid({ clinicId, leadsData }: StatsGridProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setLoading(true);
      return;
    }

    function calculateStats() {
      const now = dayjs();
      const startOfThisMonth = now.startOf("month");
      const startOfLastMonth = now.subtract(1, "month").startOf("month");
      const endOfLastMonth = now.startOf("month");

      console.log("Start of this month:", startOfThisMonth);
      console.log("Start of last month:", startOfLastMonth);
      console.log("End of last month:", endOfLastMonth);

      // Filter leads by month
      const leadsThisMonth = leadsData.filter(lead => dayjs(lead.date).isAfter(startOfThisMonth));

      const leadsLastMonth = leadsData.filter(lead => {
        const leadDate = dayjs(lead.date);
        return leadDate.isAfter(startOfLastMonth) && leadDate.isBefore(endOfLastMonth);
      });

      // Calculate totals
      const totalThis = leadsThisMonth.length;
      const totalLast = leadsLastMonth.length;
      const totalChange = getChangePercent(totalThis, totalLast);

      // Calculate booked appointments
      const bookedThis = leadsThisMonth.filter(l => l.status === "Booked").length;
      const bookedLast = leadsLastMonth.filter(l => l.status === "Booked").length;
      const bookedChange = getChangePercent(bookedThis, bookedLast);

      // Calculate conversion rates
      const convThis = totalThis === 0 ? 0 : Number(((bookedThis / totalThis) * 100).toFixed(2));

      const convLast = totalLast === 0 ? 0 : Number(((bookedLast / totalLast) * 100).toFixed(2));

      const convChange = getChangePercent(convThis, convLast);

      setStats({
        totalLeads: { thisMonth: totalThis, lastMonth: totalLast, change: totalChange },
        appointments: { thisMonth: bookedThis, lastMonth: bookedLast, change: bookedChange },
        conversionRate: { thisMonth: convThis, lastMonth: convLast, change: convChange },
      });

      setLoading(false);
    }

    calculateStats();
  }, [clinicId, leadsData]);

  function getChangePercent(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="border-2 border-gray-100 rounded-xl p-6 bg-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-gray-100">
                <Skeleton.Avatar active size="large" shape="circle" />
              </div>
              <div className="ml-4 flex-1">
                <Skeleton.Input style={{ width: 100, height: 14 }} active size="small" />
                <div className="flex items-center mt-2">
                  <Skeleton.Input style={{ width: 80, height: 24 }} active size="default" />
                </div>
                <Skeleton.Input style={{ width: 120, height: 12, marginTop: 8 }} active size="small" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
      <StatCard
        icon={<UserPlus className="w-6 h-6 text-purple-600" />}
        title="Total Leads"
        value={stats.totalLeads.thisMonth}
        change={stats.totalLeads.change}
        bg="bg-purple-100"
      />
      <StatCard
        icon={<Calendar className="w-6 h-6 text-blue-600" />}
        title="Appointments"
        value={stats.appointments.thisMonth}
        change={stats.appointments.change}
        bg="bg-blue-100"
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6 text-green-600" />}
        title="Booking Rate"
        value={`${stats.conversionRate.thisMonth}%`}
        change={stats.conversionRate.change}
        bg="bg-green-100"
      />
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  change,
  bg,
}: {
  icon: JSX.Element;
  title: string;
  value: number | string;
  change: number;
  bg: string;
}) {
  return (
    <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-center mb-2">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className="text-sm text-gray-500">
            This month{" "}
            <span className={`font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
              {change >= 0 ? "+" : ""}
              {change}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
