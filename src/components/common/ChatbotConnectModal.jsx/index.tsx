import React, { FC, useState } from 'react';
import { Modal, Button} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { SuccessToast } from '@/helpers/toast';

type ChatbotConnectModalProps = {
  apiKey: string;
  isOpen: boolean;
  onClose: () => void;
};

const ChatbotConnectModal: FC<ChatbotConnectModalProps> = ({ apiKey, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('html');
  const generateHtmlScript = () => {
    return `<!-- Add these scripts to your HTML <head> section -->
<script src="${process.env.NEXT_PUBLIC_LIVE_CHATBOT_LINK}"></script>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>

<!-- Initialize the chatbot after the page loads -->
<script>
  window.addEventListener("DOMContentLoaded", function () {
    if (window.BOTSDK) {
      window.BOTSDK.initialize({
        apiKey: "${apiKey}"
      });
    } else {
      console.error("BOTSDK is not defined");
    }
  });
</script>`;
  };

  const generateReactScript = () => {
    return `// For Next.js App Router (app/layout.tsx):
import type { Metadata } from "next";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="${process.env.NEXT_PUBLIC_LIVE_CHATBOT_LINK}"></script>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

// Then in your component (e.g., page.tsx):
'use client'
import { useEffect } from "react";

declare global {
  interface Window {
    BOTSDK?: {
      initialize: (options: { apiKey: string }) => void;
    };
  }
}

export default function Home() {
  useEffect(() => {
    if (window.BOTSDK) {
      window.BOTSDK.initialize({
        apiKey: '${apiKey}',
      });
    } else {
      console.error("BOTSDK is not defined");
    }
  }, []);

  return (
    <div>
      {/* Your page content */}
    </div>
  );
}`;
  };

  const copyToClipboard = () => {
    const script = activeTab === 'html' ? generateHtmlScript() : generateReactScript();
    navigator.clipboard.writeText(script);
    SuccessToast("Script copied to clipboard");
  };



  return (
    <Modal
      title="Connect Chatbot"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <div className="mt-4">
        <div className="flex rounded-full overflow-hidden mb-6 bg-gray-100">
          <button
            onClick={() => setActiveTab('html')}
            className={`flex-1 py-2 px-4 text-center rounded-full transition-all ${activeTab === 'html'
              ? 'bg-indigo-600 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-200'
              }`}
          >
            HTML Integration
          </button>
          <button
            onClick={() => setActiveTab('react')}
            className={`flex-1 py-2 px-4 text-center rounded-full transition-all ${activeTab === 'react'
              ? 'bg-indigo-600 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-200'
              }`}
          >
            React Integration
          </button>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Your API Key</label>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={copyToClipboard}
              className="text-indigo-600 hover:text-indigo-800"
            >
              Copy
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-xs overflow-auto whitespace-pre-wrap max-h-64">
              {activeTab === 'html' ? generateHtmlScript() : generateReactScript()}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ChatbotConnectModal;