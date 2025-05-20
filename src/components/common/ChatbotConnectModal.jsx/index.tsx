import React, { useState } from 'react';
import { Modal, Tabs, Button, Input } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { SuccessToast } from '@/helpers/toast';

const ChatbotConnectModal = ({ apiKey, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('html');

  const generateHtmlScript = () => {
    return `
// Include the SDK in your site:
<script src="https://localhost:5000/hash-sdk.js"></script>

// Initialize the chatbot after the script loads:
<script>
  window.addEventListener("DOMContentLoaded", function () {
    if (window.BOTSDK) {
      window.BOTSDK.initialize({
        apiKey: "${apiKey}",
        name: "Your User Name", // optional
        userId: "your-user-id", // optional
      });
    } else {
      console.error("Chatbot SDK not found");
    }
  });
</script>`;
  };

  const generateReactScript = () => {
    return `
// No installation needed, just include the script tag inside the <head> of your public/index.html or
// document.tsx.
useEffect(() => {
  const script = document.createElement('script');
  script.async = true;
  script.src = "https://localhost:5000/hash-sdk.js";
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
}, []);`;
  };

  const copyToClipboard = () => {
    const script = activeTab === 'html' ? generateHtmlScript() : generateReactScript();
    navigator.clipboard.writeText(script);
    SuccessToast("Script copied to clipboard");
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    SuccessToast("API key copied to clipboard");
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
            className={`flex-1 py-2 px-4 text-center rounded-full transition-all ${
              activeTab === 'html' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-transparent text-gray-600 hover:bg-gray-200'
            }`}
          >
            HTML Integration
          </button>
          <button
            onClick={() => setActiveTab('react')}
            className={`flex-1 py-2 px-4 text-center rounded-full transition-all ${
              activeTab === 'react' 
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
              onClick={copyApiKey}
              className="text-indigo-600 hover:text-indigo-800"
            >
              Copy
            </Button>
          </div>
          <Input 
            value={apiKey} 
            disabled 
            className="bg-gray-50" 
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium text-gray-700">Script:</div>
            <Button 
              type="primary" 
              onClick={copyToClipboard}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Generate Script
            </Button>
          </div>

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