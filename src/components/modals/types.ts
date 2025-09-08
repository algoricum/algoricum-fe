export interface ModalProps {
  open: boolean;
  buttonLoading: boolean;
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

export interface CsvUploadModalProps {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
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