// src/types/supabase-types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user: {
        Row: {
          id: string;
          name: string;
          email: string;
          password: string;
          is_email_verified: boolean | null;
          otp: string | null;
          otp_expires_at: string | null;
          is_super_admin: boolean | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          password: string;
          is_email_verified?: boolean | null;
          otp?: string | null;
          otp_expires_at?: string | null;
          is_super_admin?: boolean | null;
          updated_at: string;
          created_at: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          password?: string;
          is_email_verified?: boolean | null;
          otp?: string | null;
          otp_expires_at?: string | null;
          is_super_admin?: boolean | null;
          updated_at?: string;
          created_at?: string;
        };
      };
      clinic: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          language: string;
          owner_id: string;
          widget_theme: Json | null;
          domain: string | null;
          logo: string | null;
          dashboard_theme: Json | null;
          openai_api_key: string | null;
          clinic_type: string | null;
          assistant_prompt: string | null;
          assistant_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          language: string;
          owner_id: string;
          widget_theme?: Json | null;
          domain?: string | null;
          logo?: string | null;
          clinic_type?: string | null;
          dashboard_theme?: Json | null;
          openai_api_key?: string | null;
          assistant_prompt?: string | null;
          assistant_model?: string | null;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          language?: string;
          owner_id?: string;
          widget_theme?: Json | null;
          domain?: string | null;
          logo?: string | null;
          clinic_type?: string | null;
          dashboard_theme?: Json | null;
          openai_api_key?: string | null;
          assistant_prompt?: string | null;
          assistant_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      api_key: {
        Row: {
          id: string;
          name: string;
          api_key: string;
          key_expires_at: string;
          last_used_at: string | null;
          created_at: string;
          updated_at: string;
          clinic_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          api_key: string;
          key_expires_at: string;
          last_used_at?: string | null;
          created_at: string;
          updated_at: string;
          clinic_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          api_key?: string;
          key_expires_at?: string;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
          clinic_id?: string;
        };
      };
      user_clinic: {
        Row: {
          id: string;
          user_id: string;
          clinic_id: string;
          role: string;
          position: string | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          clinic_id: string;
          role: string;
          position?: string | null;
          is_active?: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          clinic_id?: string;
          role?: string;
          position?: string | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lead_source: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lead: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          status: string;
          source_id: string;
          clinic_id: string;
          assigned_to: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          status: string;
          source_id: string;
          clinic_id: string;
          assigned_to?: string | null;
          notes?: string | null;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: string;
          source_id?: string;
          clinic_id?: string;
          assigned_to?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      threads: {
        Row: {
          id: string;
          user_id: string | null;
          lead_id: string | null;
          clinic_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          lead_id?: string | null;
          clinic_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          lead_id?: string | null;
          clinic_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation: {
        Row: {
          id: string;
          thread_id: string;
          message: string;
          timestamp: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          message: string;
          timestamp: string;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          message?: string;
          timestamp?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
