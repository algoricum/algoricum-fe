export interface ModalProps {
  open: boolean;
  buttonLoading: boolean;
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