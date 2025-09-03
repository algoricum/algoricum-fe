"use client";

import type React from "react";
import { X } from "lucide-react";
import { LoadingSpinner } from "@/components/common/Loaders/loading-spinner";
import { type MeetingSchedule, type MeetingStatus, formatMeetingDate } from "@/utils/appointment-helper";

interface EditStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
   
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  appointment: MeetingSchedule | null;
   
  onStatusChange: (status: MeetingStatus) => void;
}

export function EditStatusModal({ isOpen, onClose, onSubmit, isSubmitting, appointment, onStatusChange }: EditStatusModalProps) {
  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Appointment Status</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 p-4">
          <p className="mb-1 text-sm text-gray-600">Patient</p>
          <p className="font-medium text-gray-900">{appointment.username}</p>
          <p className="mt-2 mb-1 text-sm text-gray-600">Email</p>
          <p className="text-gray-900">{appointment.email}</p>
          <p className="mt-2 mb-1 text-sm text-gray-600">Date & Time</p>
          <p className="text-gray-900">{formatMeetingDate(appointment.preferred_meeting_time)}</p>
          <p className="mt-2 mb-1 text-sm text-gray-600">Meeting Notes</p>
          <p className="text-sm text-gray-900">{appointment.meeting_notes || "No notes"}</p>
        </div>

        {isSubmitting && (
          <div className="mb-4">
            <LoadingSpinner message="Updating status..." size="sm" />
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={appointment.status}
              onChange={e => onStatusChange(e.target.value as MeetingStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              disabled={isSubmitting}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-400"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
