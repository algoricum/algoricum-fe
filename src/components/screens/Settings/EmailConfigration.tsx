"use client"
import { useState, useEffect, JSX } from "react"
import { Form, Input, Switch, InputNumber, Card, Space, Alert } from "antd"
import { Button } from "@/components/elements"
import { EyeInvisibleOutlined, EyeTwoTone, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { getClinicData } from "@/utils/supabase/clinic-helper"
import { 
  getEmailSettings, 
  saveEmailSettings, 
  testEmailConnection, 
  validateEmailSettings,
  getDefaultEmailSettings,
  type EmailSettings,
  type EmailSettingsInput
} from "@/utils/supabase/email-settings-helper"

interface ClinicData {
  id: string
  name: string
  [key: string]: any
}

const EmailConfiguration: React.FC = () => {
  const [form] = Form.useForm<EmailSettingsInput>()
  const [loading, setLoading] = useState<boolean>(false)
  const [testingConnection, setTestingConnection] = useState<boolean>(false)
  const [isConfigured, setIsConfigured] = useState<boolean>(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [clinicData, setClinicData] = useState<ClinicData | null>(null)

  useEffect(() => {
    initializeComponent()
  }, [])

  const initializeComponent = async (): Promise<void> => {
    try {
      const clinicRes = await getClinicData()
      setClinicData(clinicRes)
      
      if (clinicRes?.id) {
        await fetchEmailSettings(clinicRes.id)
      }
    } catch (error) {
      console.error("Error initializing component:", error)
      ErrorToast("Failed to load clinic data")
    }
  }

  const fetchEmailSettings = async (clinicId: string): Promise<void> => {
    try {
      setLoading(true)
      
      const { data, error } = await getEmailSettings(clinicId)

      if (error) {
        throw error
      }

      if (data) {
        // Set form values with all fields
        form.setFieldsValue({
          // SMTP Settings
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port || 465,
          smtp_user: data.smtp_user,
          smtp_password: data.smtp_password,
          smtp_sender_name: data.smtp_sender_name,
          smtp_sender_email: data.smtp_sender_email,
          smtp_use_tls: data.smtp_use_tls !== false, // Default to true

          // POP Settings
          pop_server: data.pop_server,
          pop_port: data.pop_port || 995,
          pop_user: data.pop_user,
          pop_password: data.pop_password,
          pop_use_ssl: data.pop_use_ssl !== false, // Default to true

          // Processing Settings
          auto_reply_enabled: data.auto_reply_enabled !== false, // Default to true
          check_frequency_minutes: data.check_frequency_minutes || 5,
        })

        setIsConfigured(true)
        setLastChecked(data.last_email_check || null)
      } else {
        // Set default values for new configuration
        const defaultSettings = getDefaultEmailSettings()
        form.setFieldsValue(defaultSettings)
        setIsConfigured(false)
      }
    } catch (error: any) {
      console.error("Error fetching email settings:", error)
      ErrorToast("Failed to load email settings")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (values: EmailSettingsInput): Promise<void> => {
    try {
      setLoading(true)

      if (!clinicData?.id) {
        ErrorToast("Clinic data not available. Please refresh the page.")
        return
      }

      // Validate settings before saving
      const validation = validateEmailSettings(values)
      if (!validation.isValid) {
        ErrorToast(`Validation failed: ${validation.errors.join(", ")}`)
        return
      }

      const { data, error, isUpdate } = await saveEmailSettings(clinicData.id, values)

      if (error) {
        throw error
      }

      setIsConfigured(true)
      SuccessToast(
        isUpdate 
          ? "Email settings updated successfully" 
          : "Email settings created successfully"
      )

      // Refresh the data
      await fetchEmailSettings(clinicData.id)

    } catch (error: any) {
      console.error("Error saving email settings:", error)
      ErrorToast(error.message || "Failed to save email settings")
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async (): Promise<void> => {
    try {
      setTestingConnection(true)
      const values = form.getFieldsValue()

      if (!clinicData?.id) {
        ErrorToast("Clinic data not available. Please refresh the page.")
        return
      }

      // Validate required fields
      const validation = validateEmailSettings(values)
      if (!validation.isValid) {
        ErrorToast(`Please fix the following issues: ${validation.errors.join(", ")}`)
        return
      }

      const result = await testEmailConnection(values, clinicData.id)

      if (result.success) {
        SuccessToast(result.message || "Email connection test successful!")
      } else {
        ErrorToast(result.message || "Email connection test failed. Please check your settings.")
        
        // Show detailed error information if available
        if (result.details) {
          if (result.details.smtp?.error) {
            console.error('SMTP Error:', result.details.smtp.error)
          }
          if (result.details.pop?.error) {
            console.error('POP3 Error:', result.details.pop.error)
          }
        }
      }

    } catch (error: any) {
      console.error('Test connection error:', error)
      ErrorToast("Failed to test email connection. Please try again.")
    } finally {
      setTestingConnection(false)
    }
  }

  const getConnectionStatus = (): JSX.Element => {
    if (!isConfigured) {
      return (
        <Alert
          message="Email not configured"
          description="Configure your email settings to start receiving and sending emails through your chatbot."
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
        />
      )
    }

    return (
      <Alert
        message="Email configured"
        description={`Email settings are active. ${lastChecked ? `Last checked: ${new Date(lastChecked).toLocaleString()}` : 'Never checked'}`}
        type="success"
        icon={<CheckCircleOutlined />}
        showIcon
      />
    )
  }

  // Show loading if clinic data isn't loaded yet
  if (!clinicData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading clinic data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status Alert */}
      {getConnectionStatus()}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveSettings}
        disabled={loading}
      >
        {/* SMTP Settings Card */}
        <Card title="SMTP Settings (Outgoing Email)" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="SMTP Host"
              name="smtp_host"
              rules={[{ required: true, message: "Please enter SMTP host" }]}
            >
              <Input placeholder="e.g., smtp.gmail.com" />
            </Form.Item>

            <Form.Item
              label="SMTP Port"
              name="smtp_port"
              rules={[{ required: true, message: "Please enter SMTP port" }]}
            >
              <InputNumber
                placeholder="465"
                min={1}
                max={65535}
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              label="SMTP Username"
              name="smtp_user"
              rules={[
                { required: true, message: "Please enter SMTP username" },
                { type: "email", message: "Please enter a valid email address" }
              ]}
            >
              <Input placeholder="e.g., username@gmail.com" />
            </Form.Item>

            <Form.Item
              label="SMTP Password"
              name="smtp_password"
              rules={[{ required: true, message: "Please enter SMTP password" }]}
            >
              <Input.Password
                placeholder="Enter SMTP password or app password"
                iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              label="Sender Name"
              name="smtp_sender_name"
              rules={[{ required: true, message: "Please enter sender name" }]}
            >
              <Input placeholder="e.g., Clinic Support" />
            </Form.Item>

            <Form.Item
              label="Sender Email"
              name="smtp_sender_email"
              rules={[
                { required: true, message: "Please enter sender email" },
                { type: "email", message: "Please enter a valid email address" }
              ]}
            >
              <Input placeholder="e.g., support@yourclinic.com" />
            </Form.Item>
          </div>

          <Form.Item
            label="Use TLS/SSL"
            name="smtp_use_tls"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>

        {/* POP3 Settings Card */}
        <Card title="POP3 Settings (Incoming Email)" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="POP3 Server"
              name="pop_server"
              rules={[{ required: true, message: "Please enter POP server" }]}
            >
              <Input placeholder="e.g., pop.gmail.com" />
            </Form.Item>

            <Form.Item
              label="POP3 Port"
              name="pop_port"
              rules={[{ required: true, message: "Please enter POP port" }]}
            >
              <InputNumber
                placeholder="995"
                min={1}
                max={65535}
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              label="POP3 Username"
              name="pop_user"
              rules={[
                { required: true, message: "Please enter POP username" },
                { type: "email", message: "Please enter a valid email address" }
              ]}
            >
              <Input placeholder="e.g., username@gmail.com" />
            </Form.Item>

            <Form.Item
              label="POP3 Password"
              name="pop_password"
              rules={[{ required: true, message: "Please enter POP password" }]}
            >
              <Input.Password
                placeholder="Enter POP password or app password"
                iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Use SSL"
            name="pop_use_ssl"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>

        {/* Processing Settings Card */}
        <Card title="Email Processing Settings" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="Enable Auto Reply"
              name="auto_reply_enabled"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="Check Frequency (minutes)"
              name="check_frequency_minutes"
              rules={[{ required: true, message: "Please enter check frequency" }]}
            >
              <InputNumber
                placeholder="5"
                min={1}
                max={60}
                className="w-full"
              />
            </Form.Item>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Space>
            <Button
              type="default"
              onClick={handleTestConnection}
              loading={testingConnection}
              disabled={loading}
            >
              Test Connection
            </Button>
          </Space>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            size="large"
          >
            {isConfigured ? 'Update Settings' : 'Save Settings'}
          </Button>
        </div>
      </Form>

      {/* Help Text */}
      <Alert
        message="Email Setup Tips"
        description={
          <div>
            <p><strong>For Gmail:</strong></p>
            <ul className="ml-4 list-disc">
              <li>SMTP: smtp.gmail.com, Port: 465 (SSL) or 587 (TLS)</li>
              <li>POP3: pop.gmail.com, Port: 995</li>
              <li>Use App Password (not your regular password)</li>
              <li>Enable 2-factor authentication first</li>
            </ul>
            <p className="mt-2"><strong>For Outlook:</strong></p>
            <ul className="ml-4 list-disc">
              <li>SMTP: smtp-mail.outlook.com, Port: 587</li>
              <li>POP3: outlook.office365.com, Port: 995</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  )
}

export default EmailConfiguration