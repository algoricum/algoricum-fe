"use client"
import { useState, useEffect } from "react"
import { Flex, Form, Input, Upload } from "antd"
import { Button } from "@/components/elements"
import { FileTextOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"
import { ColorConfigurator, WidgetPreview } from "@/components/common"
import ChatbotConnectModal from "@/components/common/ChatbotConnectModal.jsx"

const { TextArea } = Input

const ChatbotSettings = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState("sk-129g-abc1-123456xyz")
  const [fileList, setFileList] = useState([])
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [chatbotSettings, setChatbotSettings] = useState({
    greeting: "Welcome! How can I assist you today?",
    theme: "purple",
    logo: null,
    primaryColor: "#6366F1",
    fontColor: "#FFFFFF",
  })

  useEffect(() => {
    const fetchChatbotSettings = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase
          .from("chatbot_settings")
          .select("*")
          .eq("clinic_id", localStorage.getItem("clinic_id"))
          .single()

        if (error && error.code !== "PGRST116") throw error
        if (data) {
          setChatbotSettings(data)
          form.setFieldsValue({
            greeting: data.greeting,
            theme: data.theme,
            primaryColor: data.primaryColor,
            fontColor: data.fontColor,
          })
          setApiKey(data.api_key || apiKey)
        }
      } catch (error:any) {
        console.error("Error fetching chatbot settings:", error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchChatbotSettings()
  }, [form])

  const handleSave = async (values:any) => {
    try {
      setLoading(true)
      const supabase = createClient()

      const { error } = await supabase.from("chatbot_settings").upsert({
        clinic_id: localStorage.getItem("clinic_id"),
        greeting: values.greeting,
        theme: values.theme,
        primaryColor: values.primaryColor,
        fontColor: values.fontColor,
        api_key: apiKey,
      })

      if (error) throw error
      SuccessToast("Chatbot settings saved successfully")
    } catch (error:any) {
      ErrorToast(error.message || "Failed to save chatbot settings")
    } finally {
      setLoading(false)
    }
  }

  const normFile = (e:any) => {
    if (Array.isArray(e)) {
      return e
    }
    return e?.fileList
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 rounded-[20px] border border-gray-200 p-4 bg-Gray100 gap-4">
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={chatbotSettings}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Chatbot Settings</h2>
            <Button 
              type="primary" 
              onClick={() => setIsConnectModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Connect Chatbot
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
                description="Main widget color" 
                color={chatbotSettings.primaryColor}
              />
              <ColorConfigurator 
                fieldName="font_color" 
                heading="Font color" 
                description="Text color in widget" 
                color={chatbotSettings.fontColor}
              />
            </Flex>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Flex flex={1} justify="center" className="max-sm:hidden">
        <WidgetPreview primaryColor={chatbotSettings.primaryColor} />
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