import { Modal, Alert, Button, TreeSelect, Typography, Spin, Upload } from "antd";
import { LinkOutlined, CalendarOutlined, UploadOutlined } from "@ant-design/icons";
import React, { useEffect } from "react";

const { Text } = Typography;

interface ModalProps {
  open: boolean;
  status: "disconnected" | "connecting" | "connected";
  accountInfo?: any;
  onOk: () => void;
  onCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onConnect?: (token?: string) => void;
  onSyncLeads?: () => void;
  onDisconnect?: () => void;
  treeData?: any[];
  selectedWorksheets?: any[];
  // eslint-disable-next-line no-unused-vars
  onSelectWorksheets?: (value: any[]) => void;
  selectedForms?: any[];
  // eslint-disable-next-line no-unused-vars
  onSelectForms?: (value: any[]) => void;
}

export const HubspotModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">H</Text>
        </div>
        <span className="text-xl font-semibold">Connect to HubSpot</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your HubSpot account"
            description="We'll automatically sync your contacts and deals. This takes just one click!"
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-orange-500 border-orange-500 hover:bg-orange-600 h-12 px-8 text-lg font-medium"
            >
              Connect to HubSpot
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to HubSpot to sign in
                <br />• Grant permission to access your contacts
                <br />• We&apos;ll automatically sync everything
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to HubSpot...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <Alert
          message="Successfully Connected!"
          description={`Connected to ${accountInfo.accountName}. Moving to next step...`}
          type="success"
          showIcon
          className="mb-4"
        />
      )}
    </div>
  </Modal>
);

export const PipedriveModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
}) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">P</Text>
        </div>
        <span className="text-xl font-semibold">Connect to Pipedrive</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : status === "connecting" ? "Connecting..." : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500", loading: status === "connecting" }}
    width={600}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect Pipedrive for CRM Integration"
            description="Connect your Pipedrive CRM to automatically sync your leads, contacts, and deals with our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-green-600 border-green-600 hover:bg-green-700 h-12 px-8 text-lg font-medium"
            >
              Connect to Pipedrive
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to Pipedrive to sign in
                <br />• Grant permission to access your CRM data
                <br />• We&apos;ll automatically sync your leads and deals
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 mt-6">
            <div className="flex items-start">
              <CalendarOutlined className="text-blue-500 mt-1 mr-3" />
              <div className="flex-1">
                <Text className="text-blue-800 text-sm font-medium block mb-2">Need Help?</Text>
                <Text className="text-blue-700 text-sm mb-3">
                  Our team can help you set up the integration and configure your workflows.
                </Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => window.open("https://calendly.com/your-team/pipedrive-setup", "_blank")}
                  className="bg-purple-600 border-purple-600 hover:bg-purple-700"
                >
                  Book a Support Meeting
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Pipedrive...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your CRM integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <Text strong className="text-green-800">
                  Pipedrive Integration Active
                </Text>
                <br />
                <Text className="text-green-600 text-sm">
                  {accountInfo.contactCount} contacts • {accountInfo.dealCount} deals
                </Text>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onSyncLeads?.()}
                  className="bg-green-600 border-green-600 hover:bg-green-700"
                >
                  Sync Leads
                </Button>
                <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Text className="text-gray-600">⚡ Your CRM integration is ready! Need further help? Book a support meeting.</Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/pipedrive-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);

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
}) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">G</Text>
        </div>
        <span className="text-xl font-semibold">Connect to Google Forms</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
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
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 h-12 px-8 text-lg font-medium"
            >
              Connect to Google Forms
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
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Google Forms...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your form integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="mt-4">
            <Text className="block mb-2">Select worksheets to sync leads from:</Text>
            <TreeSelect
              style={{ width: "100%" }}
              dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
              placeholder="Select worksheets"
              treeData={treeData}
              multiple
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              value={selectedWorksheets}
              onChange={onSelectWorksheets}
            />
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <Text strong className="text-yellow-800">
                  Google Forms Integration Active
                </Text>
                <br />
                <Text className="text-yellow-600 text-sm">{accountInfo.responseCount || 0} responses synced</Text>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onSyncLeads?.()}
                  className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                >
                  Sync Leads
                </Button>
                <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Text className="text-gray-600">⚡ Your Google Forms integration is ready! Need further help? Book a support meeting.</Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/google-form-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);

export const GoogleLeadFormModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
}) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">G</Text>
        </div>
        <span className="text-xl font-semibold">Connect to Google Ads Lead Forms</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your Google Ads Lead Forms"
            description="We can automatically sync leads from your Google Ads Lead Forms to our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 h-12 px-8 text-lg font-medium"
            >
              Connect to Google Ads Lead Forms
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to Google to sign in
                <br />• Grant permission to access your lead form responses
                <br />• We&apos;ll automatically sync your leads
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Google Ads Lead Forms...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your lead form integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <Text strong className="text-yellow-800">
                  Google Ads Lead Forms Integration Active
                </Text>
                <br />
                <Text className="text-yellow-600 text-sm">{accountInfo.responseCount} responses synced</Text>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onSyncLeads}
                  className="bg-yellow-600 border-yellow-600 hover:bg-yellow-700"
                >
                  Sync Leads
                </Button>
                <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Text className="text-gray-600">
              ⚡ Your Google Ads Lead Forms integration is ready! Need further help? Book a support meeting.
            </Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/google-lead-form-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);

export const FacebookLeadFormModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">F</Text>
        </div>
        <span className="text-xl font-semibold">Connect to Facebook Lead Ads</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your Facebook Lead Ads"
            description="We can automatically sync leads from your Facebook Lead Ads to our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-blue-600 border-blue-600 hover:bg-blue-700 h-12 px-8 text-lg font-medium"
            >
              Connect to Facebook Lead Ads
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to Facebook to sign in
                <br />• Grant permission to access your lead form responses
                <br />• We&apos;ll automatically sync your leads
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Facebook Lead Ads...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your lead form integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="mt-4 text-center">
            <Text className="text-gray-600">
              ⚡ Your Facebook Lead Ads integration is ready! Need further help? Book a support meeting.
            </Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/facebook-lead-form-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);

export const TypeformModal: React.FC<ModalProps> = ({
  open,
  status,
  accountInfo,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  treeData,
  selectedForms,
  onSelectForms,
}) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">T</Text>
        </div>
        <span className="text-xl font-semibold">Connect to Typeform</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your Typeform"
            description="We can automatically sync leads from your Typeform forms to our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-black border-black hover:bg-gray-800 h-12 px-8 text-lg font-medium"
            >
              Connect to Typeform
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to Typeform to sign in
                <br />• Grant permission to access your form responses
                <br />• We&apos;ll automatically sync your leads
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to Typeform...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your form integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="mt-4">
            <Text className="block mb-2">Select forms to sync leads from:</Text>
            <TreeSelect
              style={{ width: "100%" }}
              dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
              placeholder="Select forms"
              treeData={treeData}
              multiple
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              value={selectedForms}
              onChange={onSelectForms}
            />
          </div>
          <div className="bg-black rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <Text strong className="text-white">
                  Typeform Integration Active
                </Text>
                <br />
                <Text className="text-gray-300 text-sm">{accountInfo.responseCount || 0} responses synced</Text>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onSyncLeads?.()}
                  className="bg-gray-800 border-gray-800 hover:bg-gray-900"
                >
                  Sync Leads
                </Button>
                <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Text className="text-gray-600">⚡ Your Typeform integration is ready! Need further help? Book a support meeting.</Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/typeform-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);

export const JotformModal: React.FC<ModalProps> = ({
  open,
  status,
  onOk,
  onCancel,
  onConnect,
  onSyncLeads,
  onDisconnect,
  treeData,
  selectedForms,
  onSelectForms,
}) => {
  useEffect(() => {
    if (!window.JF) {
      const script = document.createElement("script");
      script.src = "https://js.jotform.com/JotForm.min.js";
      script.async = true;
      script.onload = () => {
        window.JF.initialize({
          appName: window.location.host || "MyApp",
          accessType: "full", // or "readOnly"
          enableCookieAuth: true,
        });
      };
      document.body.appendChild(script);
    }
  }, []);

  const handleConnect = () => {
    if (!window.JF) return;
    window.JF.login(
      () => {
        const token = window.JF.getAPIKey();
        window.JF.getUser(() => {
          console.log("Jotform auth successful", token);
          onConnect?.(token);
        });
      },
      () => {
        console.error("Jotform auth failed");
      },
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <Text className="text-white font-bold text-sm">J</Text>
          </div>
          <span className="text-xl font-semibold">Connect to Jotform</span>
        </div>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText={status === "connected" ? "Continue" : "Skip for Now"}
      cancelText="Cancel"
      okButtonProps={{ className: "bg-blue-600 border-blue-600" }}
      width={500}
      centered
    >
      <div className="py-6">
        {status === "disconnected" && (
          <>
            <Alert
              message="Connect your Jotform"
              description="We can automatically sync leads from your Jotform forms to our platform."
              type="info"
              showIcon
              className="mb-6"
            />
            <div className="text-center">
              <Button
                type="primary"
                size="large"
                icon={<LinkOutlined />}
                onClick={handleConnect}
                className="bg-blue-600 border-blue-600 hover:bg-blue-700 h-12 px-8 text-lg font-medium"
              >
                Connect to Jotform
              </Button>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Text className="text-sm text-gray-600">
                  <strong>What happens next:</strong>
                  <br />• A Jotform login popup opens
                  <br />• Grant access to your forms
                  <br />• We’ll sync your leads automatically
                  <br />• Takes less than 30 seconds
                </Text>
              </div>
            </div>
          </>
        )}

        {status === "connecting" && (
          <div className="text-center py-8">
            <Spin size="large" />
            <div className="mt-4">
              <Text className="text-lg">Connecting to Jotform...</Text>
              <br />
              <Text className="text-gray-500">Please complete the authorization</Text>
            </div>
          </div>
        )}

        {status === "connected" && (
          <>
            <Alert
              message="Successfully Connected!"
              // description={`Connected to ${accountInfo.accountName}. Your integration is ready!`}
              type="success"
              showIcon
              className="mb-4"
            />
            <div className="mt-4">
              <Text className="block mb-2">Select forms to sync leads from:</Text>
              <TreeSelect
                style={{ width: "100%" }}
                dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
                placeholder="Select forms"
                treeData={treeData}
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                value={selectedForms}
                onChange={onSelectForms}
              />
            </div>
            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong className="text-blue-800">
                    Jotform Integration Active
                  </Text>
                  <br />
                  <Text className="text-blue-600 text-sm">{/* {accountInfo.responseCount || 0} responses synced */}</Text>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onSyncLeads?.()}
                    className="bg-blue-700 border-blue-700 hover:bg-blue-800"
                  >
                    Sync Leads
                  </Button>
                  <Button type="link" danger onClick={onDisconnect} className="text-red-500">
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Text className="text-gray-600">⚡ Your Jotform integration is ready! Need help?</Text>
              <br />
              <Button
                type="primary"
                size="small"
                icon={<CalendarOutlined />}
                onClick={() => window.open("https://calendly.com/your-team/jotform-setup", "_blank")}
                className="mt-2 bg-blue-600 border-blue-600 hover:bg-blue-700"
              >
                Book a Support Meeting
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export const CsvUploadModal: React.FC<{
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOk: (leads: any) => void;
  onCancel: () => void;
}> = ({ open, onOk, onCancel }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">CSV</Text>
        </div>
        <span className="text-xl font-semibold">Upload Leads via CSV</span>
      </div>
    }
    open={open}
    onOk={() => onOk(null)} // Simplified for brevity; actual implementation may need file handling
    onCancel={onCancel}
    okText="Upload"
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      <Alert
        message="Upload your leads"
        description="Upload a CSV file containing your leads to import them into the platform."
        type="info"
        showIcon
        className="mb-6"
      />
      <div className="text-center">
        <Upload
          accept=".csv"
          beforeUpload={file => {
            onOk(file);
            return false;
          }}
          showUploadList={false}
        >
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            className="bg-purple-500 border-purple-500 hover:bg-purple-600 h-12 px-8 text-lg font-medium"
          >
            Select CSV File
          </Button>
        </Upload>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Text className="text-sm text-gray-600">
            <strong>What happens next:</strong>
            <br />• Select a CSV file with your leads
            <br />• We&apos;ll help you map the fields
            <br />• Your leads will be imported into our platform
            <br />• Takes less than a minute!
          </Text>
        </div>
      </div>
    </div>
  </Modal>
);

export const CustomCrmModal: React.FC<{
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
}> = ({ open, onOk, onCancel }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">CRM</Text>
        </div>
        <span className="text-xl font-semibold">Custom CRM Integration</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText="Submit"
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      <Alert
        message="Custom CRM Integration"
        description="Let us know about your CRM, and our team will assist with the integration."
        type="info"
        showIcon
        className="mb-6"
      />
      <div className="text-center">
        <Text className="text-sm text-gray-600">Please contact our support team to set up your custom CRM integration.</Text>
        <br />
        <Button
          type="primary"
          size="large"
          icon={<CalendarOutlined />}
          onClick={() => window.open("https://calendly.com/your-team/custom-crm-setup", "_blank")}
          className="mt-4 bg-purple-600 border-purple-600 hover:bg-purple-700 h-12 px-8 text-lg font-medium"
        >
          Book a Support Meeting
        </Button>
      </div>
    </div>
  </Modal>
);


export const GoHighLevelLeadFormModal: React.FC<ModalProps> = ({ open, status, accountInfo, onOk, onCancel, onConnect }) => (
  <Modal
    title={
      <div className="flex items-center">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">G</Text>
        </div>
        <span className="text-xl font-semibold">Connect to GoHighLevel</span>
      </div>
    }
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText={status === "connected" ? "Continue" : "Skip for Now"}
    cancelText="Cancel"
    okButtonProps={{ className: "bg-purple-500 border-purple-500" }}
    width={500}
    centered
  >
    <div className="py-6">
      {status === "disconnected" && (
        <>
          <Alert
            message="Connect your GoHighLevel Account"
            description="We can automatically sync leads from your GoHighLevel contacts to our platform."
            type="info"
            showIcon
            className="mb-6"
          />
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => onConnect?.()}
              className="bg-green-600 border-green-600 hover:bg-green-700 h-12 px-8 text-lg font-medium"
            >
              Connect to GoHighLevel
            </Button>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                <strong>What happens next:</strong>
                <br />• You&apos;ll be redirected to GoHighLevel to sign in
                <br />• Grant permission to access your contacts
                <br />• We&apos;ll automatically sync your leads
                <br />• Takes less than 30 seconds!
              </Text>
            </div>
          </div>
        </>
      )}
      {status === "connecting" && (
        <div className="text-center py-8">
          <Spin size="large" />
          <div className="mt-4">
            <Text className="text-lg">Connecting to GoHighLevel...</Text>
            <br />
            <Text className="text-gray-500">Please complete the authorization process</Text>
          </div>
        </div>
      )}
      {status === "connected" && accountInfo && (
        <>
          <Alert
            message="Successfully Connected!"
            description={`Connected to ${accountInfo.accountName}. Your GoHighLevel integration is ready!`}
            type="success"
            showIcon
            className="mb-4"
          />
          <div className="mt-4 text-center">
            <Text className="text-gray-600">
              ⚡ Your GoHighLevel integration is ready! Need further help? Book a support meeting.
            </Text>
            <br />
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open("https://calendly.com/your-team/gohighlevel-setup", "_blank")}
              className="mt-2 bg-purple-600 border-purple-600 hover:bg-purple-700"
            >
              Book a Support Meeting
            </Button>
          </div>
        </>
      )}
    </div>
  </Modal>
);
