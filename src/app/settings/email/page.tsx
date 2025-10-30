import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const EmailSettingsContent = dynamic(() => import("../SettingsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading email settings..." size="lg" />
    </div>
  ),
});

export default function EmailSettingsPage() {
  return <EmailSettingsContent />;
}
