import { SuccessToast } from "@/helpers/toast";
import { CopyOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { FC } from "react";

type ChatbotConnectModalProps = {
  apiKey: string;
  isOpen: boolean;
  onClose: () => void;
};

const ChatbotConnectModal: FC<ChatbotConnectModalProps> = ({ apiKey, isOpen, onClose }) => {
  const generateHtmlScript = () => {
    return `<!-- Add these scripts to your HTML <head> section -->
      <script async crossOrigin={"anonymous"} src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script async  crossOrigin={"anonymous"} src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script
          async
          src="https://eypitkzntyiyvwrndkgy.supabase.co/storage/v1/object/public/sdk/hash-sdk.js"
          strategy="afterInteractive"
          data-api-key=${apiKey}
          data-element-id="root-bot-container"
        />`;
  };

  const copyToClipboard = () => {
    const script = generateHtmlScript();
    navigator.clipboard.writeText(script);
    SuccessToast("Script copied to clipboard");
  };

  return (
    <Modal title="Connect Chatbot" open={isOpen} onCancel={onClose} footer={null} width={600}>
      <div className="mt-4">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">HTML Integration Script</label>
            <Button size="small" icon={<CopyOutlined />} onClick={copyToClipboard} className="text-indigo-600 hover:text-indigo-800">
              Copy
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-xs overflow-auto whitespace-pre-wrap max-h-64">{generateHtmlScript()}</pre>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ChatbotConnectModal;
