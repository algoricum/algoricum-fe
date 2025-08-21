import type React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: number;
}

export function StatCard({ icon, iconBg, title, value }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white p-3 shadow sm:p-5">
      <div className="flex items-center justify-start gap-2 whitespace-nowrap md:justify-between md:gap-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className={`rounded-full p-2 md:p-3 ${iconBg}`}>{icon}</div>
          <p className="truncate text-sm font-medium text-gray-600">{title}</p>
        </div>
        <p className="shrink-0 text-xl font-semibold text-gray-900 md:ml-auto md:text-2xl">{value}</p>
      </div>
    </div>
  );
}
