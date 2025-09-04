import { Clinic } from "./clinic_model";
import { Section } from "./section_modal";
import { User } from "./user_model";

export interface Article {
  id: string;
  title: string;
  description?: string | null;
  content_body?: string | null; // Updated to snake_case
  is_published: boolean; // Updated to snake_case
  created_at?: string; // Updated to snake_case
  updated_at?: string; // Updated to snake_case
  section_id?: string | null; // Updated to snake_case
  section?: Section;
  created_by?: string; // Updated to snake_case
  creator?: User;
  clinic_id?: string; // Updated to snake_case
  clinic?: Clinic;
}
