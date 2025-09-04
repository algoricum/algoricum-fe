"use client";
import dayjs from "dayjs";
import { TrendingUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface LeadSourcesLineChartProps {
  leadsData: any[];
}

const LeadSourcesLineChart: React.FC<LeadSourcesLineChartProps> = ({ leadsData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });
  const padding = 40;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry?.contentRect) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (leadsData.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No lead source data available</p>
          <p className="text-sm">Add some leads to see trends</p>
        </div>
      </div>
    );
  }

  const sources = [...new Set(leadsData.map(lead => lead.sourceName?.name).filter(Boolean))];
  if (sources.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No lead sources available</p>
          <p className="text-sm">Add leads with sources to see trends</p>
        </div>
      </div>
    );
  }

  const now = dayjs();
  const months = Array.from({ length: 6 }).map((_, i) => now.subtract(5 - i, "month").format("MMM YYYY"));

  const colors = ["#722ed1", "#52c41a", "#1890ff", "#faad14", "#ff4d4f", "#13c2c2"];
  const chartData = months.map(month => {
    const row: Record<string, any> = { month };
    sources.forEach(source => (row[source] = 0));
    return row;
  });

  leadsData.forEach(lead => {
    const source = lead.sourceName?.name;
    const month = dayjs(lead.date).format("MMM YYYY");
    const entry = chartData.find(item => item.month === month);
    if (entry && source) entry[source] += 1;
  });

  const maxValue = Math.max(...chartData.map(item => Math.max(...sources.map(s => item[s] || 0))), 1);
  const width = dimensions.width;
  const height = dimensions.height;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const getTicks = (max: number): number[] => {
    if (max <= 5) return [0, 1, 2, 3, 4, 5].filter(n => n <= max);
    if (max <= 10) return [0, 2, 4, 6, 8, 10].filter(n => n <= max);
    if (max <= 20) return [0, 5, 10, 15, 20].filter(n => n <= max);
    if (max <= 50) return [0, 10, 20, 30, 40, 50].filter(n => n <= max);
    return [0, 25, 50, 75, 100].filter(n => n <= max);
  };

  const yTicks = getTicks(maxValue);

  return (
    <div ref={containerRef} className="w-full h-80 p-4">
      <div className="relative w-full h-full border-l border-b border-gray-300">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          {/* Grid lines */}
          {yTicks.map((value, i) => {
            const ratio = value / maxValue;
            const y = height - padding - ratio * innerHeight;
            return <line key={i} x1={padding} x2={width} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4" />;
          })}

          {/* Y-axis labels */}
          {yTicks.map((value, i) => {
            const ratio = value / maxValue;
            const y = height - padding - ratio * innerHeight;
            return (
              <text key={i} x={padding - 10} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">
                {value}
              </text>
            );
          })}

          {/* Lines & Points */}
          {sources.map((source, sIndex) => {
            const points = chartData.map((item, i) => {
              const x = padding + (i / (months.length - 1)) * innerWidth;
              const y = height - padding - (item[source] / maxValue) * innerHeight;
              return `${x},${y}`;
            });

            return (
              <g key={`line-${source}`}>
                <polyline points={points.join(" ")} fill="none" stroke={colors[sIndex % colors.length]} strokeWidth={2} />
                {chartData.map((item, i) => {
                  const x = padding + (i / (months.length - 1)) * innerWidth;
                  const y = height - padding - (item[source] / maxValue) * innerHeight;
                  return <circle key={`pt-${source}-${i}`} cx={x} cy={y} r={4} fill={colors[sIndex % colors.length]} />;
                })}
              </g>
            );
          })}

          {/* X-axis labels */}
          {months.map((month, i) => {
            const x = padding + (i / (months.length - 1)) * innerWidth;
            return (
              <text key={month} x={x} y={height - padding + 15} fontSize={10} textAnchor="middle" fill="#6b7280">
                {month}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-4 flex flex-wrap justify-center text-sm">
          {sources.map((source, index) => (
            <div key={source} className="flex items-center mr-4 mb-2">
              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors[index % colors.length] }} />
              <span>{source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadSourcesLineChart;
