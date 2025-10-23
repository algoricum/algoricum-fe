import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const StaffContent = dynamic(() => import("./StaffContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading staff..." size="lg" />
    </div>
  ),
});

export default function StaffPage() {
  return <StaffContent />;
}
