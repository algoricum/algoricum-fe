"use client";
import { Calendar } from "lucide-react";
import React from "react";

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
        booked: hourAppointments.filter(apt => apt.status === "Booked").length,
        converted: hourAppointments.filter(apt => apt.status === "Converted").length,
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
        booked: dayAppointments.filter(apt => apt.status === "Booked").length,
        converted: dayAppointments.filter(apt => apt.status === "Converted").length,
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
        booked: monthAppointments.filter(apt => apt.status === "Booked").length,
        converted: monthAppointments.filter(apt => apt.status === "Converted").length,
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
        booked: yearAppointments.filter(apt => apt.status === "Booked").length,
        converted: yearAppointments.filter(apt => apt.status === "Converted").length,
      };
    });
  }

  const maxValue = Math.max(...chartData.map(item => (item.booked || 0) + (item.converted || 0)), 1);

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
            const booked = item.booked || 0;
            const converted = item.converted || 0;

            const bookedHeight = maxValue > 0 ? (booked / maxValue) * 240 : 0;
            const convertedHeight = maxValue > 0 ? (converted / maxValue) * 240 : 0;

            const label = item.time || item.day || item.month || item.year;

            return (
              <div key={index} className="flex flex-col items-center flex-1 mx-1">
                <div className="flex flex-col items-center justify-end h-60 w-8">
                  <div className="w-full flex flex-col justify-end">
                    {booked > 0 && (
                      <div
                        className="w-full bg-blue-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${bookedHeight}px` }}
                        title={`Booked: ${booked}`}
                      />
                    )}
                    {converted > 0 && (
                      <div
                        className="w-full bg-green-500 transition-all duration-300 hover:opacity-80"
                        style={{ height: `${convertedHeight}px` }}
                        title={`Converted: ${converted}`}
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
          <div className="w-3 h-3 bg-blue-500 mr-2 rounded"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 mr-2 rounded"></div>
          <span>Converted</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleBarChart;
