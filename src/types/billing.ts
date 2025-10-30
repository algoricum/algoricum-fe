export interface Plan {
  id: string;
  name: string;
  price_id: string;
  amount: number;
  currency: string;
  interval: string;
  current_period_end?: string;
}

export interface Invoice {
  id: string;
  status: string;
  currency: string;
  amount_paid: number;
  created: number;
  hosted_invoice_url: string;
  invoice_pdf: string;
}

export interface SubscriptionEvent {
  id: string;
  type: string;
  received_at: string;
  summary: string;
}
