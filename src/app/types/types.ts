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