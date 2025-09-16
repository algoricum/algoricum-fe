interface WidgetTheme {
  primary_color?: string;
  font_color?: string;
}

interface ClinicTheme {
  primary_color?: string;
}

export interface Clinic {
  id: string;
  name: string;
  language: string;
  updated_at: string;
  widget_theme: WidgetTheme;
  logo: string;
  domain: string;
  dashboard_theme: ClinicTheme;
  owner_id: string;
  openai_api_key_present?: boolean;
}

export interface ClinicState {
  loading: any;
  clinic: Clinic | null;
}
