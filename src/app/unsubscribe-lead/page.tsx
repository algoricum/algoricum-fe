"use client";
import { ArrowLeftOutlined, CheckCircleOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Card, Divider, Space, Typography } from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const { Title, Text, Paragraph } = Typography;

export default function UnsubscribeLeadPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "You have been successfully unsubscribed from our mailing list.";
  const email = searchParams.get("email");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)",
      }}
    >
      <Card
        className="w-full max-w-md shadow-lg"
        style={{
          borderColor: "#c084fc",
          borderRadius: "12px",
        }}
      >
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f3e8ff" }}>
            <CheckCircleOutlined
              style={{
                fontSize: "32px",
                color: "#9333ea",
              }}
            />
          </div>

          <Space direction="vertical" size="small" className="w-full">
            <Title
              level={2}
              style={{
                color: "#581c87",
                marginBottom: 0,
                fontWeight: "bold",
              }}
            >
              Unsubscribed Successfully
            </Title>
            <Text type="secondary" style={{ color: "#7c3aed" }}>
              We&apos;ve processed your unsubscribe request
            </Text>
          </Space>

          <Divider style={{ borderColor: "#c084fc" }} />

          <Card
            size="small"
            style={{
              backgroundColor: "#f3e8ff",
              borderColor: "#c084fc",
              borderRadius: "8px",
            }}
          >
            <Space align="start" className="w-full">
              <MailOutlined
                style={{
                  color: "#9333ea",
                  fontSize: "16px",
                  marginTop: "2px",
                }}
              />
              <div className="flex-1">
                <Paragraph
                  style={{
                    color: "#581c87",
                    marginBottom: email ? "8px" : 0,
                    fontWeight: 500,
                  }}
                >
                  {message}
                </Paragraph>
                {email && (
                  <Text
                    style={{
                      color: "#9333ea",
                      fontSize: "12px",
                    }}
                  >
                    Email: {email}
                  </Text>
                )}
              </div>
            </Space>
          </Card>

          <Space direction="vertical" size="large" className="w-full">
            <Paragraph
              style={{
                color: "#7c3aed",
                marginBottom: 0,
                fontSize: "14px",
              }}
            >
              You will no longer receive emails from us. If you change your mind, you can always subscribe again.
            </Paragraph>

            <Link href="/" className="w-full block">
              <Button
                type="primary"
                size="large"
                icon={<ArrowLeftOutlined />}
                className="w-full"
                style={{
                  backgroundColor: "#9333ea",
                  borderColor: "#9333ea",
                  height: "44px",
                  borderRadius: "8px",
                }}
              >
                Return to Homepage
              </Button>
            </Link>
          </Space>
        </div>
      </Card>
    </div>
  );
}
