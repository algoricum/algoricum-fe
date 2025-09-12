"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast } from "@/helpers/toast";
import { Button } from "antd";
import { AlertTriangle } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  createdBy: string;
  password: string;
  avatar: string;
  joinedDate: string;
  status?: string;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  selectedStaff: Staff | null;
  onClose: () => void;
  onConfirm: () => Promise<void>; // Changed to async function
}

export function DeleteConfirmModal({ isOpen, isDeleting, selectedStaff, onClose, onConfirm }: DeleteConfirmModalProps) {
  if (!isOpen || !selectedStaff) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();

      onClose();
    } catch (error) {
      console.error("Error deleting staff member:", error);
      ErrorToast("Failed to delete staff member. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center">
          <div className="mr-4 rounded-full bg-red-100 p-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Staff Member</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        {isDeleting && (
          <div className="mb-4">
            <LoadingSpinner message="Deleting staff member..." size="sm" />
          </div>
        )}

        <div className="mb-6">
          <p className="text-gray-700">
            Are you sure you want to delete <span className="font-semibold">{selectedStaff.name}</span>? This will permanently remove their
            access and all associated data.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
            disabled={isDeleting}
          >
            No, Cancel
          </button>
          <Button
            onClick={handleConfirm}
            loading={isDeleting}
            disabled={isDeleting}
            style={{
              backgroundColor: "#dc2626",
              borderColor: "#dc2626",
              borderRadius: 6,
              height: 40,
              fontWeight: 600,
              flex: 1,
            }}
            className="hover:!bg-[#b91c1c] hover:!border-[#b91c1c] transition-all duration-200"
          >
            {isDeleting ? "Deleting..." : "Yes, Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
