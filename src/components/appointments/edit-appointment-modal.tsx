"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { CalendarOutlined, ClockCircleOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { DatePicker, Form, Input, TimePicker, Select } from "antd";
import dayjs from "dayjs";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import { X } from "lucide-react";
import { useEffect } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import type { MeetingSchedule } from "@/utils/appointment-helper";

const { TextArea } = Input;
const { Option } = Select;

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  isSubmitting: boolean;
  appointment: MeetingSchedule | null;
}

export function EditAppointmentModal({ isOpen, onClose, onSubmit, isSubmitting, appointment }: EditAppointmentModalProps) {
  const [form] = Form.useForm();
  const { phoneNumber, phoneError, handlePhoneChange, handlePhoneBlur, setPhoneNumber } = usePhoneValidation();

  // Initialize form when appointment data is available
  useEffect(() => {
    if (appointment && isOpen) {
      // Parse the username into first_name and last_name
      const nameParts = appointment.username.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Parse the datetime
      let meetingDate = null;
      let meetingTime = null;
      if (appointment.preferred_meeting_time) {
        const datetime = dayjs(appointment.preferred_meeting_time);
        meetingDate = datetime;
        meetingTime = datetime;
      }

      form.setFieldsValue({
        first_name: firstName,
        last_name: lastName,
        email: appointment.email,
        preferred_meeting_date: meetingDate,
        preferred_meeting_time: meetingTime,
        meeting_notes: appointment.meeting_notes || "",
        status: appointment.status,
      });

      setPhoneNumber(appointment.phone_number || "");
    }
  }, [appointment, isOpen, form, setPhoneNumber]);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (values: any) => {
    if (phoneError) {
      return;
    }

    // Combine first_name and last_name into username
    const username = `${values.first_name.trim()} ${values.last_name.trim()}`.trim();

    // Combine date and time into a full datetime
    let fullDateTime = null;
    if (values.preferred_meeting_date && values.preferred_meeting_time) {
      const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
      const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
      fullDateTime = `${date} ${time}`;
    }

    const formData = {
      username,
      email: values.email,
      phone_number: phoneNumber,
      preferred_meeting_time: fullDateTime,
      meeting_notes: values.meeting_notes || null,
      status: values.status,
    };

    await onSubmit(formData);
  };

  const handleClose = () => {
    form.resetFields();
    setPhoneNumber("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOutlined className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Edit Appointment</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <p className="mb-6 text-gray-600">Update the appointment details below</p>

        {isSubmitting && (
          <div className="mb-4">
            <LoadingSpinner message="Updating appointment..." size="sm" />
          </div>
        )}

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
                placeholder="Enter first name"
                maxLength={25}
                disabled={isSubmitting}
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
                placeholder="Enter last name"
                maxLength={25}
                disabled={isSubmitting}
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
              placeholder="Enter email"
              maxLength={100}
              disabled={isSubmitting}
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
              placeholder="Enter phone number"
              disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                minuteStep={15}
                showNow={false}
                onBlur={() => {
                  form.validateFields(["preferred_meeting_time"]);
                }}
              />
            </Form.Item>
          </div>

          <Form.Item label="Status" name="status" rules={[{ required: true, message: "Please select a status" }]}>
            <Select placeholder="Select status" disabled={isSubmitting} className="w-full">
              <Option value="booked">Booked</Option>
              <Option value="confirmed">Confirmed</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Meeting Notes" name="meeting_notes">
            <TextArea
              placeholder="Add any additional notes or topics you'd like to discuss..."
              rows={4}
              disabled={isSubmitting}
              showCount
            />
          </Form.Item>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Appointment"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
