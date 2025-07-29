export function LeadsTableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {Array.from({ length: 6 }).map((_, index) => (
                <th key={index} className="text-left py-3 px-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-100">
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="ml-3 space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gray-200 animate-pulse">
              <div className="w-6 h-6 bg-gray-300 rounded"></div>
            </div>
            <div className="ml-4 space-y-2">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
