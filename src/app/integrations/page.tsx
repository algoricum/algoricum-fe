import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const IntegrationsContent = dynamic(() => import("./IntegrationsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading integrations..." size="lg" />
    </div>
  ),
});

export default function IntegrationsPage() {
  return <IntegrationsContent />;
}
