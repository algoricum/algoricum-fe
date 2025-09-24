"use client";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { type MeetingSchedule, formatMeetingDate } from "@/utils/appointment-helper";
import { AlertTriangle } from "lucide-react";
import { Modal } from "antd";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
  appointment: MeetingSchedule | null;
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, isSubmitting, appointment }: DeleteConfirmationModalProps) {
  if (!isOpen || !appointment) return null;

  return (
    <Modal
      title={
        <div className="flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={500}
      destroyOnClose
      centered
    >
      <div className="text-center mt-4">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Delete Appointment</h3>
        <p className="mb-4 text-gray-600">Are you sure you want to delete this appointment? This action cannot be undone.</p>
        <div className="rounded-lg bg-gray-50 p-4 text-left mb-6">
          <p className="mb-1 text-sm text-gray-600">Patient</p>
          <p className="mb-2 font-medium text-gray-900">{appointment.username}</p>
          <p className="mb-1 text-sm text-gray-600">Email</p>
          <p className="mb-2 text-gray-900">{appointment.email}</p>
          <p className="mb-1 text-sm text-gray-600">Date & Time</p>
          <p className="mb-2 text-gray-900">{formatMeetingDate(appointment.preferred_meeting_time)}</p>
          <p className="mb-1 text-sm text-gray-600">Meeting Notes</p>
          <p className="text-sm text-gray-900">{appointment.meeting_notes || "No notes"}</p>
        </div>

        {isSubmitting && (
          <div className="mb-4">
            <LoadingSpinner message="Deleting appointment..." size="sm" />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
