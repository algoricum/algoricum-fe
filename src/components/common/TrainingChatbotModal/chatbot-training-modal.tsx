"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { X, Upload, Bot, FileText, DollarSign, Camera, Star } from "lucide-react";
import { getAssistantByClinicId, getClincApiKey, getClinicData } from "@/utils/supabase/clinic-helper";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { getUserData } from "@/utils/supabase/user-helper";
import { getSupabaseSession } from "@/utils/supabase/auth-helper";
import generateClinicInstructions from "@/utils/generateClinicInstructions";

interface ChatbotTrainingModalProps {
  open: boolean;
  onClose: () => void;
}

const ChatbotTrainingModal: React.FC<ChatbotTrainingModalProps> = ({ open, onClose }) => {
  const [, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [clinicData, setClinicData] = useState<any>();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);

    if (files.length > 1) {
      ErrorToast("Please upload only one file at a time.");
      return;
    }

    const file = files[0];
    if (!file) return;

    const validTypes = [".pdf", ".doc", ".docx", ".txt"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidType = validTypes.includes(fileExtension);
    const isValidSize = file.size <= 65 * 1024 * 1024; // 65MB

    if (!isValidType) {
      ErrorToast(`File ${file.name} is not a supported format. Please upload PDF, DOC, DOCX, or TXT files.`);
      return;
    }

    if (!isValidSize) {
      ErrorToast(`File ${file.name} exceeds 65MB size limit.`);
      return;
    }

    setUploadedFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      const validTypes = [".pdf", ".doc", ".docx", ".txt"];
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      const isValidType = validTypes.includes(fileExtension);
      const isValidSize = file.size <= 65 * 1024 * 1024; // 65MB

      if (!isValidType) {
        ErrorToast(`File ${file.name} is not a supported format. Please upload PDF, DOC, DOCX, or TXT files.`);
        return;
      }

      if (!isValidSize) {
        ErrorToast(`File ${file.name} exceeds 65MB size limit.`);
        return;
      }

      setUploadedFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleSubmit = async () => {
    if (!uploadedFile) {
      ErrorToast("Please upload a file to train the chatbot.");
      return;
    }

    try {
      setLoading(true);
      const user = await getUserData();
      if (!user) {
        ErrorToast("User not found. Please logout and log in again.");
        setLoading(false);
        return;
      }

      const assistantData = await getAssistantByClinicId(clinicData.id);
      if (!assistantData) {
        ErrorToast("Assistant not found. Please try again.");
        setLoading(false);
        return;
      }

      const clinicInstructions = generateClinicInstructions({
        name: clinicData.legal_business_name || "",
        address: clinicData.address,
        phone: clinicData.phone,
        email: clinicData.email || user.email,
        business_hours: clinicData.business_hours,
        calendly_link: clinicData.calendly_link,
        tone_selector: clinicData.toneSelector,
        sentence_length: clinicData.sentenceLength,
        formality_level: clinicData.formalityLevel,
        has_uploaded_document: true,
      });

      const formDataToSend = new FormData();
      const session = await getSupabaseSession();
      formDataToSend.append("clinic_id", clinicData.id);
      formDataToSend.append("name", clinicData.legal_business_name || "");
      formDataToSend.append("instructions", clinicInstructions);
      formDataToSend.append("assistant_id", assistantData.id);

      // Add the uploaded file to form data
      formDataToSend.append("clinic_document", uploadedFile);

      try {
        // Call the combined edge function
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formDataToSend,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("Assistant creation error:", result.error);
          ErrorToast(result.error || "Failed to create assistant");
          return;
        }

        SuccessToast("Chatbot assistant file saved successfully");
        onClose(); // Close modal on success
      } catch (assistantError) {
        console.error("Failed to create assistant:", assistantError);
        ErrorToast("Failed to create assistant. Please try again.");
      }
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchChatbotSettings = async () => {
      try {
        setLoading(true);

        const clinic = await getClinicData();
        setClinicData(clinic);

        if (clinic) {
          const clinicApiKey = await getClincApiKey(clinic.id);

          if (clinicApiKey) {
            setApiKey(String(clinicApiKey));
          }
        }
      } catch (error: any) {
        console.error("Error fetching chatbot settings:", error.message);
        ErrorToast("Failed to load chatbot settings");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchChatbotSettings();
    }
  }, [open]); // Changed dependency from [form] to [open]

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md p-2 bg-purple-100">
              <Bot className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Train Your ChatBot Efficiently</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close modal">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Information Box */}
        <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-6">
          <h4 className="mb-4 text-lg font-semibold text-purple-900">How to Train Your ChatBot for Maximum Effectiveness</h4>
          <p className="mb-4 text-sm text-purple-800">
            Upload documents containing the following information to help your ChatBot provide accurate and helpful responses to your
            patients:
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <DollarSign className="mt-1 h-5 w-5 text-purple-600" />
              <div>
                <h5 className="font-medium text-purple-900">Pricing Information</h5>
                <p className="text-sm text-purple-700">Service costs, package deals, payment options, and insurance coverage details.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 text-purple-600" />
              <div>
                <h5 className="font-medium text-purple-900">Services & Procedures</h5>
                <p className="text-sm text-purple-700">Detailed descriptions of treatments, procedures, and services you offer.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Camera className="mt-1 h-5 w-5 text-purple-600" />
              <div>
                <h5 className="font-medium text-purple-900">Before & After Pictures</h5>
                <p className="text-sm text-purple-700">Visual examples of treatment results to showcase your expertise.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Star className="mt-1 h-5 w-5 text-purple-600" />
              <div>
                <h5 className="font-medium text-purple-900">Testimonials</h5>
                <p className="text-sm text-purple-700">Patient reviews and success stories to build trust and credibility.</p>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">Upload Training Documents</label>
          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-400 hover:bg-purple-50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="mb-2 text-lg font-medium text-gray-700">Drop your files here or click to browse</p>
            <p className="text-sm text-gray-500">Upload 1 PDF, DOC, DOCX, or TXT file up to 65MB</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileInput}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
        </div>

        {/* Uploaded File */}
        {uploadedFile && (
          <div className="mb-6">
            <h5 className="mb-3 text-sm font-medium text-gray-700">Uploaded File</h5>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button onClick={removeFile} className="text-gray-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!uploadedFile || loading}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? "Training..." : "Start Training"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotTrainingModal;
