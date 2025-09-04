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
