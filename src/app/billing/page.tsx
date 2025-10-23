import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const BillingContent = dynamic(() => import("./BillingContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading billing..." size="lg" />
    </div>
  ),
});

export default function BillingPage() {
  return <BillingContent />;
}
