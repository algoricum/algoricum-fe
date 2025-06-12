"use client"
import { useState, useEffect, JSX } from "react"
import { Form, Input, Switch, InputNumber, Card, Space, Alert, Modal } from "antd"
import { Button } from "@/components/elements"
import { EyeInvisibleOutlined, EyeTwoTone, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons"
import { SuccessToast, ErrorToast } from "@/helpers/toast"
import { getClinicData } from "@/utils/supabase/clinic-helper"
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  validateEmailSettings,
  getDefaultEmailSettings,
  type EmailSettings,
  type EmailSettingsInput,
  type EmailTestResult
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
  const [testResults, setTestResults] = useState<EmailTestResult | null>(null)
  const [showTestModal, setShowTestModal] = useState<boolean>(false)

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
        // Set form values with all fields (updated for IMAP)
        form.setFieldsValue({
          // SMTP Settings
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port || 465,
          smtp_user: data.smtp_user,
          smtp_password: data.smtp_password,
          smtp_sender_name: data.smtp_sender_name,
          smtp_sender_email: data.smtp_sender_email,
          smtp_use_tls: data.smtp_use_tls !== false, // Default to true

          // IMAP Settings (updated from POP)
          imap_server: data.imap_server,
          imap_port: data.imap_port || 993,
          imap_user: data.imap_user,
          imap_password: data.imap_password,
          imap_use_ssl: data.imap_use_ssl !== false, // Default to true

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
      setTestResults(result)

      // Show user-friendly messages based on test results
      if (result.success) {
        SuccessToast("🎉 Email configuration test successful! Both SMTP and IMAP are working correctly.")
        setShowTestModal(true)
      } else {
        // Show detailed status for partial success or complete failure
        const smtpSuccess = result.details?.smtp?.success === true;
        const imapSuccess = result.details?.imap?.success === true;
        console.log(result,result.details)
        const smtpStatus = smtpSuccess ? "✅ SMTP (Outgoing)" : "❌ SMTP (Outgoing)";
        const imapStatus = imapSuccess ? "✅ IMAP (Incoming)" : "❌ IMAP (Incoming)";

        if (smtpSuccess && !imapSuccess) {
          ErrorToast(`${smtpStatus} working, ${imapStatus} failed. Check IMAP settings and App Password.`);
        } else if (!smtpSuccess && imapSuccess) {
          ErrorToast(`${smtpStatus} failed, ${imapStatus} working. Check SMTP settings.`);
        } else if (!smtpSuccess && !imapSuccess) {
          ErrorToast(`Both ${smtpStatus} and ${imapStatus} failed. Please check all settings.`);
        } else {
          SuccessToast("🎉 Email configuration test successful! Both SMTP and IMAP are working correctly.");
        }

        setShowTestModal(true)
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
              <Input placeholder="smtp.gmail.com" />
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
              <Input placeholder="your-email@gmail.com" />
            </Form.Item>

            <Form.Item
              label="SMTP Password"
              name="smtp_password"
              rules={[{ required: true, message: "Please enter SMTP password" }]}
              help="For Gmail: Use 16-character App Password"
            >
              <Input.Password
                placeholder="xxxx xxxx xxxx xxxx"
                iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item
              label="Sender Name"
              name="smtp_sender_name"
              rules={[{ required: true, message: "Please enter sender name" }]}
            >
              <Input placeholder="Clinic Support" />
            </Form.Item>

            <Form.Item
              label="Sender Email"
              name="smtp_sender_email"
              rules={[
                { required: true, message: "Please enter sender email" },
                { type: "email", message: "Please enter a valid email address" }
              ]}
            >
              <Input placeholder="your-email@gmail.com" />
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
      {/* Help Text - Updated for IMAP */}
      <Alert
        message="Quick Setup Guide"
        description={
          <div>
            <p><strong>🚀 Gmail Quick Setup:</strong></p>
            <ol className="ml-4 list-decimal text-sm">
              <li><strong>Enable 2FA:</strong> myaccount.google.com → Security → 2-Step Verification</li>
              <li><strong>Create App Password:</strong> Security → App passwords → Mail → Generate</li>
              <li><strong>Enable IMAP:</strong> Gmail Settings → Forwarding and POP/IMAP → Enable IMAP</li>
              <li><strong>Use these settings:</strong>
                <ul className="ml-4 list-disc">
                  <li>SMTP: smtp.gmail.com:465 (SSL)</li>
                  <li>IMAP: imap.gmail.com:993 (SSL)</li>
                  <li>Username: your-email@gmail.com</li>
                  <li>Password: App Password (same for both)</li>
                </ul>
              </li>
            </ol>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  )
}

export default EmailConfiguration