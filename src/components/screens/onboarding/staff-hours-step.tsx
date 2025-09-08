"use client";

import { useEffect, useState } from "react";
import { Button, Select, Switch, Typography } from "antd";

const { Option } = Select;
const { Title, Text } = Typography;
import { createClient } from "@/utils/supabase/config/client";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { ErrorToast } from "@/helpers/toast";
import { handleSubscribe } from "@/utils/stripe";

interface StaffHoursStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: any;
}
const supabase = createClient();

const TIME_OPTIONS = [
  "6:00 AM",
  "6:30 AM",
  "7:00 AM",
  "7:30 AM",
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StaffHoursStep({ onNext, onPrev, initialData = {} }: StaffHoursStepProps) {
  const [businessHours, setBusinessHours] = useState(
    initialData.businessHours || {
      Monday: { enabled: true, start: "9:00 AM", end: "5:00 PM" },
      Tuesday: { enabled: true, start: "9:00 AM", end: "5:00 PM" },
      Wednesday: { enabled: true, start: "9:00 AM", end: "5:00 PM" },
      Thursday: { enabled: true, start: "9:00 AM", end: "5:00 PM" },
      Friday: { enabled: true, start: "9:00 AM", end: "5:00 PM" },
      Saturday: { enabled: false, start: "9:00 AM", end: "5:00 PM" },
      Sunday: { enabled: false, start: "9:00 AM", end: "5:00 PM" },
    },
  );
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  const handlePreset = (preset: string) => {
    const newHours = { ...businessHours };

    switch (preset) {
      case "mon-fri-9-5":
        DAYS_OF_WEEK.forEach(day => {
          if (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(day)) {
            newHours[day] = { enabled: true, start: "9:00 AM", end: "5:00 PM" };
          } else {
            newHours[day] = { enabled: false, start: "9:00 AM", end: "5:00 PM" };
          }
        });
        break;
      case "mon-sat-8-8":
        DAYS_OF_WEEK.forEach(day => {
          if (day !== "Sunday") {
            newHours[day] = { enabled: true, start: "8:00 AM", end: "8:00 PM" };
          } else {
            newHours[day] = { enabled: false, start: "8:00 AM", end: "8:00 PM" };
          }
        });
        break;
      case "mon-sun-8-8":
        DAYS_OF_WEEK.forEach(day => {
          if (day !== "Sunday") {
            newHours[day] = { enabled: true, start: "6:00 AM", end: "10:00 PM" };
          } else {
            newHours[day] = { enabled: true, start: "6:00 AM", end: "10:00 PM" };
          }
        });
        break;
    }

    setBusinessHours(newHours);
  };

  const handleDayToggle = (day: string, enabled: boolean) => {
    setBusinessHours((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }));
  };

  const handleTimeChange = (day: string, timeType: "start" | "end", time: string) => {
    setBusinessHours((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], [timeType]: time },
    }));
  };
  const checkSubscription = async (id: string) => {
    const { data: sub } = await supabase
      .from("stripe_subscriptions")
      .select("id,status")
      .eq("clinic_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.status === "active" || sub?.status === "trialing") {
setSubscribingId(sub.id)    }

  };
  useEffect(() => {
    const fetchInitialData = async () => {
      const clinic = await getClinicData();
      console.log(".......Clinic data:.....", clinic);
      if (!clinic) {
        ErrorToast("Clinic data not found.");
        return;
      }

      setClinicId(clinic.id);

      
      
      await checkSubscription(clinic.id);
    };
    
    fetchInitialData();
  }, []);
  
  const handleNext = async() => {
    if(!subscribingId){

      const { data: planData } = await supabase.from("plans").select("*").limit(1);
      if(planData && planData[0]?.price_id){
     
      await handleSubscribe(planData[0]?.price_id,clinicId)
    }
  }
    onNext({ businessHours });
  };

  return (
    <div className="max-w-4xl">
        <Title level={1} className="text-gray-900 mb-5 text-3xl font-bold leading-tight" style={{ marginBottom: "25px" }}>
Clinic Profile
      </Title>
      <Title level={5} className="text-gray-900 mb-5 text-3xl font-bold leading-tight" style={{ marginBottom: "25px" }}>
        Welcome! Let’s set up your clinic so that we can start following up with leads right away.
      </Title>
      {/* <Title level={3} className="text-gray-800 mb-5 text-3xl font-semibold leading-tight" style={{ margin: 0, marginBottom: "21px" }}>
        Business Hours
      </Title>

      <Text className="text-gray-600 text-sm block mb-8">Set your clinic&apos;s operating hours</Text> */}

      {/* Quick Presets */}
      <div className="mb-8">
        <Text className="text-base font-medium text-gray-700 block mb-4">Quick Presets</Text>
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => handlePreset("mon-fri-9-5")}
            className="rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 h-auto"
          >
            Mon-Fri, 9AM-5PM
          </Button>
          <Button
            onClick={() => handlePreset("mon-sat-8-8")}
            className="rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 h-auto"
          >
            Mon-Sat, 8AM-8PM
          </Button>
          <Button className="rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 h-auto"  onClick={() => handlePreset("mon-sun-8-8")}>Custom</Button>
        </div>
      </div>

      {/* Business Hours Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mb-8">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_300px] bg-gray-50 p-4 border-b border-gray-200 font-medium text-gray-700">
          <div>Day of Week</div>
          <div>Status</div>
          <div>Hours</div>
        </div>

        {/* Days */}
        {DAYS_OF_WEEK.map((day, index) => (
          <div
            key={day}
            className={`grid grid-cols-[1fr_120px_300px] p-4 items-center ${
              index < DAYS_OF_WEEK.length - 1 ? "border-b border-gray-200" : ""
            }`}
          >
            {/* Day Name */}
            <div className="text-gray-700 font-medium">{day}</div>

            {/* Status Toggle */}
            <div>
              <Switch
                checked={businessHours[day]?.enabled}
                onChange={checked => handleDayToggle(day, checked)}
                className={businessHours[day]?.enabled ? "bg-purple-500" : "bg-gray-300"}
              />
            </div>

            {/* Hours */}
            <div>
              {businessHours[day]?.enabled ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={businessHours[day]?.start}
                    onChange={value => handleTimeChange(day, "start", value)}
                    className="w-30"
                    size="middle"
                  >
                    {TIME_OPTIONS.map(time => (
                      <Option key={time} value={time}>
                        {time}
                      </Option>
                    ))}
                  </Select>
                  <span className="text-gray-500">to</span>
                  <Select
                    value={businessHours[day]?.end}
                    onChange={value => handleTimeChange(day, "end", value)}
                    className="w-30"
                    size="middle"
                  >
                    {TIME_OPTIONS.map(time => (
                      <Option key={time} value={time}>
                        {time}
                      </Option>
                    ))}
                  </Select>
                </div>
              ) : (
                <span className="text-gray-400">Closed</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button onClick={onPrev} className="bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-2 h-auto">
          Previous
        </Button>

        <Button type="primary" onClick={handleNext} className="bg-purple-500 border-purple-500 h-13 text-base font-medium rounded-xl px-8">
          Continue to Next Step
        </Button>
      </div>
    </div>
  );
}
