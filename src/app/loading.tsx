import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingSpinner message="Loading..." size="lg" />
    </div>
  );
}
