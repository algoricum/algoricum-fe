"use client"
import { useState, useEffect } from "react"
import { Flex, Form, Input, message, Select, Upload } from "antd"
import { Button } from "@/components/elements"
import { FileTextOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"
import { ColorConfigurator, WidgetPreview } from "@/components/common"
import ChatbotConnectModal from "@/components/common/ChatbotConnectModal.jsx"
import { getClinicData, updateClinic } from "@/utils/supabase/clinic-helper"
import { uploadClinicLogo } from "@/utils/supabase/clinic-uploads"
import { getUserData } from "@/utils/supabase/user-helper"

const { TextArea } = Input

const ChatbotSettings = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState("sk-129g-abc1-123456xyz")
  const primaryColor = Form.useWatch("primary_color", form);
  const [fileList, setFileList] = useState([])
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [clinicData,setClinicData] = useState<any>()

  useEffect(() => {
    const fetchChatbotSettings = async () => {
      try {
        setLoading(true)
        const clinic = await getClinicData()
        setClinicData(clinic)
        if (clinic) {
          form.setFieldsValue({
            greeting: clinic.assistant_prompt,
            primary_color: clinic.widget_theme?.primary_color,
            font_color: clinic.widget_theme?.font_color,
            toneSelector: clinic.tone_selector || "friendly",
            sentenceLength: clinic.sentence_length || "medium",
            formalityLevel: clinic.formality_level || "neutral"
          })
          setApiKey(apiKey)
        }
      } catch (error: any) {
        console.error("Error fetching chatbot settings:", error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchChatbotSettings()
  }, [form])

  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const user = await getUserData();
      if (!user) {
        ErrorToast("User not found. Please logout and log in again.");
        setLoading(false);
        return;
      }
      let logoUrl
      console.log(values.logo)
      if (values.logo) {
        logoUrl = await uploadClinicLogo(user.id, values.logo[0]);
      }

      const clinic = await updateClinic({
        id: clinicData.id,
        assistant_prompt: values.greeting,
        widget_logo:logoUrl,
        widget_theme: {primary_color:values.primary_color,font_color: values.font_color},
        tone_selector: values.toneSelector,
        sentence_length: values.sentenceLength,
        formality_level: values.formalityLevel
      })

      if (!clinic) throw {message:"Failed to save chatbot settings"}
      SuccessToast("Chatbot settings saved successfully")
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings")
    } finally {
      setLoading(false)
    }
  }

  // Handle dropdown changes - using form instance to update values
  const handleToneChange = (value: any) => {
    form.setFieldsValue({ toneSelector: value });
  }

  const handleSentenceLengthChange = (value: any) => {
    form.setFieldsValue({ sentenceLength: value });
  }

  const handleFormalityLevelChange = (value: any) => {
    form.setFieldsValue({ formalityLevel: value });
  }

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e
    }
    return e?.fileList
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 rounded-[20px] border border-gray-200 p-4 bg-Gray100 gap-4">
        <Form form={form} layout="vertical" onFinish={handleSave} name="themeForm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Chatbot Settings</h2>
            <Button
              type="primary"
              onClick={() => setIsConnectModalOpen(true)}
              className="bg-brand-primary hover:!bg-brand-secondary !hover:text-white text-white py-2 rounded-md"
            >
              Generate Script
            </Button>
          </div>

          <Form.Item
            label="Greeting Message For Visitors"
            name="greeting"
            rules={[{ required: true, message: "Please enter a greeting message" }]}
          >
            <TextArea rows={4} placeholder="Enter a friendly greeting message" />
          </Form.Item>

          <Form.Item
            name="logo"
            label="Upload Chatbot Logo"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload.Dragger
              name="logo"
              fileList={fileList}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={(file) => {
                const isJpgOrPngOrSvg =
                  file.type === 'image/jpeg' ||
                  file.type === 'image/png' ||
                  file.type === 'image/svg+xml';

                if (!isJpgOrPngOrSvg) {
                  ErrorToast('You can only upload JPG, PNG, or SVG files!');
                }

                return false; // Return false to prevent automatic upload
              }}
              maxCount={1}
              className="bg-white rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined className="text-gray-400" />
              </p>
              <p className="text-center mb-1">
                Drag and drop files here or click to upload <span className="text-brand-primary">Browse Files</span>
              </p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item label="Widget Appearance">
            <Flex>
              <ColorConfigurator
                fieldName="primary_color"
                heading="Primary color"
              />
              <div className="me-3"></div>
              <ColorConfigurator
                fieldName="font_color"
                heading="Font color"
              />
            </Flex>
          </Form.Item>

          <Form.Item
            label="Tone Selector"
            name="toneSelector"
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
            name="sentenceLength"
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

          <Form.Item
            label="Formality Level"
            name="formalityLevel"
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

          <Form.Item>
            <Button
              type="primary"
              className="bg-brand-primary hover:!bg-brand-secondary !hover:text-white text-white py-2 rounded-md"
              htmlType="submit"
              loading={loading}
            >
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Flex flex={1} justify="center" className="max-sm:hidden">
        <WidgetPreview primaryColor={primaryColor} />
      </Flex>

      {/* Chatbot Connect Modal */}
      <ChatbotConnectModal
        apiKey={apiKey}
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  )
}

export default ChatbotSettings