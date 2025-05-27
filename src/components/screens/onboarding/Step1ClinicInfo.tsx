"use client"

import type React from "react"

import { useState } from "react"
import { Form, Input, Switch, Select } from "antd"
import Button from "@/components/elements/Button"
import type { OnboardingData } from "./OnboardingContainer"
import { ArrowLeftOutlined } from "@ant-design/icons"
import { BusinessHours } from "@/interfaces/services_type"
import { useAuth } from "@/hooks/useAuth"
import { ErrorToast, SuccessToast } from "@/helpers/toast"
import { useRouter } from "next/navigation"

interface Step1Props {
  formData: OnboardingData
  updateFormData: (data: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const Step1ClinicInfo: React.FC<Step1Props> = ({ formData, updateFormData, onNext, onBack }) => {
  const [form] = Form.useForm()
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [businessHours, setBusinessHours] = useState<BusinessHours>(formData.businessHours)
  const {logout} = useAuth()
  const {push} = useRouter()

  const handlePresetClick = (preset: string) => {
    setSelectedPreset(preset)
    const newHours: BusinessHours = { ...businessHours }

    if (preset === "Mon-Fri, 9AM-5PM") {
      // Monday to Friday, 9AM-5PM
      Object.keys(newHours).forEach((day) => {
        if (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(day)) {
          newHours[day] = { isOpen: true, openTime: "9:00 AM", closeTime: "5:00 PM" }
        } else {
          newHours[day] = { isOpen: false, openTime: "", closeTime: "" }
        }
      })
    } else if (preset === "Mon-Sat, 8AM-8PM") {
      // Monday to Saturday, 8AM-8PM
      Object.keys(newHours).forEach((day) => {
        if (day !== "Sunday") {
          newHours[day] = { isOpen: true, openTime: "8:00 AM", closeTime: "8:00 PM" }
        } else {
          newHours[day] = { isOpen: false, openTime: "", closeTime: "" }
        }
      })
    } else {
      // Custom - keep current hours
    }

    setBusinessHours(newHours)
    updateFormData({ businessHours: newHours })
  }

  const toggleDayStatus = (day: string) => {
    const newHours = { ...businessHours }
    newHours[day].isOpen = !newHours[day].isOpen

    if (newHours[day].isOpen && !newHours[day].openTime) {
      newHours[day].openTime = "9:00 AM"
      newHours[day].closeTime = "5:00 PM"
    }

    setBusinessHours(newHours)
    updateFormData({ businessHours: newHours })
    
    // Switch to Custom when user makes manual changes
    setSelectedPreset("Custom")
  }

  const updateHourTime = (day: string, type: "openTime" | "closeTime", value: string) => {
    const newHours = { ...businessHours }
    newHours[day][type] = value
    setBusinessHours(newHours)
    updateFormData({ businessHours: newHours })
    
    // Switch to Custom when user makes manual changes
    setSelectedPreset("Custom")
  }

  const handleSubmit = (values: any) => {
    updateFormData({
      legalBusinessName: values.legalBusinessName,
      dbaName: values.dbaName,
      clinicAddress: values.clinicAddress,
    })
    onNext()
  }

  const handleLogout = async () => {
    try {
      // Wait for logout to complete before continuing
      const success = await logout();
      if (success) {
        SuccessToast("Logout Successfully");
        push("/login"); // Only navigate after successful logout
      } else {
        ErrorToast("Logout failed. Please try again.");
      }
    } catch (error) {
      console.error("Logout error:", error);
      ErrorToast("Logout failed. Please try again.");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Let's Begin By Setting Up Your Clinic's Core Details.</h1>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          legalBusinessName: formData.legalBusinessName,
          dbaName: formData.dbaName,
          clinicAddress: formData.clinicAddress,
        }}
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Legal Business Name"
          name="legalBusinessName"
          rules={[{ required: true, message: "Please enter your legal business name" }]}
        >
          <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
        </Form.Item>

        <Form.Item label="DBA (Doing Business As) Name" name="dbaName">
          <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
        </Form.Item>

        <Form.Item
          label="Clinic Address"
          name="clinicAddress"
          rules={[{ required: true, message: "Please enter your clinic address" }]}
        >
          <Input placeholder="Type here" className="rounded-md py-2 px-3 bg-gray-50" />
        </Form.Item>

        <div className="mb-6">
          <label className="block text-sm font-extrabold mb-2">Business Hours</label>
          <div className="mb-2 font-extrabold">Quick Presets</div>
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              className={`px-4 py-4 border rounded-xl w-full ${selectedPreset === "Mon-Fri, 9AM-5PM" ? "border-gray-400 bg-gray-100 text-black" : "border-gray-200 bg-gray-50"
                }`}
              onClick={() => handlePresetClick("Mon-Fri, 9AM-5PM")}
            >
              Mon-Fri, 9AM-5PM
            </button>
            <button
              type="button"
              className={`px-4 py-4 border rounded-xl w-full ${selectedPreset === "Mon-Sat, 8AM-8PM" ? "border-gray-400 bg-gray-100 text-black" : "border-gray-200 bg-gray-50"
                }`}
              onClick={() => handlePresetClick("Mon-Sat, 8AM-8PM")}
            >
              Mon-Sat, 8AM-8PM
            </button>
            <button
              type="button"
              className={`px-4 py-4 border rounded-xl w-full ${selectedPreset === "Custom" ? "border-gray-400 bg-gray-100 text-black" : "border-gray-200 bg-gray-50"
                }`}
              onClick={() => handlePresetClick("Custom")}
            >
              Custom
            </button>
          </div>

          <div className="rounded-md overflow-hidden border border-gray-200">
            <div className="grid grid-cols-12 py-3 px-4 bg-gray-200">
              <div className="col-span-4">Day of Week</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-6">Hours</div>
            </div>

            {Object.keys(businessHours).map((day) => (
              <div key={day} className="grid grid-cols-12 py-3 px-4 border-t border-gray-200">
                <div className="col-span-4">{day}</div>
                <div className="col-span-2">
                  <Switch
                    checked={businessHours[day].isOpen}
                    onChange={() => toggleDayStatus(day)}
                    className={businessHours[day].isOpen ? "!bg-brand-primary" : ""}
                  />
                </div>
                <div className="col-span-6 flex items-center">
                  {businessHours[day].isOpen ? (
                    <>
                      <Select
                        value={businessHours[day].openTime}
                        onChange={(value) => updateHourTime(day, "openTime", value)}
                        className="w-24"
                        options={[
                          { value: "8:00 AM", label: "8:00 AM" },
                          { value: "9:00 AM", label: "9:00 AM" },
                          { value: "10:00 AM", label: "10:00 AM" },
                        ]}
                      />
                      <span className="mx-2">to</span>
                      <Select
                        value={businessHours[day].closeTime}
                        onChange={(value) => updateHourTime(day, "closeTime", value)}
                        className="w-24"
                        options={[
                          { value: "5:00 PM", label: "5:00 PM" },
                          { value: "6:00 PM", label: "6:00 PM" },
                          { value: "8:00 PM", label: "8:00 PM" },
                          { value: "10:00 PM", label: "10:00 PM" },
                        ]}
                      />
                    </>
                  ) : (
                    <span className="text-gray-500">Closed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3 mt-8 ">
          <div onClick={handleLogout} className="text-brand-primary !px-5 py-3 cursor-pointer">
            <ArrowLeftOutlined /> Logout
          </div>
          <Button type="primary" className="!bg-brand-primary !px-5" htmlType="submit">
            Next
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default Step1ClinicInfo