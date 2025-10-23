import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const ChatbotSettingsContent = dynamic(() => import("../SettingsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading chatbot settings..." size="lg" />
    </div>
  ),
});

export default function ChatbotSettingsPage() {
  return <ChatbotSettingsContent />;
}
