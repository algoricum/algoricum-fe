import { Users } from "lucide-react";

interface StaffStatsProps {
  totalStaff: number;
  filteredStaff: number;
  hasFilters: boolean;
}

export function StaffStats({ totalStaff, filteredStaff, hasFilters }: StaffStatsProps) {
  return (
    <div className="border-2 border-gray-200 rounded-xl mt-4 ml-5 p-8 bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 w-full md:w-fit">
      <div className="flex items-center justify-start gap-2 whitespace-nowrap md:justify-between md:gap-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="rounded-full bg-purple-100 p-2 md:p-3">
            <Users className="h-5 w-5 text-purple-600 md:h-6 md:w-6" />
          </div>
          <p className="truncate text-sm font-medium text-gray-600">Total Staff</p>
        </div>
        <p className="shrink-0 text-xl font-semibold text-gray-900 md:ml-auto md:text-2xl">{filteredStaff}</p>
      </div>
      {hasFilters && <p className="mt-1 text-xs text-gray-500">of {totalStaff} total</p>}
    </div>
  );
}
