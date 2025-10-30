import type React from "react";
import type { StatusStats } from "@/utils/supabase/leads-helper";

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  interest_level: string | null;
  urgency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatConfig {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  getValue: (statusStats: StatusStats[]) => number;
}

export interface StatCardProps {
  readonly icon: React.ReactNode;
  readonly iconBg: string;
  readonly title: string;
  readonly value: number;
}
