"use client";
import { useEffect, useState } from "react";
import {
  Card,
  Modal,
  Skeleton,
  Tag,
  Button,
  Alert,
  TreeSelect,
  Typography,
} from "antd";
import { createClient } from "@/utils/supabase/config/client";
import dayjs from "dayjs";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Header } from "@/components/common";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { ErrorToast, SuccessToast } from "@/helpers/toast";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const { Text } = Typography;

export default function IntegrationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [googleFormTreeData, setGoogleFormTreeData] = useState<any[]>([]);

  useEffect(() => {
    const fetchIntegration = async () => {
      setLoading(true);
      try {
        const clinicData = await getClinicData();
        if (!clinicData?.id) {
          setStatus("disconnected");
          setLoading(false);
          return;
        }

        // 1️⃣ Get latest connection
        const { data: connData, error: connError } = await supabase
          .from("google_form_connections")
          .select("*")
          .eq("clinic_id", clinicData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (connError || !connData) {
          setStatus("disconnected");
          setLoading(false);
          return;
        }

        setConnection(connData);
        setStatus("connected");

        // 2️⃣ Fetch saved sheets from DB
        const { data: savedSheets, error: savedError } = await supabase
          .from("google_form_sheets")
          .select("spreadsheet_id, sheet_id")
          .eq("connection_id", connData.id);

        if (savedError) throw savedError;

        const savedSheetKeys = savedSheets.map(
          (s) => `${s.spreadsheet_id}:${s.sheet_id}`
        );

        // 3️⃣ Fetch spreadsheets from Edge Function
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/google-form-integration/list-spreadsheets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              connection_id: connData.id,
              clinic_id: clinicData.id,
            }),
          }
        );

        if (!res.ok) throw new Error(await res.text());

        const { spreadsheets } = await res.json();

        // 4️⃣ Build tree with saved sheets preselected
        const treeData = (spreadsheets || []).map((spreadsheet: any) => ({
          title: spreadsheet.spreadsheet_title,
          value: spreadsheet.spreadsheet_id,
          selectable: false,
          children: (spreadsheet.sheets || []).map((sheet: any) => ({
            title: sheet.sheet_title,
            value: `${spreadsheet.spreadsheet_id}:${sheet.sheet_id}`,
            isLeaf: true,
          })),
        }));
        setGoogleFormTreeData(treeData);

        // 5️⃣ Preselect in state
        setSelectedSheets(savedSheetKeys);
      } catch (error) {
        console.error("Failed to fetch sheets:", error);
        ErrorToast("Failed to fetch Google Sheets");
      } finally {
        setLoading(false);
      }
    };

    fetchIntegration();
  }, []);

  const syncGoogleFormLeads = async () => {
    try {
      // 1️⃣ Get saved sheets from DB
      const { data: savedSheets, error: savedError } = await supabase
        .from("google_form_sheets")
        .select("spreadsheet_id, sheet_id")
        .eq("connection_id", connection?.id);

      if (savedError) throw savedError;

      const savedKeys = savedSheets.map(
        (s) => `${s.spreadsheet_id}:${s.sheet_id}`
      );

      // 2️⃣ Filter only new sheets
      const newSheets = selectedSheets.filter((key) => !savedKeys.includes(key));

      // 3️⃣ Remove deselected sheets directly from DB
      const removedSheets = savedKeys.filter((key) => !selectedSheets.includes(key));
      if (removedSheets.length > 0) {
        await Promise.all(
          removedSheets.map(async (key) => {
            const [spreadsheet_id, sheet_id] = key.split(":");
            await supabase
              .from("google_form_sheets")
              .delete()
              .eq("connection_id", connection?.id)
              .eq("spreadsheet_id", spreadsheet_id)
              .eq("sheet_id", sheet_id);
          })
        );
      }

      // 4️⃣ Skip API if nothing new
      if (newSheets.length === 0) {
        SuccessToast("✅ Sheets are already synced!");
        setShowModal(false);
        return;
      }

      // ✅ FIX: Map strings into objects before sending
      const newSheetsPayload = newSheets.map((key) => {
  const [spreadsheet_id, sheet_id] = key.split(":");

  // Find spreadsheet and sheet titles from tree data
  const spreadsheet = googleFormTreeData.find(s => s.value === spreadsheet_id);
  const sheet = spreadsheet?.children?.find((c:any) => c.value === key);

  return {
    spreadsheet_id,
    spreadsheet_title: spreadsheet?.title || "",
    sheet_id,
    sheet_title: sheet?.title || "",
  };
});


      // 5️⃣ Send to API
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-form-integration/save-selected-sheets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            connection_id: connection?.id,
            selected_sheets: newSheetsPayload, // send objects not strings
          }),
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      SuccessToast(
        `✅ Successfully synced ${result.sync_result.leads_created} leads from Google Lead Form!`
      );
              setShowModal(false);

    } catch (error) {
      console.error("Failed to sync leads:", error);
      ErrorToast("Failed to sync leads");
    }
  };

  // const disconnectGoogleForm = async () => {
  //   if (!connection) return;
  //   await supabase.from("google_form_connections").delete().eq("id", connection.id);
  //   setConnection(null);
  //   setStatus("disconnected");
  // };

  return (
    <DashboardLayout
      header={
        <Header
          title="Dashboard Overview"
          description="Welcome back! Here's what's happening with your clinic today."
          showHamburgerMenu
        />
      }
    >
      <div className="p-6">
        <h1 className="text-white text-2xl font-semibold mb-6">Integrations</h1>

        <div>
          {loading ? (
            <Skeleton active avatar paragraph={{ rows: 2 }} />
          ) : status === "connected" ? (
            <Card
              className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition border border-purple-200 rounded-lg"
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Text className="text-white font-bold text-lg">G</Text>
                </div>
                <div className="flex-1">
                  <h3 className=" text-lg font-medium">Google Forms</h3>
                  <p className="text-gray-400 text-sm">
                    Sync leads from Google Forms automatically
                  </p>
                </div>
                <Tag color={status === "connected" ? "green" : "default"}>
                  {status === "connected" ? "Connected" : "Not Connected"}
                </Tag>
              </div>
            </Card>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center space-y-4 font-semibold text-gray-500 text-xl">
              <h1>No integrations connected</h1>
            </div>
          )}
        </div>

        <Modal
          title={
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
                <Text className="text-white font-bold text-sm">G</Text>
              </div>
              <span className="text-xl font-semibold">Google Forms Integration</span>
            </div>
          }
          open={showModal}
          onCancel={() => setShowModal(false)}
          footer={null}
          width={500}
          centered
        >
          <div className="py-6">
            <Alert
              message="Connected to Google Forms"
              description={`Account: Google Account`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mb-4">
              <Text strong>Last Sync:</Text>{" "}
              {connection?.last_sync_at
                ? dayjs(connection.last_sync_at).format("MMM D, YYYY h:mm A")
                : "Never"}
            </div>

            <div className="mb-4">
              <Text className="block mb-2">
                Select worksheets to sync leads from:
              </Text>
              <TreeSelect
                style={{ width: "100%" }}
                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                placeholder="Select worksheets"
                treeData={googleFormTreeData}
                multiple
                treeCheckable
                value={selectedSheets}
                onChange={setSelectedSheets}
              />
            </div>

            <div className="flex justify-between items-center mt-6">
              <Button
                type="primary"
                onClick={syncGoogleFormLeads}
                className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                disabled={selectedSheets.length === 0}>
                Sync Leads
              </Button>
              {/* <Button danger type="link" onClick={disconnectGoogleForm}>
                Disconnect
              </Button> */}
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
