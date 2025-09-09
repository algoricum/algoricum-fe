"use client";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import { CalendarOutlined, ClockCircleOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Form, Input, message, TimePicker } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

const { TextArea } = Input;

interface ScheduleMeetingFormProps {
  supabase: any; // Pass supabase client instance
  clinicId: string | null;
  onSuccess?: () => void; // Optional callback when meeting is successfully scheduled
}

const ScheduleMeetingForm = ({ supabase, clinicId, onSuccess }: ScheduleMeetingFormProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { phoneNumber, phoneError, validatePhoneNumber, handlePhoneChange, handlePhoneBlur } = usePhoneValidation();

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      // Validate phone number before submission
      if (!validatePhoneNumber(phoneNumber)) return;

      // Combine date and time into full datetime
      let fullDateTime = null;
      if (values.preferred_meeting_date && values.preferred_meeting_time) {
        const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
        const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
        fullDateTime = `${date} ${time}`;
      }

      // Insert into meeting_schedule
      const { error } = await supabase.from("meeting_schedule").upsert(
        [
          {
            username: `${values.first_name} ${values.last_name}`.trim(),
            email: values.email,
            phone_number: phoneNumber || values.phone_number,
            preferred_meeting_time: fullDateTime,
            meeting_notes: values.meeting_notes || null,
            clinic_id: clinicId,
          },
        ],
        { onConflict: "email" },
      );

      // Fetch lead source id
      const { data: leadSourceData, error: leadSourceError } = await supabase
        .from("lead_source")
        .select("id")
        .eq("name", "Others")
        .single();

      // Insert into leads
      const { error: leadError } = await supabase.from("lead").upsert(
        [
          {
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            email: values.email,
            phone: phoneNumber || values.phone_number,
            status: "Booked",
            clinic_id: clinicId,
            interest: "medium",
            lead_source: leadSourceData?.id,
          },
        ],
        { onConflict: "email,clinic_id" },
      );

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
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error saving meeting schedule:", err);
      message.error(err.message || "Failed to save meeting schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
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
                <UserOutlined /> First Name
              </span>
            }
            name="first_name"
            rules={[
              { required: true, message: "First name is required" },
              { max: 25, message: "First name cannot exceed 25 characters" },
            ]}
          >
            <Input placeholder="Enter your first name" maxLength={25} />
          </Form.Item>

          <Form.Item
            label={
              <span className="flex items-center gap-2">
                <UserOutlined /> Last Name
              </span>
            }
            name="last_name"
            rules={[
              { required: true, message: "Last name is required" },
              { max: 25, message: "Last name cannot exceed 25 characters" },
            ]}
          >
            <Input placeholder="Enter your last name" maxLength={25} />
          </Form.Item>
        </div>

        <Form.Item
          label={
            <span className="flex items-center gap-2">
              <MailOutlined /> Email
            </span>
          }
          name="email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Please enter a valid email" },
            { max: 100, message: "Email cannot exceed 100 characters" },
          ]}
        >
          <Input placeholder="Enter your email" maxLength={100} />
        </Form.Item>

        <Form.Item
          label={
            <span className="flex items-center gap-2">
              <PhoneOutlined /> Contact Number
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
          />
        </Form.Item>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            label={
              <span className="flex items-center gap-2">
                <CalendarOutlined /> Preferred Meeting Date
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
                <ClockCircleOutlined /> Preferred Meeting Time
              </span>
            }
            name="preferred_meeting_time"
            rules={[{ required: true, message: "Please select a meeting time" }]}
          >
            <TimePicker format="HH:mm" placeholder="Select time (e.g., 16:30)" className="w-full" minuteStep={15} showNow={false} />
          </Form.Item>
        </div>

        <Form.Item label="Meeting Notes" name="meeting_notes">
          <TextArea placeholder="Add any additional notes..." rows={4} showCount />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} className="w-full" size="large">
            {loading ? "Scheduling..." : "Schedule Meeting"}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ScheduleMeetingForm;
