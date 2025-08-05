"use client";

import { JSX, useEffect, useState } from "react";
import { UserPlus, Calendar, TrendingUp, Users } from "lucide-react";
import dayjs from "dayjs";
import { Skeleton } from "antd";
import { createClient } from "@/utils/supabase/config/client";

const supabase = createClient();

type Stats = {
  totalLeads: { thisMonth: number; lastMonth: number; change: number };
  appointments: { thisMonth: number; lastMonth: number; change: number };
  conversionRate: { thisMonth: number; lastMonth: number; change: number };
  activePatients: { thisMonth: number; lastMonth: number; change: number };
};

export default function StatsGrid({ clinicId }: { clinicId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    async function fetchStats() {
      const now = dayjs();
      const startOfThisMonth = now.startOf("month").toISOString();
      const startOfLastMonth = now.subtract(1, "month").startOf("month").toISOString();
      const endOfLastMonth = now.startOf("month").toISOString();

      const [thisMonth, lastMonth] = await Promise.all([
        supabase.from("lead").select("id, status, email").eq("clinic_id", clinicId).gte("created_at", startOfThisMonth),
        supabase
          .from("lead")
          .select("id, status, email")
          .eq("clinic_id", clinicId)
          .gte("created_at", startOfLastMonth)
          .lt("created_at", endOfLastMonth),
      ]);

      if (thisMonth.error || lastMonth.error) {
        setLoading(false);
        return;
      }

      const leadsThis = thisMonth.data || [];
      const leadsLast = lastMonth.data || [];

      const totalThis = leadsThis.length;
      const totalLast = leadsLast.length;
      const totalChange = getChangePercent(totalThis, totalLast);

      const bookedThis = leadsThis.filter(l => l.status === "Booked").length;
      const bookedLast = leadsLast.filter(l => l.status === "Booked").length;
      const bookedChange = getChangePercent(bookedThis, bookedLast);
      
      const convertedThis = new Set(leadsThis.filter(l => l.status === "Converted").map(l => l.email)).size;
      const convertedLast = new Set(leadsLast.filter(l => l.status === "Converted").map(l => l.email)).size;
      const activeChange = getChangePercent(convertedThis, convertedLast);

      const convThis = totalThis === 0 ? 0 : Math.round((convertedThis / totalThis) * 100);
      const convLast = totalLast === 0 ? 0 : Math.round((convertedLast / totalLast) * 100);
      const convChange = getChangePercent(convThis, convLast);


      setStats({
        totalLeads: { thisMonth: totalThis, lastMonth: totalLast, change: totalChange },
        appointments: { thisMonth: bookedThis, lastMonth: bookedLast, change: bookedChange },
        conversionRate: { thisMonth: convThis, lastMonth: convLast, change: convChange },
        activePatients: {
          thisMonth: convertedThis,
          lastMonth: convertedLast,
          change: activeChange,
        },
      });

      setLoading(false);
    }

    fetchStats();
  }, [clinicId]);

  function getChangePercent(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="card">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        title="Conversion Rate"
        value={`${stats.conversionRate.thisMonth}%`}
        change={stats.conversionRate.change}
        bg="bg-green-100"
      />
      <StatCard
        icon={<Users className="w-6 h-6 text-purple-600" />}
        title="Active Patients"
        value={stats.activePatients.thisMonth}
        change={stats.activePatients.change}
        bg="bg-purple-100"
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
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            This month{" "}
            <span className={`text-${change >= 0 ? "green" : "red"}-600`}>
              {change >= 0 ? "+" : ""}
              {change}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
