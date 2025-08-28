"use client";

import { X } from "lucide-react";

interface MessageAlertProps {
  message: {
    type: "success" | "error";
    text: string;
  };
  onClose: () => void;
}

export function MessageAlert({ message, onClose }: MessageAlertProps) {
  return (
    <div
      className={`mb-6 rounded-lg p-4 ${
        message.type === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">{message.text}</span>
        <button onClick={onClose} className="text-current opacity-50 hover:opacity-75">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
