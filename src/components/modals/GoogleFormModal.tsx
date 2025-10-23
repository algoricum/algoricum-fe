"use client";

import { BookingLinkComponent } from "@/components/modals/BookingLinkComponent";
import { getCurrentUserClinic } from "@/utils/supabase/leads-helper";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import TreeSelect from "antd/es/tree-select";
import Typography from "antd/es/typography";
import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { ModalProps } from "./types";
import { commonAlertStyles } from "./utils";

const { Text } = Typography;

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export const GoogleFormModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  treeData,
  selectedWorksheets,
  onSelectWorksheets,
  buttonLoading,
}) => {
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [pickerTreeData, setPickerTreeData] = useState<any[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initializationState, setInitializationState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Master initialization effect
  useEffect(() => {
    if (open && status === "connected") {
      initializeGooglePicker();
    }
  }, [open, status, accountInfo?.connection_id]);

  const initializeGooglePicker = async () => {
    setInitializationState("loading");

    try {
      // Step 1: Load Google API
      await loadGoogleAPI();

      // Step 2: Fetch access token
      await fetchAccessToken();

      setInitializationState("ready");
    } catch {
      setInitializationState("error");
    }
  };

  const loadGoogleAPI = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.picker) {
        setPickerLoaded(true);
        resolve();
        return;
      }

      // Check if script already exists
      let script = document.querySelector('script[src="https://apis.google.com/js/api.js"]') as HTMLScriptElement;

      if (!script) {
        script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        document.head.appendChild(script);
      }

      script.onload = () => {
        window.gapi.load("picker", {
          callback: () => {
            setPickerLoaded(true);
            resolve();
          },
          onerror: () => {
            reject(new Error("Failed to load Google Picker API"));
          },
        });
      };

      script.onerror = () => {
        reject(new Error("Failed to load Google API script"));
      };
    });
  };

  const fetchLatestConnection = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable not set");
    }

    // Get clinic_id from database using authenticated user
    const clinicId = await getCurrentUserClinic();

    if (!clinicId) {
      throw new Error("No clinic_id found for current user");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/google-form-integration/get-latest-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clinic_id: clinicId,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      await response.text();
      throw new Error(`Failed to fetch connection: ${response.status}`);
    }
  };

  const fetchAccessToken = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const performFetch = async () => {
        // If no connection_id, try to fetch the latest connection for this clinic
        let connectionId = accountInfo?.connection_id;

        if (!connectionId) {
          try {
            const latestConnection = await fetchLatestConnection();
            if (latestConnection?.connection_id) {
              connectionId = latestConnection.connection_id;
            } else {
              reject(new Error("No Google Form connections found"));
              return;
            }
          } catch (error) {
            reject(error);
            return;
          }
        }

        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

          if (!supabaseUrl) {
            throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable not set");
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/google-form-integration/get-access-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connection_id: connectionId,
            }),
          });

          if (response.ok) {
            const result = await response.json();

            if (result.access_token) {
              setAccessToken(result.access_token);
              resolve();
            } else {
              throw new Error("No access token in response");
            }
          } else {
            await response.text();
            throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
          }
        } catch (error: any) {
          reject(error);
        } finally {
          // Token loading complete
        }
      };

      performFetch();
    });
  };

  const openPicker = () => {
    // Validate all requirements
    const requirements = [
      { name: "Initialization", check: initializationState === "ready", value: initializationState },
      { name: "Picker Loaded", check: pickerLoaded, value: pickerLoaded },
      { name: "Access Token", check: !!accessToken, value: accessToken ? "present" : "missing" },
      { name: "Google API", check: !!(window.google && window.google.picker), value: !!(window.google && window.google.picker) },
      {
        name: "Developer Key",
        check: !!process.env.NEXT_PUBLIC_GOOGLE_DEVELOPER_KEY,
        value: !!process.env.NEXT_PUBLIC_GOOGLE_DEVELOPER_KEY,
      },
    ];

    const failedRequirements = requirements.filter(req => !req.check);
    if (failedRequirements.length > 0) {
      return;
    }

    try {
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.SPREADSHEETS)
        .addView(window.google.picker.ViewId.FORMS)
        .setOAuthToken(accessToken!)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_DEVELOPER_KEY!)
        .setCallback(handlePickerCallback)
        .setOrigin(window.location.protocol + "//" + window.location.host)
        .build();

      picker.setVisible(true);
    } catch {
      // Handle error silently or show user-friendly message
    }
  };

  const handlePickerCallback = async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const files = data.docs;

      setSelectedFiles(files);

      // Convert selected files to tree data format
      const treeData = files.map((file: any) => ({
        title: file.name,
        value: file.id,
        key: file.id,
        children: [
          {
            title: `📊 ${file.name}`,
            value: `${file.id}_sheet1`,
            key: `${file.id}_sheet1`,
            isLeaf: true,
          },
        ],
      }));

      setPickerTreeData(treeData);

      // Auto-select all the sheet values for better UX
      const autoSelectedValues = treeData.flatMap((file: any) => file.children.map((child: any) => child.value));
      onSelectWorksheets?.(autoSelectedValues);

      // Process files through backend to get detailed sheet info
      if (accountInfo?.connection_id) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/google-form-integration/process-selected-files`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connection_id: accountInfo.connection_id,
              selected_files: files.map((file: any) => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                url: file.url,
              })),
            }),
          });

          if (response.ok) {
            await response.json();
          }
        } catch {
          // Handle error silently
        }
      }
    }
  };
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
            <Image src="/google.svg" alt="Google" width={25} height={25} />
          </div>
          <span className="text-xl font-semibold text-gray-500">Connect to Google Forms</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{ className: "!bg-gray-500 !border-gray-500 hover:!bg-gray-600" }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your Google Forms"
              description="We can automatically sync leads from your Google Forms to our platform."
              type="info"
              className="mb-6 !bg-gray-100 !border-gray-300 !text-gray-800"
              style={commonAlertStyles}
            />
            <div className="text-center">
              <Button
                loading={buttonLoading}
                disabled={buttonLoading}
                type="primary"
                size="large"
                icon={<Image src="/google.svg" alt="Google" width={25} height={25} />}
                onClick={() => onConnect?.()}
                className="!bg-gray-500 !border-gray-500 hover:!bg-gray-600 h-12 px-8 text-lg font-medium"
              >
                Connect to Google
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />• You&apos;ll be redirected to Google to sign in
                  <br />• Grant permission to access your form responses
                  <br />• We&apos;ll automatically sync your leads
                  <br />• Takes less than 30 seconds!
                </Text>
              </div>
            </div>
            <BookingLinkComponent
              bgColor="bg-gray-50"
              borderColor="border-gray-500"
              textColor="gray-700"
              buttonBgColor="gray-500" // Normal button color (matches your Tailwind)
              hoverBgColor="gray-600" // Hover color (matches your Tailwind)
            />
          </>
        )}
        {status === "connected" && accountInfo && (
          <>
            <Alert
              message="Successfully Connected!"
              description={`Connected to ${accountInfo.accountName}. Your form integration is ready!`}
              type="success"
              showIcon
              className="mb-4 !border-gray-300"
            />
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Text className="block">Select worksheets to sync leads from:</Text>
                <Button
                  size="large"
                  onClick={openPicker}
                  disabled={initializationState !== "ready"}
                  loading={initializationState === "loading"}
                  icon={initializationState !== "loading" && <Image src="/drive.png" alt="Google Drive" width={18} height={18} />}
                  className="bg-blue-50 hover:bg-blue-700 text-blue-600 border-blue-300 px-6 py-2 h-10 flex items-center justify-center gap-2"
                >
                  {initializationState === "loading"
                    ? "Initializing..."
                    : initializationState === "ready"
                      ? "Browse Drive"
                      : initializationState === "error"
                        ? "Setup Failed"
                        : "Loading..."}
                </Button>
              </div>

              <TreeSelect
                style={{ width: "100%" }}
                popupMatchSelectWidth={false}
                placeholder={selectedFiles.length > 0 ? "Select from your chosen files" : "Click 'Browse Drive' to select files first"}
                treeData={pickerTreeData.length > 0 ? pickerTreeData : treeData}
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                value={selectedWorksheets}
                onChange={onSelectWorksheets}
                maxTagCount="responsive"
                disabled={pickerTreeData.length === 0}
              />

              {selectedFiles.length > 0 && (
                <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
                  <Text className="text-sm font-medium text-green-800">✅ Selected {selectedFiles.length} file(s) from Google Drive</Text>
                  <div className="mt-1 space-y-1">
                    {selectedFiles.map((file: any) => (
                      <div key={file.id} className="text-xs text-green-700">
                        📊 {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-100 rounded-lg p-4 mt-2 text-center">
              <div className="flex items-center justify-center space-x-4">
                <Text strong className="text-gray-800">
                  Google Forms Integration Active
                </Text>
                <Button
                  size="small"
                  onClick={() => onSyncLeads?.()}
                  className="bg-gray-500 text-white border-gray-600 hover:!bg-gray-700 hover:!text-white"
                >
                  Sync Leads
                </Button>
                <Button type="link" danger onClick={onDisconnect} className="text-red-500 hover:!text-red-600">
                  Disconnect
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Text className="text-gray-600">Your Google Forms integration is ready! Need further help? Book a support meeting.</Text>
              <br />
            </div>
            <BookingLinkComponent
              bgColor="bg-gray-50"
              borderColor="border-gray-500"
              textColor="gray-700"
              buttonBgColor="gray-500" // Normal button color (matches your Tailwind)
              hoverBgColor="gray-600" // Hover color (matches your Tailwind)
            />
          </>
        )}
      </div>
    </Modal>
  );
};
