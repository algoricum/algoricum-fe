"use client"

import type React from "react"

import { useState } from "react"
import { Form, Select, Upload } from "antd"
import  Button from "@/components/elements/Button"
import type { OnboardingData } from "./OnboardingContainer"
import { FileTextOutlined } from "@ant-design/icons"

interface Step3Props {
  formData: OnboardingData
  updateFormData: (data: Partial<OnboardingData>) => void
  isSubmitting:boolean
  onComplete: () => void
  onBack: () => void
}

const Step3BrandConfig: React.FC<Step3Props> = ({ formData, updateFormData, isSubmitting,onComplete, onBack }) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<any[]>([])

  const handleSubmit = (values: any) => {
    updateFormData({
      toneSelector: values.toneSelector,
      sentenceLength: values.sentenceLength,
      formalityLevel: values.formalityLevel,
    })
    onComplete()
  }

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e
    }
    return e?.fileList
  }

  const handleFileChange = (info: any) => {
    let fileList = [...info.fileList]
    fileList = fileList.slice(-1) // Keep only the latest file
    setFileList(fileList)

    if (fileList.length > 0) {
      updateFormData({ logo: fileList[0].originFileObj })
    } else {
      updateFormData({ logo: null })
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">
        Set Your Clinic's Tone And Visual Identity To Personalize Patient Interactions.
      </h1>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          toneSelector: formData.toneSelector,
          sentenceLength: formData.sentenceLength,
          formalityLevel: formData.formalityLevel,
        }}
        onFinish={handleSubmit}
      >
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Logo Upload</h2>
          <p className="mb-2">Clinic Logo</p>

          <Form.Item name="logo" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload.Dragger
              name="logo"
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false}
              maxCount={1}
              className="bg-white border-dashed border-2 border-gray-300 rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined size={24} className="text-gray-400" />
              </p>
              <p className="text-center mb-1">Drag and drop files here or click to upload</p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Upload.Dragger>
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <Form.Item
            label="Tone Selector"
            name="toneSelector"
            rules={[{ required: true, message: "Please select a tone" }]}
          >
            <Select
              placeholder="Type here"
              className="w-full"
              options={[
                { value: "friendly", label: "Friendly" },
                { value: "professional", label: "Professional" },
                { value: "casual", label: "Casual" },
                { value: "formal", label: "Formal" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Sentence Length"
            name="sentenceLength"
            rules={[{ required: true, message: "Please select a sentence length" }]}
          >
            <Select
              placeholder="Type here"
              className="w-full"
              options={[
                { value: "short", label: "Short" },
                { value: "medium", label: "Medium" },
                { value: "long", label: "Long" },
              ]}
            />
          </Form.Item>
        </div>

        <Form.Item
          label="Formality Level"
          name="formalityLevel"
          rules={[{ required: true, message: "Please select a formality level" }]}
        >
          <Select
            placeholder="Type here"
            className="w-full"
            options={[
              { value: "very_casual", label: "Very Casual" },
              { value: "casual", label: "Casual" },
              { value: "neutral", label: "Neutral" },
              { value: "formal", label: "Formal" },
              { value: "very_formal", label: "Very Formal" },
            ]}
          />
        </Form.Item>

        <div className="flex justify-end gap-3 mt-8">
        <div className="flex justify-end gap-3 mt-8 ">
          <Button light onClick={onBack} className="bg-gray-100 !px-5">
            Back
          </Button>
          <Button type="primary" className="!bg-brand-primary !px-5" htmlType="submit" loading={isSubmitting}>
            Complete
          </Button>
        </div>
        </div>
      </Form>
    </div>
  )
}

export default Step3BrandConfig
