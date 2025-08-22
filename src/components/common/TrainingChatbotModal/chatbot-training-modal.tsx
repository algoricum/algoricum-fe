"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { X, Upload, Bot, FileText, DollarSign, Star } from "lucide-react";
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
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{
    training: File | null;
    pricing: File | null;
    testimonial: File | null;
  }>({
    training: null,
    pricing: null,
    testimonial: null,
  });
  const [clinicData, setClinicData] = useState<any>();

  const handleDrag = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (e: React.DragEvent, type: "training" | "pricing" | "testimonial") => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

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

    setUploadedFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: "training" | "pricing" | "testimonial") => {
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

      setUploadedFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const removeFile = (type: "training" | "pricing" | "testimonial") => {
    setUploadedFiles(prev => ({ ...prev, [type]: null }));
  };

  const handleSubmit = async () => {
    // Check if at least one file is uploaded
    if (!uploadedFiles.training && !uploadedFiles.pricing && !uploadedFiles.testimonial) {
      ErrorToast("Please upload at least one document to train the chatbot.");
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

      // Add files with the correct field names that match your backend
      if (uploadedFiles.training) {
        formDataToSend.append("service_document", uploadedFiles.training);
      }
      if (uploadedFiles.pricing) {
        formDataToSend.append("pricing_document", uploadedFiles.pricing);
      }
      if (uploadedFiles.testimonial) {
        formDataToSend.append("testimonials_document", uploadedFiles.testimonial);
      }

      try {
        // Call the enhanced edge function
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-assistant-with-file`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formDataToSend,
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("Assistant update error:", result.error);
          ErrorToast(result.error || "Failed to update assistant");
          return;
        }

        // Enhanced success message with details
        const uploadedCount = result.filesUploaded || 0;
        const documentTypes = result.updatedDocumentTypes || [];

        let successMessage = `Chatbot updated successfully! `;
        if (uploadedCount > 0) {
          successMessage += `${uploadedCount} document${uploadedCount > 1 ? "s" : ""} uploaded`;
          if (documentTypes.length > 0) {
            successMessage += ` (${documentTypes.join(", ")})`;
          }
        }

        SuccessToast(successMessage);

        // Clear uploaded files after successful submission
        setUploadedFiles({
          training: null,
          pricing: null,
          testimonial: null,
        });

        onClose(); // Close modal on success
      } catch (assistantError) {
        console.error("Failed to update assistant:", assistantError);
        ErrorToast("Failed to update assistant. Please try again.");
      }
    } catch (error: any) {
      ErrorToast(error.message || "Failed to save chatbot settings");
    } finally {
      setLoading(false);
    }
  };

  const FileUploader = ({
    type,
    label,
    icon: Icon,
    description,
  }: {
    type: "training" | "pricing" | "testimonial";
    label: string;
    icon: any;
    description: string;
  }) => (
    <div className="mb-4">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Icon className="h-4 w-4" />
        {label}
      </label>
      <div
        className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragActive === type ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-400 hover:bg-purple-50"
        }`}
        onDragEnter={e => handleDrag(e, type)}
        onDragLeave={e => handleDrag(e, type)}
        onDragOver={e => handleDrag(e, type)}
        onDrop={e => handleDrop(e, type)}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
        <p className="mb-1 text-sm font-medium text-gray-700">Drop files here or click to browse</p>
        <p className="text-xs text-gray-500">{description}</p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={e => handleFileInput(e, type)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      {uploadedFiles[type] && (
        <div className="mt-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs font-medium text-gray-900">{uploadedFiles[type]!.name}</p>
                <p className="text-xs text-gray-500">{(uploadedFiles[type]!.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={() => removeFile(type)} className="text-gray-400 hover:text-red-500">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

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
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
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

        <div className="mb-6 rounded-lg bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-1">
              <Bot className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">Enhance Your Chatbot&apos;s Knowledge</h4>
              <div className="text-xs text-purple-800 space-y-1">
                <p>
                  <strong>Service Documents:</strong> Core knowledge base - FAQs, procedures, and general information about your clinic.
                </p>
                <p>
                  <strong>Pricing Information:</strong> Service costs, insurance details, and payment options to answer billing questions.
                </p>
                <p>
                  <strong>Testimonials:</strong> Patient reviews and success stories to build trust and showcase your expertise.
                </p>
              </div>
              <div className="mt-3 text-xs text-purple-700 bg-purple-100 rounded px-2 py-1">
                💡 <strong>Tip:</strong> Upload at least the service document to get started. You can add pricing and testimonials later to
                make your chatbot more comprehensive.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <FileUploader
            type="training"
            label="Service Documents"
            icon={FileText}
            description="Upload service docs (PDF, DOC, DOCX, TXT up to 65MB)"
          />
          <FileUploader
            type="pricing"
            label="Pricing"
            icon={DollarSign}
            description="Upload pricing information (PDF, DOC, DOCX, TXT up to 65MB)"
          />
          <FileUploader
            type="testimonial"
            label="Testimonial"
            icon={Star}
            description="Upload testimonials (PDF, DOC, DOCX, TXT up to 65MB)"
          />
        </div>

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
            disabled={(!uploadedFiles.training && !uploadedFiles.pricing && !uploadedFiles.testimonial) || loading} // ✅ CORRECT - checks any file
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
