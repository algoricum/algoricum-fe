"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Form, Select, Upload } from "antd"
import Button from "@/components/elements/Button"
import type { OnboardingData } from "./OnboardingContainer"
import { FileTextOutlined, FilePdfOutlined } from "@ant-design/icons"

interface Step3Props {
  formData: OnboardingData
  updateFormData: (data: Partial<OnboardingData>) => void
  isSubmitting: boolean
  onComplete: () => void
  onBack: () => void
}

const Step3BrandConfig: React.FC<Step3Props> = ({ formData, updateFormData, isSubmitting, onComplete, onBack }) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<any[]>([])
  const [docFileList, setDocFileList] = useState<any[]>([])

  const handleSubmit = () => {
    onComplete();
  }

  // Handle dropdown changes
  const handleToneChange = (value: string) => {
    updateFormData({ tone_selector: value });
  }

  const handleSentenceLengthChange = (value: string) => {
    updateFormData({ sentence_length: value });
  }

  const handleFormalityLevelChange = (value: string) => {
    updateFormData({ formality_level: value });
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

  const handleDocFileChange = (info: any) => {
    let fileList = [...info.fileList]
    fileList = fileList.slice(-1) // Keep only the latest file
    setDocFileList(fileList)

    if (fileList.length > 0) {
      updateFormData({ clinic_document: fileList[0].originFileObj })
    } else {
      updateFormData({ clinic_document: null })
    }
  }

  useEffect(() => {
    form.setFields([
      {
        name: 'tone_selector',
        value: formData.tone_selector
      },
      {
        name: 'sentence_length',
        value: formData.sentence_length
      },
      {
        name: 'formality_level',
        value: formData.formality_level
      },
    ]);
  }, [formData, form]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">
        Set Your Clinic's Tone And Visual Identity To Personalize Patient Interactions.
      </h1>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          tone_selector: formData.tone_selector,
          sentence_length: formData.sentence_length,
          formality_level: formData.formality_level,
        }}
        onFinish={handleSubmit}
      >
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Upload Logo</h2>
          <p className="mb-2">Clinic Logo</p>

          <Form.Item name="logo" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload.Dragger
              name="logo"
              fileList={fileList}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={(file) => {
                const isValidType = 
                  file.type === 'image/jpeg' || 
                  file.type === 'image/png' || 
                  file.type === 'image/svg+xml';
                
                if (!isValidType) {
                  alert('You can only upload JPG, PNG, or SVG files!');
                }
                
                return false; // Prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined className="text-gray-400" />
              </p>
              <p className="text-center mb-1">Drag and drop files here or click to upload</p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Upload.Dragger>
          </Form.Item>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Upload Clinic Details Document</h2>
          <p className="mb-2">Services and details document for AI processing (PDF, DOC, DOCX)</p>

          <Form.Item name="clinic_document" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload.Dragger
              name="clinic_document"
              fileList={docFileList}
              onChange={handleDocFileChange}
              accept=".pdf,.doc,.docx"
              beforeUpload={(file) => {
                const isValidType = 
                  file.type === 'application/pdf' || 
                  file.type === 'application/msword' || 
                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                
                if (!isValidType) {
                  alert('You can only upload PDF, DOC, or DOCX files!');
                }
                
                return false; // Prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FilePdfOutlined className="text-gray-400" />
              </p>
              <p className="text-center mb-1">Drag and drop files here or click to upload</p>
              <p className="text-center text-xs text-gray-500">PDF, DOC, DOCX</p>
              <p className="text-center text-xs text-gray-400 mt-1">This will be used by the AI to answer questions about your clinic</p>
            </Upload.Dragger>
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <Form.Item
            label="Tone Selector"
            name="tone_selector"
            rules={[{ required: true, message: "Please select a tone" }]}
          >
            <Select
              placeholder="Select Tone"
              className="w-full"
              onChange={handleToneChange}
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
            name="sentence_length"
            rules={[{ required: true, message: "Please select a sentence length" }]}
          >
            <Select
              placeholder="Select Sentence Length"
              className="w-full"
              onChange={handleSentenceLengthChange}
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
          name="formality_level"
          rules={[{ required: true, message: "Please select a formality level" }]}
        >
          <Select
            placeholder="Select Formality Level"
            className="w-full"
            onChange={handleFormalityLevelChange}
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
          <Button light onClick={onBack} className="bg-gray-100 !px-5">
            Back
          </Button>
          <Button type="primary" className="!bg-brand-primary !px-5" htmlType="submit" loading={isSubmitting}>
            Complete
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default Step3BrandConfig