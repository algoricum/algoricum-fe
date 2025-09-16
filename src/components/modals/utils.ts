import type React from "react";

export const commonAlertStyles = {
  backgroundColor: "#f9fafb",
  borderColor: "#d1d5db",
  color: "#1f2937",
  "--antd-info-color": "#374151",
  "--antd-info-bg": "#f3f4f6",
  "--antd-info-border": "#d1d5db",
} as React.CSSProperties;

// Removed JSX functions - use inline JSX in components instead

export const getSuccessAlert = (accountName: string) => ({
  message: "Successfully Connected!",
  description: `Connected to ${accountName}. Moving to next step...`,
  type: "success" as const,
  showIcon: true,
  className: "mb-4",
});

export const getSupportButton = (calendlyUrl: string, buttonClass?: string) => ({
  type: "primary" as const,
  size: "small" as const,
  icon: null, // Will be set in component
  onClick: () => window.open(calendlyUrl, "_blank"),
  className: buttonClass || "mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700",
});

// Removed JSX function - use inline JSX in components instead

// Define color mappings for better Tailwind compatibility
export const colorMapForBookingLinkComponent = {
  "green-400": "#4ade80",
  "green-600": "#16a34a",
  "green-700": "#15803d",
  "green-800": "#166534",
  "green-900": "#008A41",
  "orange-400": "#fb923c",
  "orange-600": "#ea580c",
  "orange-700": "#c2410c",
  "orange-800": "#9a3412",
  "orange-900": "#7c2d12",
  "blue-400": "#60a5fa",
  "blue-600": "#2563eb",
  "blue-700": "#1d4ed8",
  "blue-800": "#1e40af",
  "blue-900": "#1e3a8a",
  "custom-blue": "#3D5DCF",
  "navy-400": "#100D4D",
  "gray-400": "#9ca3af",
  "gray-500": "#6b7280",
  "gray-600": "#4b5563",
  "gray-700": "#374151",
  "gray-800": "#1f2937",
  "gray-900": "#111827",
};
