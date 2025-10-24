import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading dashboard..." size="lg" />
    </div>
  );
}
