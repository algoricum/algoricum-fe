"use client";

import type React from "react";

import { X } from "lucide-react";
import { Button } from "antd";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast} from "@/helpers/toast";

interface NewStaff {
  email: string;
  name: string;
}

interface AddStaffModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  newStaff: NewStaff;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  // eslint-disable-next-line no-unused-vars
  onInputChange: (field: keyof NewStaff, value: string) => void;
}

export function AddStaffModal({ isOpen, isSubmitting, newStaff, onClose, onSubmit, onInputChange }: AddStaffModalProps) {
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await onSubmit(e);
      onClose();
    } catch (error) {
      // Show error toast
      ErrorToast("Failed to create staff member. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add New Staff Member</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {isSubmitting && (
          <div className="mb-4">
            <LoadingSpinner message="Creating staff member..." size="sm" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              required
              value={newStaff.name}
              onChange={e => onInputChange("name", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              placeholder="Enter full name"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={newStaff.email}
              onChange={e => onInputChange("email", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              placeholder="Enter email address"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">A secure temporary password will be auto-generated and sent to this email.</p>
          </div>

          <div className="flex flex-col gap-3 pt-4 md:flex-row">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={isSubmitting}>
              Cancel
            </button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{
                backgroundColor: "#9564e9",
                borderColor: "#9564e9",
                borderRadius: 6,
                height: 40,
                fontWeight: 600,
                flex: 1,
              }}
              className="hover:!border-[#8554d6] hover:!bg-[#8554d6] transition-all duration-200"
            >
              {isSubmitting ? "Creating..." : "Create Staff"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
