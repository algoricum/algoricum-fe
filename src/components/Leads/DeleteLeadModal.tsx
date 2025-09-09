"use client";
import { useState } from "react";
import { Modal } from "antd";
import { Trash2, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/config/client";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

interface DeleteLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
   
  onDelete: (leadId: string) => void;
}

export function DeleteLeadModal({ lead, isOpen, onClose, onDelete }: DeleteLeadModalProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleDelete = async () => {
    if (!lead) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("lead").delete().eq("id", lead.id);

      if (error) throw error;

      onDelete(lead.id);
      SuccessToast("Lead deleted successfully");
      onClose();
    } catch (err) {
      console.error("Error deleting lead:", err);
      ErrorToast("Failed to delete lead");
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Lead</h2>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={500}
      destroyOnClose
    >
      <div className="mt-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 mb-1">Are you sure you want to delete this lead?</h3>
              <p className="text-sm text-red-700">This will permanently remove all lead information and cannot be recovered.</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Lead Details:</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium text-gray-900">{lead.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium text-gray-900">{lead.email || "No email"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="font-medium text-gray-900">{lead.phone || "No phone"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-gray-900">{lead.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium text-gray-900">{new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Lead
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
