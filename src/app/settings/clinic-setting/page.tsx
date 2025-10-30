import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const ClinicSettingsContent = dynamic(() => import("../SettingsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading clinic settings..." size="lg" />
    </div>
  ),
});

export default function ClinicSettingsPage() {
  return <ClinicSettingsContent />;
}
