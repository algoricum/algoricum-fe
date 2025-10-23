import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const LeadsContent = dynamic(() => import("./LeadsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading leads..." size="lg" />
    </div>
  ),
});

export default function LeadsPage() {
  return <LeadsContent />;
}
