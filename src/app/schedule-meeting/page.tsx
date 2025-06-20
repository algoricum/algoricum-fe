"use client";

import { useState } from "react";
import { Form, Input, Button, Card, TimePicker, DatePicker, message } from "antd";
import { CalendarOutlined, ClockCircleOutlined, UserOutlined, MailOutlined } from "@ant-design/icons";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const { TextArea } = Input;

const Page = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      // Combine date and time into a full datetime
      let fullDateTime = null;
      if (values.preferred_meeting_date && values.preferred_meeting_time) {
        const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
        const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
        fullDateTime = `${date} ${time}`;
      }

      const { error } = await supabase.from("meeting_schedule").insert([
        {
          username: values.username,
          email: values.email,
          preferred_meeting_time: fullDateTime,
          meeting_notes: values.meeting_notes || null,
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          message.error("This email is already registered for a meeting");
        } else {
          throw error;
        }
        return;
      }

      message.success("Meeting schedule saved successfully!");
      form.resetFields();
    } catch (error: any) {
      console.error("Error saving meeting schedule:", error);
      message.error(error.message || "Failed to save meeting schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
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
                  Name
                </span>
              }
              name="username"
              rules={[
                { required: true, message: "Username is required" },
                { max: 50, message: "Username cannot exceed 50 characters" },
              ]}
            >
              <Input placeholder="Enter your username" maxLength={50} />
            </Form.Item>

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
              <Input placeholder="Enter your email" maxLength={100} />
            </Form.Item>
          </div>

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
              <TimePicker format="HH:mm" placeholder="Select time (e.g., 16:30)" className="w-full" minuteStep={15} showNow={false} />
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
  );
};

export default Page;
