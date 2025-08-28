export interface FormData {
  selectedCrm: string;
  adsConnections: string;
  leadCaptureForms: string;
  uploadLeads: string;
}

export interface IntegrationsStepProps {
  // eslint-disable-next-line no-unused-vars
  onNext: (data: any) => void;
  onPrev?: () => void;
  initialData?: Partial<FormData>;
  isSubmitting?: boolean;
}

export interface ModalProps {
  open: boolean;
  status: "disconnected" | "connecting" | "connected";
  accountInfo?: any;
  onOk: () => void;
  onCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onConnect?: (
    // eslint-disable-next-line no-unused-vars
    token?:
      | string
      | {
          form_ids: string[];
          consumerKey: string;
          consumerSecret: string;
          baseURL: string;
        },
  ) => void;
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

export interface PreviousQuestionsProps {
  filteredQuestions: any[];
  currentQuestionIndex: number;
  formData: Record<string, any>;

  hubspotStatus: string;
  hubspotAccountInfo: any;
  pipedriveStatus: string;
  pipedriveAccountInfo: any;
  goHighLevelStatus: string;
  nextHealthStatus: string;
  googleFormStatus: string;
  googleFormAccountInfo: any;
  googleLeadFormStatus: string;
  googleLeadFormAccountInfo: any;
  facebookLeadFormStatus: string;
  facebookLeadFormAccountInfo: any;
  ONBOARDING_LEADS_FILE_NAME: string;
}


export interface CurrentInputProps {
  currentQuestion: any;
  currentValue: any;
  // eslint-disable-next-line no-unused-vars
  handleInputChange: (value: any) => void;
  isSubmitting: boolean;
}


export type ConnectionStatus = "disconnected" | "connecting" | "connected";


export type Props = {
  buttonLoading:boolean;
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