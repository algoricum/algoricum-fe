import React from "react";
import {CsvUploadModal, CustomCrmModal, FacebookLeadFormModal, GoHighLevelLeadFormModal, GoogleFormModal, GoogleLeadFormModal, GravityFormModal, HubspotModal, JotformModal, NexHealthLeadFormModal, PipedriveModal, TypeformModal} from "../../../modals/Modals";
import { ConnectionStatus } from "@/app/types/types";
// import GoHighLevelLeadFormModal from "./GoHighLevelLeadFormModal";
// import PipedriveModal from "./PipedriveModal";
// import GoogleFormModal from "./GoogleFormModal";
// import GoogleLeadFormModal from "./GoogleLeadFormModal";
// import FacebookLeadFormModal from "./FacebookLeadFormModal";
// import TypeformModal from "./TypeformModal";
// import JotformModal from "./JotformModal";
// import CsvUploadModal from "./CsvUploadModal";
// import CustomCrmModal from "./CustomCrmModal";
// import NexHealthLeadFormModal from "./NexHealthLeadFormModal";
// import GravityFormModal from "./GravityFormModal";

type Props = {
  // Hubspot
  showHubspotModal: boolean;
  hubspotStatus: ConnectionStatus;
  hubspotAccountInfo: any;
  onHubspotOk: () => void;
  onHubspotCancel: () => void;
  onHubspotConnect: () => void;

  // GoHighLevel
  showGoHighLevelModal: boolean;
  goHighLevelStatus: ConnectionStatus;
  onGoHighLevelOk: () => void;
  onGoHighLevelCancel: () => void;
  onGoHighLevelConnect: () => void;

  //PipeDrive
  showPipedriveModal: boolean;
  pipedriveStatus: ConnectionStatus;
  pipedriveAccountInfo: any;
  onPipedriveOk: () => void;
  onPipedriveCancel: () => void;
  onPipedriveConnect: () => void;
  onPipedriveSyncLeads: () => void;
  onPipedriveDisconnect: () => void;

  // Google Forms
  showGoogleFormModal: boolean;
  googleFormStatus: ConnectionStatus;
  googleFormAccountInfo: any;
  googleFormTreeData: any[];
  selectedGoogleFormWorksheets: string[];
  // eslint-disable-next-line no-unused-vars
  onSelectGoogleFormWorksheets: (values: string[]) => void;
  onGoogleFormOk: () => void;
  onGoogleFormCancel: () => void;
  onGoogleFormConnect: () => void;
  onGoogleFormSyncLeads: () => void;
  onGoogleFormDisconnect: () => void;

    // Google Lead Form
  showGoogleLeadFormModal: boolean;
  googleLeadFormStatus: ConnectionStatus;
  googleLeadFormAccountInfo: any;
  onGoogleLeadFormOk: () => void;
  onGoogleLeadFormCancel: () => void;
  onGoogleLeadFormConnect: () => void;
  onGoogleLeadFormSyncLeads: () => void;
  onGoogleLeadFormDisconnect: () => void;

   // Facebook Lead Form
  showFacebookLeadFormModal: boolean;
  facebookLeadFormStatus: ConnectionStatus;
  facebookLeadFormAccountInfo: any;
  onFacebookLeadFormOk: () => void;
  onFacebookLeadFormCancel: () => void;
  onFacebookLeadFormConnect: () => void;

  // Typeform
  showTypeformModal: boolean;
  typeformStatus: ConnectionStatus;
  typeformAccountInfo: any;
  typeformTreeData: any[];
  selectedTypeformForms: string[];
  // eslint-disable-next-line no-unused-vars
  onSelectTypeformForms: (values: string[]) => void;
  onTypeformOk: () => void;
  onTypeformCancel: () => void;
  onTypeformConnect: () => void;
  onTypeformSyncLeads: () => void;
  onTypeformDisconnect: () => void;

   // Jotform 
  showJotformModal: boolean;
  jotformStatus: ConnectionStatus;
  jotformTreeData: any[];
  selectedJotformForms: string[];
  // eslint-disable-next-line no-unused-vars
  onSelectJotformForms: (values: string[]) => void;
  onJotformOk: () => void;
  onJotformCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onJotformConnect: (token: any) => void;
  onJotformSyncLeads: () => void;
  onJotformDisconnect: () => void;

    // CSV Upload
  showManualLeadsModal: boolean;
  // eslint-disable-next-line no-unused-vars
  onCsvUploadOk: (leads: any[]) => void;
  onCsvUploadCancel: () => void;

  // Custom CRM
  showCustomCrmModal: boolean;
  onCustomCrmOk: () => void;
  onCustomCrmCancel: () => void;

   // NexHealth
  showNexHealthModal: boolean;
  nextHealthStatus: ConnectionStatus;
  onNexHealthOk: () => void;
  onNexHealthCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onNexHealthConnect: (token:string) => void;

  // Gravity Form
  showGravityFormModal: boolean;
  gravityFormStatus: ConnectionStatus;
  onGravityFormOk: () => void;
  onGravityFormCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onGravityFormConnect: (token:any) => void;
  onGravityFormDisconnect: () => void;
};

const IntegrationsModals: React.FC<Props> = ({
  showHubspotModal,
  hubspotStatus,
  hubspotAccountInfo,
  onHubspotOk,
  onHubspotCancel,
  onHubspotConnect,

  showGoHighLevelModal,
  goHighLevelStatus,
  onGoHighLevelOk,
  onGoHighLevelCancel,
  onGoHighLevelConnect,

  showPipedriveModal,
  pipedriveStatus,
  pipedriveAccountInfo,
  onPipedriveOk,
  onPipedriveCancel,
  onPipedriveConnect,
  onPipedriveSyncLeads,
  onPipedriveDisconnect,

  // Google Forms
  showGoogleFormModal,
  googleFormStatus,
  googleFormAccountInfo,
  googleFormTreeData,
  selectedGoogleFormWorksheets,
  onSelectGoogleFormWorksheets,
  onGoogleFormOk,
  onGoogleFormCancel,
  onGoogleFormConnect,
  onGoogleFormSyncLeads,
  onGoogleFormDisconnect,

  // Google Lead Form
  showGoogleLeadFormModal,
  googleLeadFormStatus,
  googleLeadFormAccountInfo,
  onGoogleLeadFormOk,
  onGoogleLeadFormCancel,
  onGoogleLeadFormConnect,
  onGoogleLeadFormSyncLeads,
  onGoogleLeadFormDisconnect,

  // Facebook Lead Form
  showFacebookLeadFormModal,
  facebookLeadFormStatus,
  facebookLeadFormAccountInfo,
  onFacebookLeadFormOk,
  onFacebookLeadFormCancel,
  onFacebookLeadFormConnect,

  // Typeform
  showTypeformModal,
  typeformStatus,
  typeformAccountInfo,
  typeformTreeData,
  selectedTypeformForms,
  onSelectTypeformForms,
  onTypeformOk,
  onTypeformCancel,
  onTypeformConnect,
  onTypeformSyncLeads,
  onTypeformDisconnect,

  // Jotform
  showJotformModal,
  jotformStatus,
  jotformTreeData,
  selectedJotformForms,
  onSelectJotformForms,
  onJotformOk,
  onJotformCancel,
  onJotformConnect,
  onJotformSyncLeads,
  onJotformDisconnect,

  showManualLeadsModal,
  onCsvUploadOk,
  onCsvUploadCancel,

  // Custom CRM
  showCustomCrmModal,
  onCustomCrmOk,
  onCustomCrmCancel,

  // NexHealth
  showNexHealthModal,
  nextHealthStatus,
  onNexHealthOk,
  onNexHealthCancel,
  onNexHealthConnect,

  // Gravity Form
  showGravityFormModal,
  gravityFormStatus,
  onGravityFormOk,
  onGravityFormCancel,
  onGravityFormConnect,
  onGravityFormDisconnect,

}) => {
  return (
    <>
      {/* Hubspot Modal */}
      <HubspotModal
        open={showHubspotModal}
        status={hubspotStatus}
        accountInfo={hubspotAccountInfo}
        onOk={onHubspotOk}
        onCancel={onHubspotCancel}
        onConnect={onHubspotConnect}
      />

      {/* Go High Level Modal */}
      <GoHighLevelLeadFormModal
        open={showGoHighLevelModal}
        status={goHighLevelStatus}
        onOk={onGoHighLevelOk}
        onCancel={onGoHighLevelCancel}
        onConnect={onGoHighLevelConnect}
      />

      {/* Pipedrive Modal */}
      <PipedriveModal
        open={showPipedriveModal}
        status={pipedriveStatus}
        accountInfo={pipedriveAccountInfo}
        onOk={onPipedriveOk}
        onCancel={onPipedriveCancel}
        onConnect={onPipedriveConnect}
        onSyncLeads={onPipedriveSyncLeads}
        onDisconnect={onPipedriveDisconnect}
      />
      {/* Google Form Modal */}
      <GoogleFormModal
        open={showGoogleFormModal}
        status={googleFormStatus}
        accountInfo={googleFormAccountInfo}
        treeData={googleFormTreeData}
        selectedWorksheets={selectedGoogleFormWorksheets}
        onSelectWorksheets={onSelectGoogleFormWorksheets}
        onOk={onGoogleFormOk}
        onCancel={onGoogleFormCancel}
        onConnect={onGoogleFormConnect}
        onSyncLeads={onGoogleFormSyncLeads}
        onDisconnect={onGoogleFormDisconnect}
      />

      {/* Google Lead Form Modal */}
      <GoogleLeadFormModal
        open={showGoogleLeadFormModal}
        status={googleLeadFormStatus}
        accountInfo={googleLeadFormAccountInfo}
        onOk={onGoogleLeadFormOk}
        onCancel={onGoogleLeadFormCancel}
        onConnect={onGoogleLeadFormConnect}
        onSyncLeads={onGoogleLeadFormSyncLeads}
        onDisconnect={onGoogleLeadFormDisconnect}
      />

      {/* Facebook Lead Form */}
      <FacebookLeadFormModal
        open={showFacebookLeadFormModal}
        status={facebookLeadFormStatus}
        accountInfo={facebookLeadFormAccountInfo}
        onOk={onFacebookLeadFormOk}
        onCancel={onFacebookLeadFormCancel}
        onConnect={onFacebookLeadFormConnect}
      />

      {/* Typeform */}
      <TypeformModal
        open={showTypeformModal}
        status={typeformStatus}
        accountInfo={typeformAccountInfo}
        treeData={typeformTreeData}
        selectedForms={selectedTypeformForms}
        onSelectForms={onSelectTypeformForms}
        onOk={onTypeformOk}
        onCancel={onTypeformCancel}
        onConnect={onTypeformConnect}
        onSyncLeads={onTypeformSyncLeads}
        onDisconnect={onTypeformDisconnect}
      />

      {/* Jotform ✅ */}
      <JotformModal
        open={showJotformModal}
        status={jotformStatus}
        treeData={jotformTreeData}
        selectedForms={selectedJotformForms}
        onSelectForms={onSelectJotformForms}
        onOk={onJotformOk}
        onCancel={onJotformCancel}
        onConnect={(token:any)=>onJotformConnect(token)}
        onSyncLeads={onJotformSyncLeads}
        onDisconnect={onJotformDisconnect}
      />

      {/* CSV Upload Modal */}
      <CsvUploadModal open={showManualLeadsModal} onOk={leads=>onCsvUploadOk(leads)} onCancel={onCsvUploadCancel} />

      {/* Custom CRM Modal */}
      <CustomCrmModal open={showCustomCrmModal} onOk={onCustomCrmOk} onCancel={onCustomCrmCancel} />

      {/* NexHealth Modal */}
      <NexHealthLeadFormModal
        open={showNexHealthModal}
        status={nextHealthStatus}
        onOk={onNexHealthOk}
        onCancel={onNexHealthCancel}
        onConnect={(token: any) => onNexHealthConnect(token)}
      />

      {/* Gravity Form Modal */}
      <GravityFormModal
        open={showGravityFormModal}
        status={gravityFormStatus}
        onOk={onGravityFormOk}
        onCancel={onGravityFormCancel}
        onConnect={(token: any) => onGravityFormConnect(token)}
        onDisconnect={onGravityFormDisconnect}
      />
    </>
  );
};

export default IntegrationsModals;