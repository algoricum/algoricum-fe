"use client";
import React, { useState, useEffect, JSX, useCallback } from "react";
import { Form, Input, Switch, InputNumber, Card, Space, Alert, Modal } from "antd";
import { Button } from "@/components/elements";
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { SuccessToast, ErrorToast } from "@/helpers/toast";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  testSMSConnection,
  validateEmailSettings,
  getDefaultEmailSettings,
  type EmailSettingsInput,
  type EmailTestResult,
  type SMSTestResult,
} from "@/utils/supabase/email-settings-helper";

interface ClinicData {
  id: string;
  name: string;
  [key: string]: any;
}

const CommunicationConfiguration: React.FC = () => {
  const [form] = Form.useForm<EmailSettingsInput>();
  const [loading, setLoading] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testingSMS, setTestingSMS] = useState<boolean>(false);
  const [isEmailConfigured, setIsEmailConfigured] = useState<boolean>(false);
  const [isSMSConfigured, setIsSMSConfigured] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [clinicData, setClinicData] = useState<ClinicData | null>(null);
  const [testResults, setTestResults] = useState<EmailTestResult | null>(null);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);

  const [smsTestResults, setSmsTestResults] = useState<SMSTestResult | null>(null);
  const [showSMSTestModal, setShowSMSTestModal] = useState<boolean>(false);
  
  const fetchCommunicationSettings = useCallback( async (clinicId: string): Promise<void> => {
      try {
        setLoading(true);

        const { data, error } = await getEmailSettings(clinicId);

        if (error) {
          throw error;
        }

        if (data) {
          // Set form values with all fields (email + SMS)
          form.setFieldsValue({
            // SMTP Settings
            smtp_host: data.smtp_host,
            smtp_port: data.smtp_port || 465,
            smtp_user: data.smtp_user,
            smtp_password: data.smtp_password,
            smtp_sender_name: data.smtp_sender_name,
            smtp_sender_email: data.smtp_sender_email,
            smtp_use_tls: data.smtp_use_tls !== false,

            // IMAP Settings
            imap_server: data.imap_server,
            imap_port: data.imap_port || 993,
            imap_user: data.imap_user,
            imap_password: data.imap_password,
            imap_use_ssl: data.imap_use_ssl !== false,

            // Email Processing Settings
            auto_reply_enabled: data.auto_reply_enabled !== false,
            check_frequency_minutes: data.check_frequency_minutes || 5,

            // Twilio SMS Settings
            twilio_account_sid: data.twilio_account_sid,
            twilio_auth_token: data.twilio_auth_token,
            twilio_phone_number: data.twilio_phone_number,
            sms_enabled: data.sms_enabled !== false,
            sms_auto_reply_enabled: data.sms_auto_reply_enabled !== false,
            twilio_webhook_url: data.twilio_webhook_url,
          });

          // Check if email is configured (has required SMTP and IMAP settings)
          setIsEmailConfigured(
            !!data.smtp_host && !!data.smtp_user && !!data.smtp_password && !!data.imap_server && !!data.imap_user && !!data.imap_password,
          );

          // Check if SMS is configured (has required Twilio settings)
          setIsSMSConfigured(!!data.twilio_account_sid && !!data.twilio_auth_token && !!data.twilio_phone_number);

          setLastChecked(data.last_email_check || null);
        } else {
          // Set default values for new configuration
          const defaultSettings = getDefaultEmailSettings();
          form.setFieldsValue(defaultSettings);
          setIsEmailConfigured(false);
          setIsSMSConfigured(false);
        }
      } catch (error: any) {
        console.error("Error fetching communication settings:", error);
        ErrorToast("Failed to load communication settings");
      } finally {
        setLoading(false);
      }
    
    },[form])

   const initializeComponent = useCallback( async (): Promise<void> => {
     try {
       const clinicRes = await getClinicData();
       setClinicData(clinicRes);

       if (clinicRes?.id) {
         await fetchCommunicationSettings(clinicRes.id);
       }
     } catch (error) {
       console.error("Error initializing component:", error);
       ErrorToast("Failed to load clinic data");
     }
   },[fetchCommunicationSettings]);

  useEffect(() => {
    initializeComponent();
  }, [initializeComponent]);

 



  const handleSaveSettings = async (values: EmailSettingsInput): Promise<void> => {
    try {
      setLoading(true);

      if (!clinicData?.id) {
        ErrorToast("Clinic data not available. Please refresh the page.");
        return;
      }

      console.log("Form values being saved:", values); // Debug log

      // Validate all settings together (supports partial configuration)
      const validation = validateEmailSettings(values);
      if (!validation.isValid) {
        ErrorToast(`Validation failed: ${validation.errors.join(", ")}`);
        return;
      }

      // Save communication settings using the updated helper
      const { data, error, isUpdate } = await saveEmailSettings(clinicData.id, values);

      if (error) {
        console.error("Save error:", error); // Debug log
        throw error;
      }

      console.log("Saved data:", data); // Debug log

      // Update configuration status based on saved data
      setIsEmailConfigured(
        !!data?.smtp_host &&
          !!data?.smtp_user &&
          !!data?.smtp_password &&
          !!data?.imap_server &&
          !!data?.imap_user &&
          !!data?.imap_password,
      );
      setIsSMSConfigured(!!data?.twilio_account_sid && !!data?.twilio_auth_token && !!data?.twilio_phone_number);

      SuccessToast(isUpdate ? "Communication settings updated successfully" : "Communication settings created successfully");

      // Refresh the data
      await fetchCommunicationSettings(clinicData.id);
    } catch (error: any) {
      console.error("Error saving communication settings:", error);
      ErrorToast(error.message || "Failed to save communication settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMS = async (): Promise<void> => {
    try {
      setTestingSMS(true);
      const values = form.getFieldsValue();

      if (!clinicData?.id) {
        ErrorToast("Clinic data not available. Please refresh the page.");
        return;
      }

      // Validate SMS settings before testing
      if (!values.sms_enabled) {
        ErrorToast("Please enable SMS first");
        return;
      }

      if (!values.twilio_account_sid || !values.twilio_auth_token || !values.twilio_phone_number) {
        ErrorToast("Please fill in all required Twilio fields before testing");
        return;
      }

      // Validate phone number format
      if (!values.twilio_phone_number.match(/^\+[1-9]\d{1,14}$/)) {
        ErrorToast("Phone number must be in E.164 format (e.g., +1234567890)");
        return;
      }

      console.log("Testing SMS connection with:", {
        account_sid: values.twilio_account_sid,
        phone_number: values.twilio_phone_number,
        clinic_id: clinicData.id,
      });

      const result = await testSMSConnection(values, clinicData.id);
      setSmsTestResults(result);

      if (result.success) {
        SuccessToast(result.message || "🎉 SMS configuration test successful!");
        setShowSMSTestModal(true);
      } else {
        ErrorToast(result.message || "SMS test failed");
        setShowSMSTestModal(true); // Still show modal for troubleshooting
      }
    } catch (error: any) {
      console.error("Test SMS error:", error);
      ErrorToast("Failed to test SMS connection. Please try again.");
    } finally {
      setTestingSMS(false);
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    try {
      setTestingConnection(true);
      const values = form.getFieldsValue();

      if (!clinicData?.id) {
        ErrorToast("Clinic data not available. Please refresh the page.");
        return;
      }

      // Validate required email fields
      if (!values.smtp_host || !values.smtp_user || !values.smtp_password) {
        ErrorToast("Please fill in all required email fields before testing");
        return;
      }

      const result = await testEmailConnection(values, clinicData.id);
      setTestResults(result);

      // Show user-friendly messages based on test results
      if (result.success) {
        SuccessToast("🎉 Email configuration test successful! Both SMTP and IMAP are working correctly.");
        setShowTestModal(true);
      } else {
        // Show detailed status for partial success or complete failure
        const smtpSuccess = result.details?.smtp?.success === true;
        const imapSuccess = result.details?.imap?.success === true;

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

        setShowTestModal(true);
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      ErrorToast("Failed to test email connection. Please try again.");
    } finally {
      setTestingConnection(false);
    }
  };

  const getConnectionStatus = (): JSX.Element => {
    const emailStatus = isEmailConfigured ? "configured" : "not configured";
    const smsStatus = isSMSConfigured ? "configured" : "not configured";

    if (!isEmailConfigured && !isSMSConfigured) {
      return (
        <Alert
          message="Communication not configured"
          description="Configure your email and SMS settings to start receiving and sending messages through your chatbot."
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
        />
      );
    }

    if (isEmailConfigured && isSMSConfigured) {
      return (
        <Alert
          message="Email & SMS configured"
          description={`Both email and SMS are active. ${lastChecked ? `Last checked: ${new Date(lastChecked).toLocaleString()}` : "Never checked"}`}
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
        />
      );
    }

    return (
      <Alert
        message={`Partial configuration: Email ${emailStatus}, SMS ${smsStatus}`}
        description="Configure both email and SMS for complete communication coverage."
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
      />
    );
  };

  // Show loading if clinic data isn't loaded yet
  if (!clinicData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading clinic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status Alert */}
      {getConnectionStatus()}

      <Form form={form} layout="vertical" onFinish={handleSaveSettings} disabled={loading}>
        {/* Email Configuration Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MailOutlined className="text-blue-600 text-xl" />
            <h2 className="text-lg font-semibold text-gray-800">Email Configuration</h2>
          </div>

          {/* SMTP Settings Card */}
          <Card title="SMTP Settings (Outgoing Email)" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="SMTP Host" name="smtp_host">
                <Input placeholder="smtp.gmail.com" />
              </Form.Item>

              <Form.Item label="SMTP Port" name="smtp_port">
                <InputNumber placeholder="465" min={1} max={65535} className="w-full" />
              </Form.Item>

              <Form.Item label="SMTP Username" name="smtp_user" rules={[{ type: "email", message: "Please enter a valid email address" }]}>
                <Input placeholder="your-email@gmail.com" />
              </Form.Item>

              <Form.Item label="SMTP Password" name="smtp_password" help="For Gmail: Use 16-character App Password">
                <Input.Password
                  placeholder="xxxx xxxx xxxx xxxx"
                  iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item label="Sender Name" name="smtp_sender_name">
                <Input placeholder="Clinic Support" />
              </Form.Item>

              <Form.Item
                label="Sender Email"
                name="smtp_sender_email"
                rules={[{ type: "email", message: "Please enter a valid email address" }]}
              >
                <Input placeholder="your-email@gmail.com" />
              </Form.Item>
            </div>

            <Form.Item label="Use TLS/SSL" name="smtp_use_tls" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Card>

          {/* IMAP Settings Card */}
          <Card title="IMAP Settings (Incoming Email)" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="IMAP Server" name="imap_server">
                <Input placeholder="imap.gmail.com" />
              </Form.Item>

              <Form.Item label="IMAP Port" name="imap_port">
                <InputNumber placeholder="993" min={1} max={65535} className="w-full" />
              </Form.Item>

              <Form.Item label="IMAP Username" name="imap_user" rules={[{ type: "email", message: "Please enter a valid email address" }]}>
                <Input placeholder="your-email@gmail.com" />
              </Form.Item>

              <Form.Item label="IMAP Password" name="imap_password" help="Use the SAME App Password as SMTP">
                <Input.Password
                  placeholder="xxxx xxxx xxxx xxxx"
                  iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
            </div>

            <Form.Item label="Use SSL/TLS" name="imap_use_ssl" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Card>

          {/* Email Processing Settings Card */}
          <Card title="Email Processing Settings" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="Enable Auto Reply" name="auto_reply_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item label="Check Frequency (minutes)" name="check_frequency_minutes">
                <InputNumber placeholder="5" min={1} max={60} className="w-full" />
              </Form.Item>
            </div>
          </Card>
        </div>

        {/* SMS Configuration Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MessageOutlined className="text-green-600 text-xl" />
            <h2 className="text-lg font-semibold text-gray-800">SMS Configuration</h2>
          </div>

          {/* Twilio Settings Card */}
          <Card title="Twilio SMS Settings" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="Twilio Account SID" name="twilio_account_sid" help="Found in Twilio Console Dashboard">
                <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              </Form.Item>

              <Form.Item label="Twilio Auth Token" name="twilio_auth_token" help="Found in Twilio Console Dashboard">
                <Input.Password
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  iconRender={(visible: boolean) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item
                label="Twilio Phone Number"
                name="twilio_phone_number"
                rules={[
                  {
                    pattern: /^\+[1-9]\d{1,14}$/,
                    message: "Phone number must be in E.164 format (e.g., +1234567890)",
                  },
                ]}
                help="Your Twilio phone number in E.164 format"
              >
                <Input placeholder="+1234567890" />
              </Form.Item>

              <Form.Item label="Webhook URL" name="twilio_webhook_url" help="URL for incoming SMS webhooks (optional)">
                <Input placeholder="https://yourapp.com/api/sms/webhook" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="Enable SMS" name="sms_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item label="Enable SMS Auto Reply" name="sms_auto_reply_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Space>
            <Button type="default" onClick={handleTestConnection} loading={testingConnection} disabled={loading} icon={<MailOutlined />}>
              Test Email
            </Button>
            <Button type="default" onClick={handleTestSMS} loading={testingSMS} disabled={loading} icon={<PhoneOutlined />}>
              Test SMS
            </Button>
          </Space>

          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {isEmailConfigured || isSMSConfigured ? "Update Settings" : "Save Settings"}
          </Button>
        </div>
      </Form>

      {/* Test Results Modal */}
      <Modal
        title="Connection Test Results"
        open={showTestModal}
        onCancel={() => setShowTestModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowTestModal(false)}>
            Close
          </Button>,
        ]}
      >
        {testResults && (
          <div className="space-y-4">
            <Alert
              message={testResults.success ? "Test Successful" : "Test Failed"}
              description={testResults.message}
              type={testResults.success ? "success" : "error"}
              showIcon
            />

            {testResults.details && (
              <div className="space-y-2">
                <h4 className="font-medium">Email Details:</h4>
                {testResults.details.smtp && (
                  <Alert
                    message={`SMTP: ${testResults.details.smtp.success ? "Success" : "Failed"}`}
                    description={testResults.details.smtp.message || testResults.details.smtp.error}
                    type={testResults.details.smtp.success ? "success" : "error"}
                  />
                )}
                {testResults.details.imap && (
                  <Alert
                    message={`IMAP: ${testResults.details.imap.success ? "Success" : "Failed"}`}
                    description={testResults.details.imap.message || testResults.details.imap.error}
                    type={testResults.details.imap.success ? "success" : "error"}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="SMS Connection Test Results"
        open={showSMSTestModal}
        onCancel={() => setShowSMSTestModal(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setShowSMSTestModal(false)}>
            Close
          </Button>,
        ]}
      >
        {smsTestResults && (
          <div className="space-y-4">
            <Alert
              message={smsTestResults.success ? "SMS Test Successful" : "SMS Test Failed"}
              description={smsTestResults.message}
              type={smsTestResults.success ? "success" : "error"}
              showIcon
            />

            {/* Detailed Results */}
            {smsTestResults.details && (
              <div className="space-y-3">
                <h4 className="font-medium">Connection Details:</h4>

                <div className="grid grid-cols-2 gap-3">
                  <Alert
                    message="Account Status"
                    description={smsTestResults.details.account_status || "Unknown"}
                    type={smsTestResults.details.account_status === "active" ? "success" : "warning"}
                  />

                  <Alert
                    message="Phone Number Status"
                    description={smsTestResults.details.phone_number_status || "Unknown"}
                    type={smsTestResults.details.phone_number_status === "active" ? "success" : "warning"}
                  />
                </div>

                {smsTestResults.details.balance_info && (
                  <Alert
                    message="Account Balance"
                    description={`${smsTestResults.details.balance_info.balance} ${smsTestResults.details.balance_info.currency}`}
                    type="info"
                  />
                )}

                {smsTestResults.details.test_message_sent && (
                  <Alert message="Test Message" description="✅ Test SMS sent successfully!" type="success" />
                )}

                <div className="text-sm text-gray-600">Response time: {smsTestResults.details.response_time}ms</div>
              </div>
            )}

            {/* Troubleshooting Section */}
            {smsTestResults.troubleshooting && smsTestResults.troubleshooting.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Issues Found:</h4>
                {smsTestResults.troubleshooting.issues.map((issue, index) => (
                  <div key={index} className="border border-red-200 rounded p-3">
                    <h5 className="font-medium text-red-800">{issue.issue}</h5>
                    <ul className="mt-2 space-y-1">
                      {issue.solutions.map((solution, sIndex) => (
                        <li key={sIndex} className="text-sm text-red-700">
                          • {solution}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Tips Section */}
            {smsTestResults.troubleshooting && smsTestResults.troubleshooting.tips.length > 0 && (
              <div>
                <h4 className="font-medium text-blue-600">Tips:</h4>
                <ul className="mt-2 space-y-1">
                  {smsTestResults.troubleshooting.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-blue-700">
                      💡 {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Help Text - Updated for both Email and SMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gmail Setup Guide */}
        <Alert
          message="📧 Gmail Quick Setup"
          description={
            <div>
              <ol className="ml-4 list-decimal text-sm">
                <li>
                  <strong>Enable 2FA:</strong> myaccount.google.com → Security → 2-Step Verification
                </li>
                <li>
                  <strong>Create App Password:</strong> Security → App passwords → Mail → Generate
                </li>
                <li>
                  <strong>Enable IMAP:</strong> Gmail Settings → Forwarding and POP/IMAP → Enable IMAP
                </li>
                <li>
                  <strong>Use these settings:</strong>
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

        {/* Twilio Setup Guide */}
        <Alert
          message="📱 Twilio Quick Setup"
          description={
            <div>
              <ol className="ml-4 list-decimal text-sm">
                <li>
                  <strong>Create Account:</strong> Sign up at twilio.com
                </li>
                <li>
                  <strong>Get Phone Number:</strong> Console → Phone Numbers → Buy a number
                </li>
                <li>
                  <strong>Find Credentials:</strong> Console → Dashboard
                  <ul className="ml-4 list-disc">
                    <li>Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</li>
                    <li>Auth Token: Click &quot;View&quot; to reveal</li>
                  </ul>
                </li>
                <li>
                  <strong>Configure Webhooks:</strong> Phone Numbers → Configure → Webhook URL
                </li>
                <li>
                  <strong>Test:</strong> Use the Test SMS button to verify configuration
                </li>
              </ol>
              <p className="mt-2 text-xs text-gray-600">
                💡 <strong>Tip:</strong> Phone numbers must include country code (+1 for US)
              </p>
            </div>
          }
          type="info"
          showIcon
        />
      </div>
    </div>
  );
};

export default CommunicationConfiguration;
