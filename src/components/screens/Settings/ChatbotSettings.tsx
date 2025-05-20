"use client"
import { useState, useEffect } from "react"
import { Flex, Form, Input, Select, Upload } from "antd"
import { Button } from "@/components/elements"
import { UploadOutlined, CopyOutlined, FileTextOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { createClient } from "@/utils/supabase/config/client"
import { ColorConfigurator, WidgetPreview } from "@/components/common"
import SettingsCard from "./SettingsCard"

const { TextArea } = Input

const ChatbotSettings = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState("sk-129g-abc1-123456xyz")
    const [fileList, setFileList] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<"html" | "react">("html")
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
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings")
    } finally {
      setLoading(false)
    }
  }

  const generateScript = () => {
    if (activeTab === "html") {
      return `
<script>
  // No installation needed, just include the script tag inside the <head> of your public/index.html or
  // document.tsx.
  useEffect(() => {
    const script = document.createElement('script');
    script.async = true;
    script.src = "http://localhost:5000/hash-sdk.js";
    script.onload = () => {
      if (window.BOTSDK) {
        window.BOTSDK.initialize({
          apiKey: "${apiKey}",
          name: "Your Name",
          userId: "your-user-id",
        });
      }
    };
    document.body.appendChild(script);
  }, []);
</script>
      `
    } else {
      return `
import { useEffect } from 'react';

function ChatbotIntegration() {
  useEffect(() => {
    const script = document.createElement('script');
    script.async = true;
    script.src = "http://localhost:5000/hash-sdk.js";
    script.onload = () => {
      if (window.BOTSDK) {
        window.BOTSDK.initialize({
          apiKey: "${apiKey}",
          name: "Your Name",
          userId: "your-user-id",
        });
      }
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  return null;
}

export default ChatbotIntegration;
      `
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateScript())
    SuccessToast("Script copied to clipboard")
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
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={chatbotSettings}>
          <h2 className="text-xl font-semibold mb-6">Chatbot Settings</h2>

          <Form.Item
            label="Greeting Message For Visitors"
            name="greeting"
            rules={[{ required: true, message: "Please enter a greeting message" }]}
          >
            <TextArea rows={4} placeholder="Enter a friendly greeting message" />
          </Form.Item>

          <Form.Item name="logo" label="Upload Chatbot Logo" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload.Dragger
              name="logo"
              fileList={fileList}
              accept=".jpg,.jpeg,.png,.svg"
              beforeUpload={() => false}
              maxCount={1}
              className="bg-white rounded-md"
            >
              <p className="flex justify-center mb-2">
                <FileTextOutlined size={24} className="text-gray-400" />
              </p>
              <p className="text-center mb-1">Drag and drop files here or click to upload <span className="text-brand-primary">Browse Files</span></p>
              <p className="text-center text-xs text-gray-500">JPG, PNG, SVG</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item label="Widget Appearance">
            <Flex>
            <ColorConfigurator fieldName="primary_color" heading="Primary color" description="Main widget color" color={chatbotSettings.primaryColor}/>
            <ColorConfigurator fieldName="font_color" heading="Font color" description="Text color in widget" color={chatbotSettings.primaryColor}/>
            </Flex>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Connect Chatbot</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Your API Key</label>
            <div className="flex">
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="rounded-r-none" />
              <Button
                className="rounded-l-none"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(apiKey)
                  SuccessToast("API key copied to clipboard")
                }}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab("html")}
                className={`flex-1 py-2 px-4 text-center ${
                  activeTab === "html" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                HTML Integration
              </button>
              <button
                onClick={() => setActiveTab("react")}
                className={`flex-1 py-2 px-4 text-center ${
                  activeTab === "react" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                React Integration
              </button>
            </div>
          </div>

          <div className="mb-4">
            <Button type="primary" onClick={copyToClipboard} className="mb-2">
              Generate Script
            </Button>

            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-xs overflow-auto whitespace-pre-wrap">{generateScript()}</pre>
            </div>
          </div>
        </div>
      </div>

      <Flex flex={1} justify="center" className="max-sm:hidden">
        <WidgetPreview primaryColor={chatbotSettings.primaryColor} />
      </Flex>
    </div>
  )
}

export default ChatbotSettings
