import dynamic from "next/dynamic";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";

const WorkspaceSettingsContent = dynamic(() => import("./WorkspaceSettingsContent"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner message="Loading workspace settings..." size="lg" />
    </div>
  ),
});

export default function WorkspaceSettingsPage() {
  return <WorkspaceSettingsContent />;
}
