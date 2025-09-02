import React from "react";
import {
  CustomCrmModal,
  FacebookLeadFormModal,
  GoHighLevelLeadFormModal,
  GoogleFormModal,
  GoogleLeadFormModal,
  GravityFormModal,
  HubspotModal,
  JotformModal,
  NexHealthLeadFormModal,
  PipedriveModal,
  TypeformModal,
} from "../../../modals/Modals";
import CsvUploadModal  from "@/components/common/CSV/CsvUploadModal";
import { Props } from "@/app/types/types";

const IntegrationsModals: React.FC<Props> = ({
  buttonLoading,
  //hubspotModal
  showHubspotModal,
  hubspotStatus,
  hubspotAccountInfo,
  onHubspotOk,
  onHubspotCancel,
  onHubspotConnect,
  //GoHighLevel
  showGoHighLevelModal,
  goHighLevelStatus,
  onGoHighLevelOk,
  onGoHighLevelCancel,
  onGoHighLevelConnect,
  //PipeDrive
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
        buttonLoading={buttonLoading}
        onOk={onHubspotOk}
        onCancel={onHubspotCancel}
        onConnect={onHubspotConnect}
      />

      {/* Go High Level Modal */}
      <GoHighLevelLeadFormModal
        buttonLoading={buttonLoading}
        open={showGoHighLevelModal}
        status={goHighLevelStatus}
        onOk={onGoHighLevelOk}
        onCancel={onGoHighLevelCancel}
        onConnect={onGoHighLevelConnect}
      />

      {/* Pipedrive Modal */}
      <PipedriveModal
        buttonLoading={buttonLoading}
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
        buttonLoading={buttonLoading}
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
        buttonLoading={buttonLoading}
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
        buttonLoading={buttonLoading}
        open={showFacebookLeadFormModal}
        status={facebookLeadFormStatus}
        accountInfo={facebookLeadFormAccountInfo}
        onOk={onFacebookLeadFormOk}
        onCancel={onFacebookLeadFormCancel}
        onConnect={onFacebookLeadFormConnect}
      />

      {/* Typeform */}
      <TypeformModal
        buttonLoading={buttonLoading}
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

      {/* Jotform  */}
      <JotformModal
        buttonLoading={buttonLoading}
        open={showJotformModal}
        status={jotformStatus}
        treeData={jotformTreeData}
        selectedForms={selectedJotformForms}
        onSelectForms={onSelectJotformForms}
        onOk={onJotformOk}
        onCancel={onJotformCancel}
        onConnect={(token: any) => onJotformConnect(token)}
        onSyncLeads={onJotformSyncLeads}
        onDisconnect={onJotformDisconnect}
      />

      {/* CSV Upload Modal */}
      <CsvUploadModal open={showManualLeadsModal} onOk={leads => onCsvUploadOk(leads)} onCancel={onCsvUploadCancel} />

      {/* Custom CRM Modal */}
      <CustomCrmModal open={showCustomCrmModal} onOk={onCustomCrmOk} onCancel={onCustomCrmCancel} />

      {/* NexHealth Modal */}
      <NexHealthLeadFormModal
        buttonLoading={buttonLoading}
        open={showNexHealthModal}
        status={nextHealthStatus}
        onOk={onNexHealthOk}
        onCancel={onNexHealthCancel}
        onConnect={(token: any) => onNexHealthConnect(token)}
      />

      {/* Gravity Form Modal */}
      <GravityFormModal
        buttonLoading={buttonLoading}
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
