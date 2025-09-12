"use client";
import { signOut } from "@/utils/supabase/auth-helper";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  IeOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Typography } from "antd";
import { useRouter } from "next/navigation";

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
      <Card className="w-full max-w-5xl shadow-2xl border-0 overflow-hidden" bodyStyle={{ padding: 0 }}>
        <Row className="min-h-[400px]">
          {/* Left Side - Header with purple background */}
          <Col xs={24} md={10} lg={8}>
            <div className="h-full p-8 flex flex-col justify-center text-center text-white" style={{ backgroundColor: "#A268F1" }}>
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white/20 rounded-full">
                  <IeOutlined className="text-4xl" />
                </div>
              </div>
              <Title level={2} className="text-white mb-4">
                Access Restricted
              </Title>
              <Text className="text-purple-100 text-base leading-relaxed">
                Your system access has been temporarily disabled by the clinic administration
              </Text>

              {/* Sign Out Button - moved to left side */}
              <div className="mt-8">
                <Button
                  type="default"
                  icon={<LogoutOutlined />}
                  onClick={handleSignOut}
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 hover:border-white/50"
                  size="large"
                >
                  Sign Out
                </Button>
                <div className="mt-2">
                  <Text className="text-purple-100 text-xs">Try a different account</Text>
                </div>
              </div>
            </div>
          </Col>

          {/* Right Side - Content */}
          <Col xs={24} md={14} lg={16}>
            <div className="h-full p-8 bg-white flex flex-col justify-center">
              {/* Warning Message */}
              <Space align="start" className="mb-8 w-full">
                <ExclamationCircleOutlined className="text-amber-500 text-2xl mt-1" />
                <div className="flex-1">
                  <Title level={3} className="mb-3 text-gray-800">
                    System Access Disabled
                  </Title>
                  <Paragraph className="text-gray-600 mb-0 text-base leading-relaxed">
                    Your access to the {clinicName} system has been disabled. Please contact the administration to understand the reason and
                    request access restoration.
                  </Paragraph>
                </div>
              </Space>

              {/* Contact Information */}
              <div className="mb-6">
                <Title level={4} className="mb-4 text-gray-800">
                  Contact Information:
                </Title>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg h-full">
                      <MailOutlined className="text-gray-500 text-lg" />
                      <div>
                        <Text type="secondary" className="text-xs uppercase tracking-wide block">
                          Email
                        </Text>
                        <Text strong className="text-sm">
                          {contactEmail}
                        </Text>
                      </div>
                    </div>
                  </Col>

                  <Col xs={24} sm={8}>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg h-full">
                      <PhoneOutlined className="text-gray-500 text-lg" />
                      <div>
                        <Text type="secondary" className="text-xs uppercase tracking-wide block">
                          Phone
                        </Text>
                        <Text strong className="text-sm">
                          {contactPhone}
                        </Text>
                      </div>
                    </div>
                  </Col>

                  <Col xs={24} sm={8}>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg h-full">
                      <ClockCircleOutlined className="text-gray-500 text-lg" />
                      <div>
                        <Text type="secondary" className="text-xs uppercase tracking-wide block">
                          Support Hours
                        </Text>
                        <Text strong className="text-sm">
                          {supportHours}
                        </Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Additional Information */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Space align="start" size="small">
                  <InfoCircleOutlined className="text-blue-500 mt-1 text-lg" />
                  <div>
                    <Text strong className="text-blue-800 text-sm block mb-2">
                      Important Note
                    </Text>
                    <Text className="text-blue-700 text-sm leading-relaxed">
                      Access restrictions are typically temporary and can be resolved quickly. Please have your user ID and relevant
                      information ready when contacting support.
                    </Text>
                  </div>
                </Space>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
