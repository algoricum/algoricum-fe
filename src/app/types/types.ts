export interface FormData {
  selectedCrm: string;
  adsConnections: string;
  leadCaptureForms: string;
  uploadLeads: string;
}

export interface IntegrationsStepProps {
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

  onConnect?: (
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

  onSelectWorksheets?: (value: any[]) => void;
  selectedForms?: any[];

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
  handleInputChange: (value: any) => void;
  isSubmitting: boolean;

  // Connection statuses
  hubspotStatus?: ConnectionStatus;
  hubspotAccountInfo?: any;
  pipedriveStatus?: ConnectionStatus;
  pipedriveAccountInfo?: any;
  goHighLevelStatus?: ConnectionStatus;
  nextHealthStatus?: ConnectionStatus;
  googleFormStatus?: ConnectionStatus;
  googleFormAccountInfo?: any;
  googleLeadFormStatus?: ConnectionStatus;
  googleLeadFormAccountInfo?: any;
  facebookLeadFormStatus?: ConnectionStatus;
  facebookLeadFormAccountInfo?: any;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type Props = {
  buttonLoading: boolean;
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
  onFacebookLeadFormDisconnect?: () => void;
  clinicId?: string;
  forceShowFormSelection?: boolean;

  // Typeform
  showTypeformModal: boolean;
  typeformStatus: ConnectionStatus;
  typeformAccountInfo: any;
  typeformTreeData: any[];
  selectedTypeformForms: string[];

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

  onSelectJotformForms: (values: string[]) => void;
  onJotformOk: () => void;
  onJotformCancel: () => void;

  onJotformConnect: (token: any) => void;
  onJotformSyncLeads: () => void;
  onJotformDisconnect: () => void;

  // CSV Upload
  showManualLeadsModal: boolean;

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

  onNexHealthConnect: (token: string) => void;

  // Gravity Form
  showGravityFormModal: boolean;
  gravityFormStatus: ConnectionStatus;
  onGravityFormOk: () => void;
  onGravityFormCancel: () => void;

  onGravityFormConnect: (token: any) => void;
  onGravityFormDisconnect: () => void;
};
