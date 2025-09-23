"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { CalendarOutlined, ClockCircleOutlined, MailOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { DatePicker, Form, Input, TimePicker, Modal } from "antd";
import dayjs from "dayjs";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useEffect } from "react";

const { TextArea } = Input;

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  isSubmitting: boolean;
  clinicId: string | null;
}

export function AddAppointmentModal({ isOpen, onClose, onSubmit, isSubmitting }: AddAppointmentModalProps) {
  const [form] = Form.useForm();
  const { phoneNumber, phoneError, handlePhoneChange, handlePhoneBlur, resetPhone } = usePhoneValidation();

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
      resetPhone();
    }
  }, [isOpen, form]);
  if (!isOpen) return null;
  const handleSubmit = async (values: any) => {
    if (phoneError) {
      return;
    }

    // Combine date and time into a full datetime
    let fullDateTime = null;
    if (values.preferred_meeting_date && values.preferred_meeting_time) {
      const date = dayjs(values.preferred_meeting_date).format("YYYY-MM-DD");
      const time = dayjs(values.preferred_meeting_time).format("HH:mm:ss");
      fullDateTime = `${date} ${time}`;
    }

    const formData = {
      ...values,
      phone_number: phoneNumber,
      preferred_meeting_time: fullDateTime,
    };

    await onSubmit(formData);
  };

  const handleClose = () => {
    form.resetFields();
    resetPhone();
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="h-5 w-5 text-purple-600" />
          <div>
            <h3 className="text-lg font-semibold">Schedule a Meeting</h3>
            <p className="text-sm text-gray-600">Fill out the form below to schedule your meeting with us</p>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      {isSubmitting && (
        <div className="mb-4">
          <LoadingSpinner message="Scheduling meeting..." size="sm" />
        </div>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} className="space-y-4 mt-6">
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
              placeholder="Enter your last name"
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
            placeholder="Enter your email"
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
            placeholder="Enter your phone number"
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

        <Form.Item label="Meeting Notes" name="meeting_notes">
          <TextArea placeholder="Add any additional notes or topics you'd like to discuss..." rows={4} disabled={isSubmitting} showCount />
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
            {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
          </button>
        </div>
      </Form>
    </Modal>
  );
}
