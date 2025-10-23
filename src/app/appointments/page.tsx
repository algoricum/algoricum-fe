import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const AppointmentsContent = dynamic(() => import("./AppointmentsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading appointments..." size="lg" />
    </div>
  ),
});

export default function AppointmentsPage() {
  return <AppointmentsContent />;
}
