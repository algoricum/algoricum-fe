"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Form, Select, Upload } from "antd"
import Button from "@/components/elements/Button"
import type { OnboardingData } from "./OnboardingContainer"
import { FileTextOutlined, FilePdfOutlined, MessageOutlined } from "@ant-design/icons"
import { getPreviewText } from "@/utils/getPreviewChatbot"

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

        {/* Communication Style Section */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-2">Communication Style</h2>
          <p className="text-sm text-gray-600 mb-6">
            Choose how your AI assistant sounds when talking to patients. These settings will shape every interaction.
          </p>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <Form.Item
              label="Tone Selector"
              name="tone_selector"
              rules={[{ required: true, message: "Please select a tone" }]}
            >
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-2">How warm and approachable should your assistant sound?</p>
              </div>
              <Select
                placeholder="Select Tone"
                className="w-full"
                onChange={handleToneChange}
                options={[
                  { value: "friendly", label: "Friendly - Warm and welcoming" },
                  { value: "professional", label: "Professional - Competent and reliable" },
                  { value: "casual", label: "Casual - Relaxed and conversational" },
                  { value: "formal", label: "Formal - Respectful and structured" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Sentence Length"
              name="sentence_length"
              rules={[{ required: true, message: "Please select a sentence length" }]}
            >
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-2">How detailed should responses be?</p>
              </div>
              <Select
                placeholder="Select Sentence Length"
                className="w-full"
                onChange={handleSentenceLengthChange}
                options={[
                  { value: "short", label: "Short - Quick and concise" },
                  { value: "medium", label: "Medium - Balanced detail" },
                  { value: "long", label: "Long - Comprehensive explanations" },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Formality Level"
            name="formality_level"
            rules={[{ required: true, message: "Please select a formality level" }]}
          >
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-2">How formal should the language be?</p>
            </div>
            <Select
              placeholder="Select Formality Level"
              className="w-full"
              onChange={handleFormalityLevelChange}
              options={[
                { value: "very_casual", label: "Very Casual - Like talking to a friend" },
                { value: "casual", label: "Casual - Relaxed but respectful" },
                { value: "neutral", label: "Neutral - Balanced approach" },
                { value: "formal", label: "Formal - Professional courtesy" },
                { value: "very_formal", label: "Very Formal - Traditional business style" },
              ]}
            />
          </Form.Item>

          {/* Live Preview Section */}
          {(formData.tone_selector || formData.formality_level || formData.sentence_length) && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <MessageOutlined className="text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Preview: How your assistant will greet patients</h3>
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-gray-800 italic">"{getPreviewText({
                      tone: formData.tone_selector,
                      formality:  formData.formality_level,
                      length: formData.sentence_length
                    })}"</p>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    This preview updates as you change your settings above
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

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