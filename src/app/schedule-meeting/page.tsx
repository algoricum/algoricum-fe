"use client";

import { useState } from "react";
import { Form, Input, Button, Card, TimePicker, DatePicker, message } from "antd";
import { CalendarOutlined, ClockCircleOutlined, UserOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/common";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import ScheduleMeetingLayout from "@/layouts/ScheduleMeetingLayout";

const { TextArea } = Input;

const Page = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("clinic_id");

  const validatePhoneNumber = (phone: string | undefined): boolean => {
    if (!phone) {
      setPhoneError("Phone number is required");
      return false;
    }

    try {
      // Check if the phone number is valid
      if (!isValidPhoneNumber(phone)) {
        setPhoneError("Please enter a valid phone number");
        return false;
      }

      // Parse the phone number to verify country-specific validity
      const phoneNumberObj = parsePhoneNumber(phone);
      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        setPhoneError("Invalid phone number for the selected country");
        return false;
      }

      setPhoneError("");
      return true;
    } catch (error) {
      setPhoneError("Invalid phone number format");
      return false;
    }
  };

  const handlePhoneChange = (value: string | undefined) => {
    setPhoneNumber(value || "");
    // Only validate if the input is not empty to avoid premature error messages
    if (value) {
      validatePhoneNumber(value);
    } else {
      setPhoneError("");
    }
  };

  const handlePhoneBlur = () => {
    validatePhoneNumber(phoneNumber);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      // Validate phone number before submission
      if (!validatePhoneNumber(phoneNumber)) {
        return;
      }

      // Combine date and time into a full datetime
      let fullDateTime = null;
      if (values.preferred_meeting_date && values.preferred_meeting_time) {
        const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
        const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
        fullDateTime = `${date} ${time}`;
      }

      const { error } = await supabase.from("meeting_schedule").insert([
        {
          username: `${values.first_name} ${values.last_name}`.trim(),
          email: values.email,
          phone_number: phoneNumber,
          preferred_meeting_time: fullDateTime,
          meeting_notes: values.meeting_notes || null,
          clinic_id: clinicId,
        },
      ]);

      const { data: leadSourceData, error: leadSourceError } = await supabase
        .from("lead_source")
        .select("id")
        .eq("name", "others")
        .single();

      const { error: leadError } = await supabase.from("lead").insert([
        {
          first_name: `{values.first_name}`.trim(),
          last_name: `{values.last_name}`.trim(),
          email: values.email,
          phone: phoneNumber,
          status: "Booked",
          clinicId: clinicId,
          lead_source: leadSourceData?.id,
        },
      ]);

      if (error || leadError || leadSourceError) {
        if (error?.code === "23505") {
          message.error("This email is already registered for a meeting");
        } else {
          throw error;
        }
        return;
      }

      message.success("Meeting schedule saved successfully!");
      form.resetFields();
      setPhoneNumber("");
      setPhoneError("");
    } catch (error: any) {
      console.error("Error saving meeting schedule:", error);
      message.error(error.message || "Failed to save meeting schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScheduleMeetingLayout>
      <Header />

      <div className="max-w-2xl mx-auto p-6">
        <Card
          title={
            <div className="flex items-center gap-2">
              <CalendarOutlined />
              Schedule a Meeting
            </div>
          }
        >
          <p className="text-gray-600 mb-6">Fill out the form below to schedule your meeting with us</p>

          <Form form={form} layout="vertical" onFinish={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label={
                  <span className="flex items-center gap-2">
                    <UserOutlined />
                    First Name
                  </span>
                }
                name="first_name"
                rules={[
                  { required: true, message: "First name is required" },
                  { max: 25, message: "First name cannot exceed 25 characters" },
                ]}
              >
                <Input
                  placeholder="Enter your first name"
                  maxLength={25}
                  onBlur={() => {
                    form.validateFields(["first_name"]);
                  }}
                />
              </Form.Item>

              <Form.Item
                label={
                  <span className="flex items-center gap-2">
                    <UserOutlined />
                    Last Name
                  </span>
                }
                name="last_name"
                rules={[
                  { required: true, message: "Last name is required" },
                  { max: 25, message: "Last name cannot exceed 25 characters" },
                ]}
              >
                <Input
                  placeholder="Enter your last name"
                  maxLength={25}
                  onBlur={() => {
                    form.validateFields(["last_name"]);
                  }}
                />
              </Form.Item>
            </div>

            <Form.Item
              label={
                <span className="flex items-center gap-2">
                  <MailOutlined />
                  Email
                </span>
              }
              name="email"
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Please enter a valid email address" },
                { max: 100, message: "Email cannot exceed 100 characters" },
              ]}
            >
              <Input
                placeholder="Enter your email"
                maxLength={100}
                onBlur={() => {
                  form.validateFields(["email"]);
                }}
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="flex items-center gap-2">
                  <PhoneOutlined />
                  Contact Number
                </span>
              }
              required
              validateStatus={phoneError ? "error" : ""}
              help={phoneError}
            >
              <PhoneInput
                international
                countryCallingCodeEditable={false}
                defaultCountry="US"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
                placeholder="Enter your phone number"
                className="ant-input"
                style={{
                  padding: "4px 11px",
                  border: phoneError ? "1px solid #ff4d4f" : "1px solid #d9d9d9",
                  borderRadius: "6px",
                  fontSize: "14px",
                  lineHeight: "1.5714285714285714",
                  color: "rgba(0, 0, 0, 0.88)",
                  backgroundColor: "#ffffff",
                  transition: "all 0.2s",
                }}
              />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label={
                  <span className="flex items-center gap-2">
                    <CalendarOutlined />
                    Preferred Meeting Date
                  </span>
                }
                name="preferred_meeting_date"
                rules={[{ required: true, message: "Please select a meeting date" }]}
              >
                <DatePicker
                  format="YYYY-MM-DD"
                  placeholder="Select date"
                  className="w-full"
                  disabledDate={current => current && current < dayjs().startOf("day")}
                  onBlur={() => {
                    form.validateFields(["preferred_meeting_date"]);
                  }}
                />
              </Form.Item>

              <Form.Item
                label={
                  <span className="flex items-center gap-2">
                    <ClockCircleOutlined />
                    Preferred Meeting Time
                  </span>
                }
                name="preferred_meeting_time"
                rules={[{ required: true, message: "Please select a meeting time" }]}
              >
                <TimePicker
                  format="HH:mm"
                  placeholder="Select time (e.g., 16:30)"
                  className="w-full"
                  minuteStep={15}
                  showNow={false}
                  onBlur={() => {
                    form.validateFields(["preferred_meeting_time"]);
                  }}
                />
              </Form.Item>
            </div>

            <Form.Item label="Meeting Notes" name="meeting_notes">
              <TextArea placeholder="Add any additional notes or topics you'd like to discuss..." rows={4} showCount />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} className="w-full" size="large">
                {loading ? "Scheduling..." : "Schedule Meeting"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </ScheduleMeetingLayout>
  );
};

export default Page;
