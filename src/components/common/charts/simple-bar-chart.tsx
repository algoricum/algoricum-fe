"use client";
import type React from "react";
import { Calendar } from "lucide-react";

interface SimpleBarChartProps {
  appointmentsData: any[];
  filter: string;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ appointmentsData, filter }) => {
  if (!appointmentsData || appointmentsData.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No appointment data available</p>
          <p className="text-sm">Add some appointments to see the chart</p>
        </div>
      </div>
    );
  }

  // Generate chart data based on actual appointments
  let chartData: any[] = [];

  if (filter === "today") {
    const hours = ["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM"];
    chartData = hours.map(hour => {
      const hourNumber = hour.includes("AM")
        ? hour === "12PM"
          ? 12
          : Number.parseInt(hour)
        : hour === "12PM"
          ? 12
          : Number.parseInt(hour) + 12;

      const hourAppointments = appointmentsData.filter(apt => {
        if (!apt.time) return false;
        const aptHour = Number.parseInt(apt.time.split(":")[0]);
        return Math.abs(aptHour - hourNumber) <= 1;
      });

      return {
        time: hour,
        completed: hourAppointments.filter(apt => apt.status === "completed").length,
        pending: hourAppointments.filter(apt => apt.status === "pending").length,
        cancelled: hourAppointments.filter(apt => apt.status === "cancelled").length,
        confirmed: hourAppointments.filter(apt => apt.status === "confirmed").length,
      };
    });
  } else if (filter === "week") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    chartData = days.map((day, dayIndex) => {
      const dayAppointments = appointmentsData.filter(apt => {
        if (!apt.date) return false;
        const aptDate = new Date(apt.date);
        const aptDayOfWeek = aptDate.getDay();
        const targetDay = dayIndex === 6 ? 0 : dayIndex + 1;
        return aptDayOfWeek === targetDay;
      });

      return {
        day: day,
        completed: dayAppointments.filter(apt => apt.status === "completed").length,
        pending: dayAppointments.filter(apt => apt.status === "pending").length,
        cancelled: dayAppointments.filter(apt => apt.status === "cancelled").length,
        confirmed: dayAppointments.filter(apt => apt.status === "confirmed").length,
      };
    });
  } else if (filter === "month") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    chartData = months.map((month, monthIndex) => {
      const monthAppointments = appointmentsData.filter(apt => {
        if (!apt.date) return false;
        const aptDate = new Date(apt.date);
        return aptDate.getMonth() === monthIndex;
      });

      return {
        month: month,
        completed: monthAppointments.filter(apt => apt.status === "completed").length,
        pending: monthAppointments.filter(apt => apt.status === "pending").length,
        cancelled: monthAppointments.filter(apt => apt.status === "cancelled").length,
        confirmed: monthAppointments.filter(apt => apt.status === "confirmed").length,
      };
    });
  } else if (filter === "year") {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map(y => y.toString());

    chartData = years.map(year => {
      const yearAppointments = appointmentsData.filter(apt => {
        if (!apt.date) return false;
        const aptDate = new Date(apt.date);
        return aptDate.getFullYear().toString() === year;
      });

      return {
        year: year,
        completed: yearAppointments.filter(apt => apt.status === "completed").length,
        pending: yearAppointments.filter(apt => apt.status === "pending").length,
        cancelled: yearAppointments.filter(apt => apt.status === "cancelled").length,
        confirmed: yearAppointments.filter(apt => apt.status === "confirmed").length,
      };
    });
  }

  const maxValue = Math.max(
    ...chartData.map((item: any) => (item.completed || 0) + (item.pending || 0) + (item.cancelled || 0) + (item.confirmed || 0)),
    1,
  );

  return (
    <div className="w-full h-80 p-4">
      <div className="relative h-64 border-l border-b border-gray-300">
        {/* Y-axis labels */}
        <div className="absolute -left-8 top-0 text-xs text-gray-500">{maxValue}</div>
        <div className="absolute -left-6 top-12 text-xs text-gray-500">{Math.ceil(maxValue * 0.75)}</div>
        <div className="absolute -left-6 top-24 text-xs text-gray-500">{Math.ceil(maxValue * 0.5)}</div>
        <div className="absolute -left-6 top-36 text-xs text-gray-500">{Math.ceil(maxValue * 0.25)}</div>
        <div className="absolute -left-4 bottom-0 text-xs text-gray-500">0</div>

        {/* Grid lines */}
        <div className="absolute inset-0">
          {[0, 0.25, 0.5, 0.75, 1].map(value => (
            <div key={value} className="absolute w-full border-t border-gray-200 border-dashed" style={{ bottom: `${value * 100}%` }} />
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end justify-between h-full px-4">
          {chartData.map((item: any, index: number) => {
            const completed = item.completed || 0;
            const pending = item.pending || 0;
            const cancelled = item.cancelled || 0;
            const confirmed = item.confirmed || 0;

            const completedHeight = maxValue > 0 ? (completed / maxValue) * 240 : 0;
            const pendingHeight = maxValue > 0 ? (pending / maxValue) * 240 : 0;
            const cancelledHeight = maxValue > 0 ? (cancelled / maxValue) * 240 : 0;
            const confirmedHeight = maxValue > 0 ? (confirmed / maxValue) * 240 : 0;

            const label = item.time || item.day || item.month || item.year;

            return (
              <div key={index} className="flex flex-col items-center flex-1 mx-1">
                <div className="flex flex-col items-center justify-end h-60 w-8">
                  <div className="w-full flex flex-col justify-end">
                    {cancelled > 0 && (
                      <div
                        className="w-full bg-red-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${cancelledHeight}px` }}
                        title={`Cancelled: ${cancelled}`}
                      />
                    )}
                    {pending > 0 && (
                      <div
                        className="w-full bg-orange-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${pendingHeight}px` }}
                        title={`Pending: ${pending}`}
                      />
                    )}
                    {confirmed > 0 && (
                      <div
                        className="w-full bg-blue-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${confirmedHeight}px` }}
                        title={`Confirmed: ${confirmed}`}
                      />
                    )}
                    {completed > 0 && (
                      <div
                        className="w-full bg-green-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${completedHeight}px` }}
                        title={`Completed: ${completed}`}
                      />
                    )}
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
          <div className="w-3 h-3 bg-green-500 mr-2 rounded"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 mr-2 rounded"></div>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-500 mr-2 rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 mr-2 rounded"></div>
          <span>Cancelled</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleBarChart;
