import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const LeadFormSettingsContent = dynamic(() => import("../SettingsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading form settings..." size="lg" />
    </div>
  ),
});

export default function LeadFormSettingsPage() {
  return <LeadFormSettingsContent />;
}
