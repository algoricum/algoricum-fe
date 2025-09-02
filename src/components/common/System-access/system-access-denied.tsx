"use client";
import { Card, Typography, Space, Divider, Button } from "antd";
import {
  ExclamationCircleOutlined,
  PhoneOutlined,
  MailOutlined,
  ClockCircleOutlined,
  IeOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { signOut } from "@/utils/supabase/auth-helper";
const { Title, Text, Paragraph } = Typography;
interface SystemAccessDeniedProps {
  clinicName?: string;
  contactEmail?: string;
  contactPhone?: string;
  supportHours?: string;
}
export default function SystemAccessDenied({
  clinicName = "Your Clinic",
  contactEmail = "admin@clinic.com",
  contactPhone = "+1 (555) 123-4567",
  supportHours = "Monday - Friday, 9:00 AM - 5:00 PM",
}: SystemAccessDeniedProps) {
  const router = useRouter();
  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if sign out fails, redirect to login
      router.push("/login");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F8F9FA" }}>
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden" bodyStyle={{ padding: 0 }}>
        {/* Header with purple background */}
        <div className="p-8 text-center text-white" style={{ backgroundColor: "#A268F1" }}>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/20 rounded-full">
              <IeOutlined className="text-2xl" />
            </div>
          </div>
          <Title level={2} className="text-white mb-2">
            Access Restricted
          </Title>
          <Text className="text-purple-100">Your system access has been temporarily disabled</Text>
        </div>
        <div className="p-8 bg-white">
          {/* Warning Message */}
          <Space align="start" className="mb-6 w-full">
            <ExclamationCircleOutlined className="text-amber-500 text-xl mt-1" />
            <div className="flex-1">
              <Title level={4} className="mb-2">
                System Access Disabled
              </Title>
              <Paragraph className="text-gray-600 mb-0">
                Your access to the {clinicName} system has been disabled by the clinic owner. Please contact the administration to
                understand the reason and request access restoration.
              </Paragraph>
            </div>
          </Space>
          <Divider />
          {/* Contact Information */}
          <div className="mb-6">
            <Title level={5} className="mb-4">
              Contact Information:
            </Title>
            <Space direction="vertical" className="w-full" size="middle">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MailOutlined className="text-gray-500" />
                <div>
                  <Text type="secondary" className="text-xs uppercase tracking-wide block">
                    Email
                  </Text>
                  <Text strong>{contactEmail}</Text>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <PhoneOutlined className="text-gray-500" />
                <div>
                  <Text type="secondary" className="text-xs uppercase tracking-wide block">
                    Phone
                  </Text>
                  <Text strong>{contactPhone}</Text>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <ClockCircleOutlined className="text-gray-500" />
                <div>
                  <Text type="secondary" className="text-xs uppercase tracking-wide block">
                    Support Hours
                  </Text>
                  <Text strong>{supportHours}</Text>
                </div>
              </div>
            </Space>
          </div>
          {/* Additional Information */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
            <Space align="start" size="small">
              <InfoCircleOutlined className="text-blue-500 mt-1" />
              <div>
                <Text strong className="text-blue-800 text-xs block mb-1">
                  Important Note
                </Text>
                <Text className="text-blue-700 text-xs leading-relaxed">
                  Access restrictions are typically temporary and can be resolved quickly. Please have your user ID and relevant information
                  ready when contacting support.
                </Text>
              </div>
            </Space>
          </div>
          <Divider />
          {/* Sign Out Button */}
          <div className="text-center">
            <Button
              type="default"
              icon={<LogoutOutlined />}
              onClick={handleSignOut}
              className="text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400"
              size="middle"
            >
              Sign Out
            </Button>
            <div className="mt-2">
              <Text type="secondary" className="text-xs">
                Sign out and try a different account
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
