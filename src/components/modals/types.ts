export interface ModalProps {
  open: boolean;
  buttonLoading: boolean;
  status: "disconnected" | "connecting" | "connected" | "needs_customer_id" | "loading_forms" | "selecting_forms" | "selecting_customer";
  accountInfo?: any;
  availableEventTypes?: any[];
  availableLeadForms?: any[];
  connectionId?: string;
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
  onSetCustomerId?: (customerId: string) => void;
  onSaveSelectedForms?: (selectedForms: any[]) => void;
  availableCustomerIds?: string[];
  onSelectCustomerId?: (customerId: string) => void;
  treeData?: any[];
  selectedWorksheets?: any[];

  onSelectWorksheets?: (value: any[]) => void;
  selectedForms?: any[];

  onSelectForms?: (value: any[]) => void;
}

export interface CsvUploadModalProps {
  open: boolean;

  onOk: (leads: any) => void;
  onCancel: () => void;
}

export interface CustomCrmModalProps {
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export interface BookingLinkComponentProps {
  bgColor: string;
  borderColor: string;
  textColor: string;
  hoverBgColor: string;
  buttonBgColor: string;
}
