"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
const UnauthorizedPage = () => {
  const router = useRouter();
  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#A200E6" }}>
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 text-sm">You don&apos;t have permission to access this page.</p>
          </div>
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800 text-sm">
                <strong>Unauthorized Access:</strong> This page is restricted based on your user role. Please contact your administrator if
                you believe this is an error.
              </p>
            </div>
          </div>
          <button
            onClick={handleBackToDashboard}
            className="w-full flex items-center justify-center px-4 py-3 rounded-md text-white font-medium transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            style={{
              backgroundColor: "#A200E6",
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">If you need access to this feature, please contact your system administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default UnauthorizedPage;
