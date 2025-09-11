"use client";
import { Calendar } from "lucide-react";
import React from "react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

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

interface SimpleBarChartProps {
  leadsData: LeadRow[];
  filter: "today" | "week" | "month" | "year";
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ leadsData, filter }) => {
  if (!leadsData || leadsData.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No leads data available</p>
          <p className="text-sm">Add some leads to see the chart</p>
        </div>
      </div>
    );
  }

  let chartData: any[] = [];

  if (filter === "today") {
    // Show hourly data for today - expanded to cover more hours
    const hours = ["6AM", "7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM"];
    const today = dayjs();

    // First, get all leads created today
    const todayLeads = leadsData.filter(lead => {
      const leadDate = dayjs(lead.date);
      return leadDate.isSame(today, "day");
    });

    console.log("Today's date:", today.format("YYYY-MM-DD"));
    console.log(
      "All leads:",
      leadsData.map(lead => ({
        date: lead.date,
        formatted: dayjs(lead.date).format("YYYY-MM-DD HH:mm:ss"),
        hour: dayjs(lead.date).hour(),
        isSameDay: dayjs(lead.date).isSame(today, "day"),
      })),
    );
    console.log("Today's leads:", todayLeads);

    chartData = hours.map(hour => {
      // Convert hour string to 24-hour format
      let hourNumber: number;
      if (hour.includes("PM") && hour !== "12PM") {
        hourNumber = parseInt(hour.replace("PM", "")) + 12;
      } else if (hour === "12PM") {
        hourNumber = 12;
      } else if (hour === "12AM") {
        hourNumber = 0;
      } else {
        hourNumber = parseInt(hour.replace("AM", ""));
      }

      // Filter today's leads by hour
      const hourLeads = todayLeads.filter(lead => {
        const leadDate = dayjs(lead.date);
        const leadHour = leadDate.hour();
        console.log(`Checking lead hour ${leadHour} against slot ${hourNumber} for ${hour}`);
        return leadHour === hourNumber;
      });

      return {
        time: hour,
        total: hourLeads.length,
        booked: hourLeads.filter(lead => lead.status?.toLowerCase() === "booked").length,
      };
    });

    console.log("Chart data for today:", chartData);
  } else if (filter === "week") {
    // Show daily data for this week
    const startOfWeek = dayjs().startOf("week");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    chartData = days.map((day, dayIndex) => {
      const dayStart = startOfWeek.add(dayIndex, "day").startOf("day");
      const dayEnd = dayStart.endOf("day");

      const dayLeads = leadsData.filter(lead => {
        const leadDate = dayjs(lead.date);
        return leadDate.isBetween(dayStart, dayEnd, null, "[]");
      });

      return {
        day: day,
        total: dayLeads.length,
        booked: dayLeads.filter(lead => lead.status?.toLowerCase() === "booked").length,
      };
    });
  } else if (filter === "month") {
    // Show weekly data for this month
    const startOfMonth = dayjs().startOf("month");
    const endOfMonth = dayjs().endOf("month");
    const weeksInMonth = Math.ceil(endOfMonth.diff(startOfMonth, "day") / 7);

    chartData = Array.from({ length: weeksInMonth }, (_, weekIndex) => {
      const weekStart = startOfMonth.add(weekIndex * 7, "day").startOf("day");
      const weekEnd = weekStart.add(6, "day").endOf("day");

      const weekLeads = leadsData.filter(lead => {
        const leadDate = dayjs(lead.date);
        return leadDate.isBetween(weekStart, weekEnd, null, "[]") && leadDate.isBetween(startOfMonth, endOfMonth, null, "[]");
      });

      return {
        week: `Week ${weekIndex + 1}`,
        total: weekLeads.length,
        booked: weekLeads.filter(lead => lead.status?.toLowerCase() === "booked").length,
      };
    });
  } else if (filter === "year") {
    // Show monthly data for this year
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = dayjs().year();

    chartData = months.map((month, monthIndex) => {
      const monthStart = dayjs().year(currentYear).month(monthIndex).startOf("month");
      const monthEnd = monthStart.endOf("month");

      const monthLeads = leadsData.filter(lead => {
        const leadDate = dayjs(lead.date);
        return leadDate.isBetween(monthStart, monthEnd, null, "[]");
      });

      return {
        month: month,
        total: monthLeads.length,
        booked: monthLeads.filter(lead => lead.status?.toLowerCase() === "booked").length,
      };
    });
  }

  const maxValue = Math.max(...chartData.map(item => Math.max(item.total || 0, item.booked || 0)), 1);

  const getTicks = (max: number): number[] => {
    if (max <= 5) return [0, 1, 2, 3, 4, 5].filter(n => n <= max);
    if (max <= 10) return [0, 2, 4, 6, 8, 10].filter(n => n <= max);
    if (max <= 20) return [0, 5, 10, 15, 20].filter(n => n <= max);
    if (max <= 50) return [0, 10, 20, 30, 40, 50].filter(n => n <= max);
    if (max <= 100) return [0, 25, 50, 75, 100].filter(n => n <= max);
    return [0, max];
  };

  const yTicks = getTicks(maxValue);

  return (
    <div className="w-full h-80 p-4">
      <div className="relative h-64 border-l border-b border-gray-300">
        {/* Y-axis labels and grid lines */}
        {yTicks.map((value, i) => {
          const positionPercent = value / maxValue;
          const bottomOffset = positionPercent * 100;

          return (
            <React.Fragment key={i}>
              <div className="absolute w-full border-t border-gray-200 border-dashed" style={{ bottom: `${bottomOffset}%` }} />
              <div
                className="absolute text-xs text-gray-500 -left-8"
                style={{
                  bottom: `${bottomOffset}%`,
                  transform: "translateY(50%)",
                }}
              >
                {value}
              </div>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        <div className="flex items-end justify-between h-full px-4">
          {chartData.map((item: any, index: number) => {
            const total = item.total || 0;
            const booked = item.booked || 0;

            const totalHeight = maxValue > 0 ? (total / maxValue) * 240 : 0;
            const bookedHeight = maxValue > 0 ? (booked / maxValue) * 240 : 0;

            const label = item.time || item.day || item.week || item.month;

            return (
              <div key={index} className="flex flex-col items-center flex-1 mx-1">
                <div className="flex items-end justify-center h-60 w-full gap-1">
                  {/* Total leads bar */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-4 bg-blue-500 transition-all duration-300 hover:opacity-80"
                      style={{ height: `${totalHeight}px` }}
                      title={`Total: ${total}`}
                    />
                  </div>
                  {/* Booked leads bar */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-4 bg-green-500 transition-all duration-300 hover:opacity-80"
                      style={{ height: `${bookedHeight}px` }}
                      title={`Booked: ${booked}`}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-2 text-center">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center mt-4 space-x-6 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 mr-2 rounded"></div>
          <span>Total Leads</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 mr-2 rounded"></div>
          <span>Booked Leads</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleBarChart;
