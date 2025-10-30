"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { ErrorToast } from "@/helpers/toast";
import Button from "antd/es/button";
import Select from "antd/es/select";
import { X } from "lucide-react";
import type React from "react";
import type { EditStaffModalProps } from "@/types/staff";

export function EditStaffModal(props: Readonly<EditStaffModalProps>) {
  const { isOpen, isSubmitting, selectedStaff, editStaff, onClose, onSubmit, onInputChange } = props;
  if (!isOpen || !selectedStaff) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await onSubmit(e);
      // Show success toast
      // Close modal on success
      onClose();
    } catch (error) {
      console.error("Error updating staff member:", error);
      ErrorToast("Failed to update staff member. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Staff Member</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {isSubmitting && (
          <div className="mb-4">
            <LoadingSpinner message="Updating staff member..." size="sm" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-staff-name" className="mb-1 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="edit-staff-name"
              type="text"
              required
              value={editStaff.name}
              onChange={e => onInputChange("name", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              placeholder="Enter full name"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="edit-staff-status" className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <Select
              id="edit-staff-status"
              value={editStaff.status}
              onChange={value => onInputChange("status", value)}
              className="w-full"
              size="large"
              style={{
                borderRadius: "8px",
              }}
              disabled={isSubmitting}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
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
              {isSubmitting ? "Updating..." : "Update Staff"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
