import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const DashboardContent = dynamic(() => import("./DashboardContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading dashboard..." size="lg" />
    </div>
  ),
});

export default function DashboardPage() {
  return <DashboardContent />;
}
