"use client"

import type React from "react"

import { Form, Input } from "antd"
import  Button from "@/components/elements/Button"
import type { OnboardingData } from "./OnboardingContainer"
import { CalendarOutlined } from "@ant-design/icons"

interface Step2Props {
  formData: OnboardingData
  updateFormData: (data: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const Step2ContactInfo: React.FC<Step2Props> = ({ formData, updateFormData, onNext, onBack }) => {
  const [form] = Form.useForm()

  const handleSubmit = (values: any) => {
    updateFormData({
      fullName: values.fullName,
      emailAddress: values.emailAddress,
      phoneNumber: values.phoneNumber,
      calendlyLink: values.calendlyLink,
    })
    onNext()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">
        Help Patients Reach The Right Person. Let's Set Your Main Contact And Booking Preferences.
      </h1>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          fullName: formData.fullName,
          emailAddress: formData.emailAddress,
          phoneNumber: formData.phoneNumber,
          calendlyLink: formData.calendlyLink,
        }}
        onFinish={handleSubmit}
      >
        <div className="mb-6">
          <h2 className="text-lg font-extrabold mb-4">Primary Contact</h2>

          <Form.Item
            label="Full Name (optional)"
            name="fullName"
            rules={[{ required: false, message: "Please enter the contact's full name" }]}
          >
            <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
          </Form.Item>

          <Form.Item
            label="Email Address (optional)"
            name="emailAddress"
            rules={[
              { required: false, message: "Please enter an email address" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
          </Form.Item>

          <Form.Item
            label="Phone Number (optional)"
            name="phoneNumber"
            rules={[{ required: false, message: "Please enter a phone number" }]}
          >
            <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
          </Form.Item>

          <Form.Item label="Calendly Link (optional)" name="calendlyLink">
            <Input
              placeholder="Enter your Calendly URL"
              className="rounded-md py-2 px-3 bg-gray-50"
              prefix={<CalendarOutlined size={16} className="text-gray-400 mr-2" />}
            />
          </Form.Item>
          <p className="text-sm text-gray-500 -mt-2">Add your Calendly URL for online scheduling</p>
        </div>

        <div className="flex justify-end gap-3 mt-8 ">
          <Button light onClick={onBack} className="bg-gray-100 !px-5">
            Back
          </Button>
          <Button type="primary" className="!bg-brand-primary !px-5" htmlType="submit">
            Next
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default Step2ContactInfo
