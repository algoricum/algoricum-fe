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
