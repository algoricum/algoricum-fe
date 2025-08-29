import type React from "react";

export const StatCard = ({
  icon,
  iconBg,
  title,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: number;
}) => (
  <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md sm:p-6">
    <div className="flex items-center justify-between gap-3">
      {/* Left side: icon + title */}
      <div className="flex min-w-0 items-center gap-3">
        <div className={`rounded-full p-2 sm:p-3 ${iconBg}`}>{icon}</div>
        <p className="truncate text-sm font-medium text-gray-600">{title}</p>
      </div>

      {/* Right side: value */}
      <p className="shrink-0 text-xl font-semibold text-gray-900 sm:text-2xl">{value}</p>
    </div>    
  </div>
);
