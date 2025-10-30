import type { StatCardProps } from "@/types/staff";

export function StatCard(props: Readonly<StatCardProps>) {
  const { icon, iconBg, title, value } = props;
  return (
    <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 mt-4">
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
