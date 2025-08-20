

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "cron";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_permission" AS ENUM (
    'clinics.create',
    'clinics.read',
    'clinics.update',
    'clinics.delete',
    'staff.create',
    'staff.read',
    'staff.update',
    'staff.delete',
    'leads.create',
    'leads.read',
    'leads.update',
    'leads.delete',
    'messages.create',
    'messages.read',
    'messages.update',
    'messages.delete',
    'settings.read',
    'settings.update',
    'analytics.read'
);


ALTER TYPE "public"."app_permission" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'clinic_admin',
    'clinic_staff'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."lead_status" AS ENUM (
    'New',
    'Engaged',
    'Booked',
    'Cold',
    'Converted'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE TYPE "public"."role_type" AS ENUM (
    'owner',
    'receptionist'
);


ALTER TYPE "public"."role_type" OWNER TO "postgres";


CREATE TYPE "public"."status_enum" AS ENUM (
    'new',
    'scheduled',
    'completed',
    'inactive',
    'cold'
);


ALTER TYPE "public"."status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_email_settings_with_vault"("p_clinic_id" "uuid", "p_smtp_host" "text" DEFAULT 'smtp.gmail.com'::"text", "p_smtp_port" integer DEFAULT 587, "p_smtp_user" "text" DEFAULT 'abdullah.salman@hashlogics.com'::"text", "p_smtp_sender_name" "text" DEFAULT 'Algoricum'::"text", "p_smtp_sender_email" "text" DEFAULT 'abdullah.salman@hashlogics.com'::"text", "p_smtp_use_tls" boolean DEFAULT true, "p_imap_server" "text" DEFAULT 'imap.gmail.com'::"text", "p_imap_port" integer DEFAULT 993, "p_imap_user" "text" DEFAULT 'abdullah.salman@hashlogics.com'::"text", "p_imap_use_ssl" boolean DEFAULT true, "p_imap_folder" "text" DEFAULT 'INBOX'::"text", "p_check_frequency_minutes" integer DEFAULT 5, "p_sms_auto_reply_enabled" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_smtp_password TEXT;
  v_settings_id UUID;
BEGIN
  -- Get SMTP password from vault
  SELECT decrypted_secret INTO v_smtp_password
  FROM vault.decrypted_secrets 
  WHERE name = 'smtp_password';
  
  -- Check if password was found
  IF v_smtp_password IS NULL THEN
    RAISE EXCEPTION 'SMTP password not found in vault';
  END IF;
  
  -- Insert email settings with vault password
  INSERT INTO public.email_settings (
    clinic_id,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_password,
    smtp_sender_name,
    smtp_sender_email,
    smtp_use_tls,
    imap_server,
    imap_port,
    imap_user,
    imap_password,
    imap_use_ssl,
    imap_folder,
    check_frequency_minutes,
    sms_auto_reply_enabled,
    last_processed_uid,
    created_at,
    updated_at
  ) VALUES (
    p_clinic_id,
    p_smtp_host,
    p_smtp_port,
    p_smtp_user,
    v_smtp_password,
    p_smtp_sender_name,
    p_smtp_sender_email,
    p_smtp_use_tls,
    p_imap_server,
    p_imap_port,
    p_imap_user,
    v_smtp_password, -- Using same password for IMAP
    p_imap_use_ssl,
    p_imap_folder,
    p_check_frequency_minutes,
    p_sms_auto_reply_enabled,
    0, -- last_processed_uid default
    NOW(),
    NOW()
  )
  ON CONFLICT (clinic_id)
  DO UPDATE SET
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_user = EXCLUDED.smtp_user,
    smtp_password = EXCLUDED.smtp_password,
    smtp_sender_name = EXCLUDED.smtp_sender_name,
    smtp_sender_email = EXCLUDED.smtp_sender_email,
    smtp_use_tls = EXCLUDED.smtp_use_tls,
    imap_server = EXCLUDED.imap_server,
    imap_port = EXCLUDED.imap_port,
    imap_user = EXCLUDED.imap_user,
    imap_password = EXCLUDED.imap_password,
    imap_use_ssl = EXCLUDED.imap_use_ssl,
    imap_folder = EXCLUDED.imap_folder,
    check_frequency_minutes = EXCLUDED.check_frequency_minutes,
    sms_auto_reply_enabled = EXCLUDED.sms_auto_reply_enabled,
    updated_at = NOW()
  RETURNING id INTO v_settings_id;
  
  RETURN v_settings_id;
END;
$$;


ALTER FUNCTION "public"."create_email_settings_with_vault"("p_clinic_id" "uuid", "p_smtp_host" "text", "p_smtp_port" integer, "p_smtp_user" "text", "p_smtp_sender_name" "text", "p_smtp_sender_email" "text", "p_smtp_use_tls" boolean, "p_imap_server" "text", "p_imap_port" integer, "p_imap_user" "text", "p_imap_use_ssl" boolean, "p_imap_folder" "text", "p_check_frequency_minutes" integer, "p_sms_auto_reply_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    -- Fetch the user role in the user_roles table
    select role into user_role from public.user_roles where user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    if user_role is not null then
      -- Set the claim
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    else
      claims := jsonb_set(claims, '{user_role}', 'null');
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
  end;
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vault_secret"("secret_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets 
  WHERE name = secret_name;
  
  RETURN secret_value;
END;
$$;


ALTER FUNCTION "public"."get_vault_secret"("secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_lead_converted_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  task_text text;
  exists_task boolean;
begin
  if (new.status = 'Converted' and old.status is distinct from 'Converted') then
    task_text := 'Converted lead: ' || coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '') || ' — Make sure everything is set up';

    select exists (
      select 1 from tasks
      where task = task_text and clinic_id = new.clinic_id and is_automated = true
    ) into exists_task;

    if not exists_task then
      insert into tasks (
        clinic_id,
        task,
        priority,
        time,
        due_at,
        completed,
        is_automated
      ) values (
        new.clinic_id,
        task_text,
        'medium',
        to_char(now(), 'HH24:MI'),
        now(),
        false,
        true
      );
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_lead_converted_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_meeting_scheduled_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$declare
  task_text text;
  exists_task boolean;
begin
  if new.clinic_id is not null and new.preferred_meeting_time is not null then
task_text := 'Meeting booked with ' || coalesce(new.username, '') || ': Review schedule and prep for ' || to_char(new.preferred_meeting_time, 'YYYY-MM-DD')|| ' at ' || to_char(new.preferred_meeting_time, 'HH24:MI');

    select exists (
      select 1 from tasks
      where task = task_text and clinic_id = new.clinic_id and is_automated = true
    ) into exists_task;

    if not exists_task then
      insert into tasks (
        clinic_id,
        task,
        priority,
        time,
        due_at,
        completed,
        is_automated
      ) values (
        new.clinic_id,
        task_text,
        'medium',
        to_char(new.preferred_meeting_time, 'HH24:MI'),
        new.preferred_meeting_time,
        false,
        true
      );
    end if;
  end if;
  return new;
end;$$;


ALTER FUNCTION "public"."handle_meeting_scheduled_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_facebook_lead_form_connections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_facebook_lead_form_connections_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_google_lead_form_connections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_google_lead_form_connections_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_key" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" character varying NOT NULL,
    "api_key" character varying NOT NULL,
    "key_expires_at" timestamp without time zone NOT NULL,
    "last_used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "clinic_id" "uuid" NOT NULL
);


ALTER TABLE "public"."api_key" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assistant_files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "assistant_id" "uuid" NOT NULL,
    "openai_file_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "purpose" "text" DEFAULT 'assistants'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assistant_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assistants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "openai_assistant_id" "text" NOT NULL,
    "assistant_name" "text" NOT NULL,
    "assistant_description" "text",
    "model" "text" DEFAULT 'gpt-4'::"text" NOT NULL,
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assistants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" character varying NOT NULL,
    "address" character varying,
    "phone" character varying,
    "email" character varying,
    "language" character varying,
    "owner_id" "uuid" NOT NULL,
    "widget_theme" "jsonb",
    "domain" character varying,
    "logo" character varying,
    "dashboard_theme" "jsonb",
    "openai_api_key" character varying(255),
    "assistant_prompt" "text",
    "assistant_model" character varying(100),
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "widget_logo" character varying,
    "legal_business_name" character varying,
    "dba_name" character varying,
    "business_hours" "jsonb",
    "calendly_link" character varying,
    "tone_selector" character varying,
    "sentence_length" character varying,
    "formality_level" character varying,
    "chatbot_name" character varying,
    "chatbot_avatar" character varying,
    "clinic_type" "text",
    "uses_hubspot" boolean DEFAULT false,
    "uses_ads" boolean DEFAULT false,
    "has_chatbot" boolean DEFAULT false,
    "other_tools" "text" DEFAULT ''::"text",
    "slug" character varying DEFAULT ''::character varying NOT NULL,
    "stripe_customer_id" "text",
    "use_pipedrive" boolean DEFAULT false NOT NULL,
    "mailgun_domain" character varying,
    "mailgun_email" character varying
);


ALTER TABLE "public"."clinic" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clinic"."clinic_type" IS 'Type of clinic (e.g., Chiropractic, Medical Aesthetics, Dermatology)';



COMMENT ON COLUMN "public"."clinic"."uses_hubspot" IS 'Whether the clinic uses HubSpot as their CRM';



COMMENT ON COLUMN "public"."clinic"."uses_ads" IS 'Whether the clinic uses ads';



COMMENT ON COLUMN "public"."clinic"."has_chatbot" IS 'Whether the clinic already has a chatbot';



COMMENT ON COLUMN "public"."clinic"."other_tools" IS 'Comma-separated list of other CRM or form tools used';



COMMENT ON COLUMN "public"."clinic"."stripe_customer_id" IS 'Customer ID of clinic';



CREATE TABLE IF NOT EXISTS "public"."clinic_lead_form" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "field_id" character varying(255) NOT NULL,
    "field_name" character varying(255) NOT NULL,
    "field_type" character varying(50) NOT NULL,
    "is_required" boolean DEFAULT false,
    "field_options" "text"[],
    "field_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clinic_lead_form_field_type_check" CHECK ((("field_type")::"text" = ANY ((ARRAY['text'::character varying, 'email'::character varying, 'tel'::character varying, 'number'::character varying, 'select'::character varying, 'textarea'::character varying])::"text"[])))
);


ALTER TABLE "public"."clinic_lead_form" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "is_from_user" boolean DEFAULT true,
    "sender_type" character varying DEFAULT 'user'::character varying,
    "email_message_id" character varying
);


ALTER TABLE "public"."conversation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "last_email_check" timestamp with time zone,
    "check_frequency_minutes" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "imap_folder" character varying(100) DEFAULT 'INBOX'::character varying,
    "last_processed_uid" integer DEFAULT 0,
    "sms_auto_reply_enabled" boolean DEFAULT true,
    "smtp_host" "text",
    "smtp_port" integer,
    "smtp_user" "text",
    "smtp_password" "text",
    "smtp_sender_name" "text",
    "smtp_sender_email" "text",
    "smtp_use_tls" boolean,
    "imap_server" "text",
    "imap_port" integer,
    "imap_user" "text",
    "imap_password" "text",
    "imap_use_ssl" boolean
);


ALTER TABLE "public"."email_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."email_settings"."sms_auto_reply_enabled" IS 'Enable/disable automatic SMS replies';



CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "message_id" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "to_email" "text" NOT NULL,
    "to_name" "text",
    "subject" "text",
    "body_text" "text",
    "body_html" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'received'::"text",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "emails_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "emails_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'read'::"text", 'replied'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facebook_lead_form_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "facebook_page_id" character varying NOT NULL,
    "lead_form_id" character varying NOT NULL,
    "page_access_token" "text" NOT NULL,
    "app_id" character varying NOT NULL,
    "app_secret" character varying NOT NULL,
    "webhook_verify_token" character varying,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying DEFAULT 'pending'::character varying NOT NULL,
    "token_expiry" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facebook_lead_form_connections_sync_status_check" CHECK ((("sync_status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::"text"[])))
);


ALTER TABLE "public"."facebook_lead_form_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_form_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "google_form_id" character varying,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_expiry" timestamp without time zone,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying DEFAULT 'pending'::character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" character varying,
    CONSTRAINT "google_form_connections_sync_status_check" CHECK ((("sync_status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::"text"[])))
);


ALTER TABLE "public"."google_form_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_form_sheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "spreadsheet_id" character varying NOT NULL,
    "spreadsheet_title" character varying NOT NULL,
    "sheet_id" character varying NOT NULL,
    "sheet_title" character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_form_sheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_lead_form_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "google_customer_id" character varying NOT NULL,
    "lead_form_id" character varying NOT NULL,
    "campaign_id" character varying,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_expiry" timestamp without time zone,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying DEFAULT 'pending'::character varying NOT NULL,
    "developer_token" character varying,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_lead_form_connections_sync_status_check" CHECK ((("sync_status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::"text"[])))
);


ALTER TABLE "public"."google_lead_form_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hubspot_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp without time zone,
    "account_name" "text",
    "contact_count" integer DEFAULT 0,
    "deal_count" integer DEFAULT 0,
    "hub_id" "text",
    "hub_domain" "text",
    "scope" "text",
    "connection_status" "text" DEFAULT 'disconnected'::"text",
    "last_sync_at" timestamp without time zone,
    "error_message" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "hubspot_connections_connection_status_check" CHECK (("connection_status" = ANY (ARRAY['disconnected'::"text", 'connecting'::"text", 'connected'::"text"])))
);


ALTER TABLE "public"."hubspot_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" character varying,
    "last_name" character varying,
    "email" character varying,
    "phone" character varying,
    "status" "public"."lead_status" DEFAULT 'New'::"public"."lead_status" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "interest_level" character varying(10),
    "urgency" character varying(15),
    "form_data" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "lead_interest_level_check" CHECK ((("interest_level")::"text" = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::"text"[]))),
    CONSTRAINT "lead_urgency_check" CHECK ((("urgency")::"text" = ANY ((ARRAY['asap'::character varying, 'this_month'::character varying, 'curious'::character varying])::"text"[])))
);


ALTER TABLE "public"."lead" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lead"."form_data" IS 'Stores all form field responses as JSON including custom fields';



CREATE TABLE IF NOT EXISTS "public"."lead_source" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_source" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mailgun_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "mailgun_domain" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_email" "text" NOT NULL,
    "auto_reply_enabled" boolean DEFAULT false,
    "auto_reply_message" "text" DEFAULT 'Thank you for contacting us. We will get back to you soon.'::"text",
    "auto_reply_subject" "text" DEFAULT 'Thank you for contacting us'::"text",
    "email_tracking_enabled" boolean DEFAULT true,
    "click_tracking_enabled" boolean DEFAULT true,
    "open_tracking_enabled" boolean DEFAULT true,
    "domain_verified" boolean DEFAULT false,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mailgun_settings_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."mailgun_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" character varying(50) NOT NULL,
    "email" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "preferred_meeting_time" timestamp without time zone,
    "meeting_link" character varying(255),
    "calendly_link" character varying(255),
    "meeting_notes" "text",
    "clinic_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT "meeting_schedule_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['confirmed'::character varying, 'pending'::character varying])::"text"[])))
);


ALTER TABLE "public"."meeting_schedule" OWNER TO "postgres";


COMMENT ON COLUMN "public"."meeting_schedule"."preferred_meeting_time" IS 'Full date and time for the preferred meeting slot';



CREATE TABLE IF NOT EXISTS "public"."pipedrive_integration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "api_domain" character varying(255) NOT NULL,
    "company_id" character varying(100) NOT NULL,
    "user_id" character varying(100) NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pipedrive_integration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "interval" "text" NOT NULL,
    "price_id" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text",
    "trial_days" integer DEFAULT 0,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "description" "text",
    CONSTRAINT "plans_interval_check" CHECK (("interval" = ANY (ARRAY['month'::"text", 'year'::"text"])))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."role_type" NOT NULL,
    "permissions" "jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."role" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" integer NOT NULL,
    "event_id" "text",
    "type" "text",
    "payload" "jsonb",
    "stripe_subscription_id" "text",
    "subscription_id" integer,
    "received_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "summary" "text"
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stripe_events_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."stripe_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stripe_events_id_seq" OWNED BY "public"."stripe_events"."id";



CREATE TABLE IF NOT EXISTS "public"."stripe_subscriptions" (
    "id" integer NOT NULL,
    "clinic_id" "uuid",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "status" "text",
    "current_period_end" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "trial_end" timestamp without time zone,
    "cardholder_name" "text",
    "last4" "text",
    "exp_month" integer,
    "exp_year" integer,
    "brand" "text"
);


ALTER TABLE "public"."stripe_subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stripe_subscriptions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."stripe_subscriptions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stripe_subscriptions_id_seq" OWNED BY "public"."stripe_subscriptions"."id";



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "task" "text" NOT NULL,
    "priority" "text" DEFAULT 'low'::"text" NOT NULL,
    "time" "text" NOT NULL,
    "due_at" timestamp with time zone NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "is_automated" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "clinic_id" "uuid" NOT NULL,
    "status" "public"."status_enum" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "openai_thread_id" "text",
    "channel" character varying DEFAULT 'widget'::character varying,
    "email_subject" character varying,
    "email_from" character varying,
    "email_to" character varying
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."twilio_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "twilio_account_sid" character varying(100),
    "twilio_auth_token" character varying(100),
    "twilio_phone_number" character varying(20),
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."twilio_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" character varying NOT NULL,
    "email" character varying NOT NULL,
    "is_email_verified" boolean DEFAULT false,
    "otp" character varying,
    "otp_expires_at" timestamp without time zone,
    "is_super_admin" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_clinic" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_clinic" OWNER TO "postgres";


ALTER TABLE ONLY "public"."stripe_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stripe_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stripe_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stripe_subscriptions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."api_key"
    ADD CONSTRAINT "api_key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assistant_files"
    ADD CONSTRAINT "assistant_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assistants"
    ADD CONSTRAINT "assistants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_lead_form"
    ADD CONSTRAINT "clinic_lead_form_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic"
    ADD CONSTRAINT "clinic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation"
    ADD CONSTRAINT "conversation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_settings"
    ADD CONSTRAINT "email_settings_clinic_id_key" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."email_settings"
    ADD CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facebook_lead_form_connections"
    ADD CONSTRAINT "facebook_lead_form_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_form_connections"
    ADD CONSTRAINT "google_form_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_form_sheets"
    ADD CONSTRAINT "google_form_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_lead_form_connections"
    ADD CONSTRAINT "google_lead_form_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hubspot_connections"
    ADD CONSTRAINT "hubspot_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead"
    ADD CONSTRAINT "lead_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_source"
    ADD CONSTRAINT "lead_source_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailgun_settings"
    ADD CONSTRAINT "mailgun_settings_clinic_id_key" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."mailgun_settings"
    ADD CONSTRAINT "mailgun_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_schedule"
    ADD CONSTRAINT "meeting_schedule_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."meeting_schedule"
    ADD CONSTRAINT "meeting_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipedrive_integration"
    ADD CONSTRAINT "pipedrive_integration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_price_id_key" UNIQUE ("price_id");



ALTER TABLE ONLY "public"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."twilio_config"
    ADD CONSTRAINT "twilio_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "unique_clinic" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."twilio_config"
    ADD CONSTRAINT "unique_clinic_phone" UNIQUE ("clinic_id", "phone_number");



ALTER TABLE ONLY "public"."pipedrive_integration"
    ADD CONSTRAINT "unique_clinic_pipedrive" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."facebook_lead_form_connections"
    ADD CONSTRAINT "unique_facebook_lead_form_connection" UNIQUE ("clinic_id", "facebook_page_id", "lead_form_id");



ALTER TABLE ONLY "public"."clinic_lead_form"
    ADD CONSTRAINT "unique_field_per_clinic" UNIQUE ("clinic_id", "field_id");



ALTER TABLE ONLY "public"."google_lead_form_connections"
    ADD CONSTRAINT "unique_google_lead_form_connection" UNIQUE ("clinic_id", "google_customer_id", "lead_form_id");



ALTER TABLE ONLY "public"."google_form_sheets"
    ADD CONSTRAINT "unique_spreadsheet_sheet" UNIQUE ("connection_id", "spreadsheet_id", "sheet_id");



ALTER TABLE ONLY "public"."user_clinic"
    ADD CONSTRAINT "unique_user_clinic" UNIQUE ("user_id", "clinic_id");



ALTER TABLE ONLY "public"."user_clinic"
    ADD CONSTRAINT "user_clinic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_assistant_files_assistant_id" ON "public"."assistant_files" USING "btree" ("assistant_id");



CREATE INDEX "idx_assistants_clinic_id" ON "public"."assistants" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinic_lead_form_clinic_id" ON "public"."clinic_lead_form" USING "btree" ("clinic_id");



CREATE INDEX "idx_clinic_lead_form_field_id" ON "public"."clinic_lead_form" USING "btree" ("field_id");



CREATE INDEX "idx_clinic_lead_form_order" ON "public"."clinic_lead_form" USING "btree" ("clinic_id", "field_order");



CREATE INDEX "idx_facebook_lead_form_connections_clinic_id" ON "public"."facebook_lead_form_connections" USING "btree" ("clinic_id");



CREATE INDEX "idx_facebook_lead_form_connections_last_sync_at" ON "public"."facebook_lead_form_connections" USING "btree" ("last_sync_at");



CREATE INDEX "idx_facebook_lead_form_connections_page_id" ON "public"."facebook_lead_form_connections" USING "btree" ("facebook_page_id");



CREATE INDEX "idx_facebook_lead_form_connections_sync_status" ON "public"."facebook_lead_form_connections" USING "btree" ("sync_status");



CREATE INDEX "idx_google_form_connections_clinic_id" ON "public"."google_form_connections" USING "btree" ("clinic_id");



CREATE INDEX "idx_google_form_connections_last_sync_at" ON "public"."google_form_connections" USING "btree" ("last_sync_at");



CREATE INDEX "idx_google_form_connections_sync_status" ON "public"."google_form_connections" USING "btree" ("sync_status");



CREATE INDEX "idx_google_form_sheets_connection_id" ON "public"."google_form_sheets" USING "btree" ("connection_id");



CREATE INDEX "idx_google_form_sheets_spreadsheet_id" ON "public"."google_form_sheets" USING "btree" ("spreadsheet_id");



CREATE INDEX "idx_google_lead_form_connections_clinic_id" ON "public"."google_lead_form_connections" USING "btree" ("clinic_id");



CREATE INDEX "idx_google_lead_form_connections_customer_id" ON "public"."google_lead_form_connections" USING "btree" ("google_customer_id");



CREATE INDEX "idx_google_lead_form_connections_last_sync_at" ON "public"."google_lead_form_connections" USING "btree" ("last_sync_at");



CREATE INDEX "idx_google_lead_form_connections_sync_status" ON "public"."google_lead_form_connections" USING "btree" ("sync_status");



CREATE INDEX "idx_hubspot_connections_status" ON "public"."hubspot_connections" USING "btree" ("connection_status");



CREATE INDEX "idx_hubspot_connections_user_id" ON "public"."hubspot_connections" USING "btree" ("user_id");



CREATE INDEX "idx_pipedrive_active" ON "public"."pipedrive_integration" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_pipedrive_clinic_id" ON "public"."pipedrive_integration" USING "btree" ("clinic_id");



CREATE INDEX "idx_thread_openai_thread_id" ON "public"."threads" USING "btree" ("openai_thread_id");



CREATE INDEX "idx_twilio_config_clinic_id" ON "public"."twilio_config" USING "btree" ("clinic_id");



CREATE INDEX "stripe_events_stripe_subscription_id_idx" ON "public"."stripe_events" USING "btree" ("stripe_subscription_id");



CREATE OR REPLACE TRIGGER "trigger_lead_converted_task" AFTER UPDATE ON "public"."lead" FOR EACH ROW EXECUTE FUNCTION "public"."handle_lead_converted_task"();



CREATE OR REPLACE TRIGGER "trigger_meeting_scheduled_task" AFTER INSERT ON "public"."meeting_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."handle_meeting_scheduled_task"();



CREATE OR REPLACE TRIGGER "update_clinic_lead_form_updated_at" BEFORE UPDATE ON "public"."clinic_lead_form" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_facebook_lead_form_connections_updated_at" BEFORE UPDATE ON "public"."facebook_lead_form_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_facebook_lead_form_connections_updated_at"();



CREATE OR REPLACE TRIGGER "update_google_lead_form_connections_updated_at" BEFORE UPDATE ON "public"."google_lead_form_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_google_lead_form_connections_updated_at"();



CREATE OR REPLACE TRIGGER "update_hubspot_connections_updated_at" BEFORE UPDATE ON "public"."hubspot_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_twilio_config_updated_at" BEFORE UPDATE ON "public"."twilio_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."assistant_files"
    ADD CONSTRAINT "assistant_files_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assistants"
    ADD CONSTRAINT "assistants_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_settings"
    ADD CONSTRAINT "email_settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_key"
    ADD CONSTRAINT "fk_api_key_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic"
    ADD CONSTRAINT "fk_clinic_owner" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation"
    ADD CONSTRAINT "fk_conversation_thread" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facebook_lead_form_connections"
    ADD CONSTRAINT "fk_facebook_lead_form_connections_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_form_connections"
    ADD CONSTRAINT "fk_google_form_connections_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_form_sheets"
    ADD CONSTRAINT "fk_google_form_sheets_connection" FOREIGN KEY ("connection_id") REFERENCES "public"."google_form_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_lead_form_connections"
    ADD CONSTRAINT "fk_google_lead_form_connections_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead"
    ADD CONSTRAINT "fk_lead_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead"
    ADD CONSTRAINT "fk_lead_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead"
    ADD CONSTRAINT "fk_lead_source" FOREIGN KEY ("source_id") REFERENCES "public"."lead_source"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pipedrive_integration"
    ADD CONSTRAINT "fk_pipedrive_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "fk_threads_lead" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_clinic"
    ADD CONSTRAINT "fk_uc_clinic" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_clinic"
    ADD CONSTRAINT "fk_uc_role" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_clinic"
    ADD CONSTRAINT "fk_uc_user" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hubspot_connections"
    ADD CONSTRAINT "hubspot_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mailgun_settings"
    ADD CONSTRAINT "mailgun_settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_schedule"
    ADD CONSTRAINT "meeting_schedule_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."stripe_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."twilio_config"
    ADD CONSTRAINT "twilio_config_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can manage form fields" ON "public"."clinic_lead_form" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can create connections for their clinic" ON "public"."google_form_connections" FOR INSERT WITH CHECK (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can create facebook lead form connections for their clini" ON "public"."facebook_lead_form_connections" FOR INSERT WITH CHECK (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can create lead form connections for their clinic" ON "public"."google_lead_form_connections" FOR INSERT WITH CHECK (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete connections for their clinic" ON "public"."google_form_connections" FOR DELETE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete facebook lead form connections for their clini" ON "public"."facebook_lead_form_connections" FOR DELETE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete lead form connections for their clinic" ON "public"."google_lead_form_connections" FOR DELETE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert pipedrive integration for their clinic" ON "public"."pipedrive_integration" FOR INSERT WITH CHECK (("clinic_id" IN ( SELECT "clinic"."id"
   FROM "public"."clinic"
  WHERE ("clinic"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage emails for their clinics" ON "public"."emails" USING (("clinic_id" IN ( SELECT "clinic"."id"
   FROM "public"."clinic"
  WHERE ("clinic"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage mailgun settings for their clinics" ON "public"."mailgun_settings" USING (("clinic_id" IN ( SELECT "clinic"."id"
   FROM "public"."clinic"
  WHERE ("clinic"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update connections for their clinic" ON "public"."google_form_connections" FOR UPDATE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update facebook lead form connections for their clini" ON "public"."facebook_lead_form_connections" FOR UPDATE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update lead form connections for their clinic" ON "public"."google_lead_form_connections" FOR UPDATE USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their clinic's pipedrive integration" ON "public"."pipedrive_integration" FOR UPDATE USING (("clinic_id" IN ( SELECT "clinic"."id"
   FROM "public"."clinic"
  WHERE ("clinic"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view connections for their clinic" ON "public"."google_form_connections" FOR SELECT USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view facebook lead form connections for their clinic" ON "public"."facebook_lead_form_connections" FOR SELECT USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view lead form connections for their clinic" ON "public"."google_lead_form_connections" FOR SELECT USING (("clinic_id" IN ( SELECT "c"."id"
   FROM "public"."clinic" "c"
  WHERE ("c"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their clinic's pipedrive integration" ON "public"."pipedrive_integration" FOR SELECT USING (("clinic_id" IN ( SELECT "clinic"."id"
   FROM "public"."clinic"
  WHERE ("clinic"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."clinic_lead_form" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facebook_lead_form_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_form_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_lead_form_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hubspot_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mailgun_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipedrive_integration" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_access" ON "public"."hubspot_connections" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";




































































































































































































































GRANT ALL ON FUNCTION "public"."create_email_settings_with_vault"("p_clinic_id" "uuid", "p_smtp_host" "text", "p_smtp_port" integer, "p_smtp_user" "text", "p_smtp_sender_name" "text", "p_smtp_sender_email" "text", "p_smtp_use_tls" boolean, "p_imap_server" "text", "p_imap_port" integer, "p_imap_user" "text", "p_imap_use_ssl" boolean, "p_imap_folder" "text", "p_check_frequency_minutes" integer, "p_sms_auto_reply_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_email_settings_with_vault"("p_clinic_id" "uuid", "p_smtp_host" "text", "p_smtp_port" integer, "p_smtp_user" "text", "p_smtp_sender_name" "text", "p_smtp_sender_email" "text", "p_smtp_use_tls" boolean, "p_imap_server" "text", "p_imap_port" integer, "p_imap_user" "text", "p_imap_use_ssl" boolean, "p_imap_folder" "text", "p_check_frequency_minutes" integer, "p_sms_auto_reply_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_email_settings_with_vault"("p_clinic_id" "uuid", "p_smtp_host" "text", "p_smtp_port" integer, "p_smtp_user" "text", "p_smtp_sender_name" "text", "p_smtp_sender_email" "text", "p_smtp_use_tls" boolean, "p_imap_server" "text", "p_imap_port" integer, "p_imap_user" "text", "p_imap_use_ssl" boolean, "p_imap_folder" "text", "p_check_frequency_minutes" integer, "p_sms_auto_reply_enabled" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."get_vault_secret"("secret_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vault_secret"("secret_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vault_secret"("secret_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_lead_converted_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_lead_converted_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_lead_converted_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_meeting_scheduled_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_meeting_scheduled_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_meeting_scheduled_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_facebook_lead_form_connections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_facebook_lead_form_connections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_facebook_lead_form_connections_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_google_lead_form_connections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_google_lead_form_connections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_google_lead_form_connections_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";






























GRANT ALL ON TABLE "public"."api_key" TO "anon";
GRANT ALL ON TABLE "public"."api_key" TO "authenticated";
GRANT ALL ON TABLE "public"."api_key" TO "service_role";



GRANT ALL ON TABLE "public"."assistant_files" TO "anon";
GRANT ALL ON TABLE "public"."assistant_files" TO "authenticated";
GRANT ALL ON TABLE "public"."assistant_files" TO "service_role";



GRANT ALL ON TABLE "public"."assistants" TO "anon";
GRANT ALL ON TABLE "public"."assistants" TO "authenticated";
GRANT ALL ON TABLE "public"."assistants" TO "service_role";



GRANT ALL ON TABLE "public"."clinic" TO "anon";
GRANT ALL ON TABLE "public"."clinic" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_lead_form" TO "anon";
GRANT ALL ON TABLE "public"."clinic_lead_form" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_lead_form" TO "service_role";



GRANT ALL ON TABLE "public"."conversation" TO "anon";
GRANT ALL ON TABLE "public"."conversation" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation" TO "service_role";



GRANT ALL ON TABLE "public"."email_settings" TO "anon";
GRANT ALL ON TABLE "public"."email_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."email_settings" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."facebook_lead_form_connections" TO "anon";
GRANT ALL ON TABLE "public"."facebook_lead_form_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."facebook_lead_form_connections" TO "service_role";



GRANT ALL ON TABLE "public"."google_form_connections" TO "anon";
GRANT ALL ON TABLE "public"."google_form_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."google_form_connections" TO "service_role";



GRANT ALL ON TABLE "public"."google_form_sheets" TO "anon";
GRANT ALL ON TABLE "public"."google_form_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."google_form_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."google_lead_form_connections" TO "anon";
GRANT ALL ON TABLE "public"."google_lead_form_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."google_lead_form_connections" TO "service_role";



GRANT ALL ON TABLE "public"."hubspot_connections" TO "anon";
GRANT ALL ON TABLE "public"."hubspot_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."hubspot_connections" TO "service_role";



GRANT ALL ON TABLE "public"."lead" TO "anon";
GRANT ALL ON TABLE "public"."lead" TO "authenticated";
GRANT ALL ON TABLE "public"."lead" TO "service_role";



GRANT ALL ON TABLE "public"."lead_source" TO "anon";
GRANT ALL ON TABLE "public"."lead_source" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_source" TO "service_role";



GRANT ALL ON TABLE "public"."mailgun_settings" TO "anon";
GRANT ALL ON TABLE "public"."mailgun_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."mailgun_settings" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_schedule" TO "anon";
GRANT ALL ON TABLE "public"."meeting_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."pipedrive_integration" TO "anon";
GRANT ALL ON TABLE "public"."pipedrive_integration" TO "authenticated";
GRANT ALL ON TABLE "public"."pipedrive_integration" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."role" TO "anon";
GRANT ALL ON TABLE "public"."role" TO "authenticated";
GRANT ALL ON TABLE "public"."role" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."twilio_config" TO "anon";
GRANT ALL ON TABLE "public"."twilio_config" TO "authenticated";
GRANT ALL ON TABLE "public"."twilio_config" TO "service_role";



GRANT ALL ON TABLE "public"."user" TO "anon";
GRANT ALL ON TABLE "public"."user" TO "authenticated";
GRANT ALL ON TABLE "public"."user" TO "service_role";



GRANT ALL ON TABLE "public"."user_clinic" TO "anon";
GRANT ALL ON TABLE "public"."user_clinic" TO "authenticated";
GRANT ALL ON TABLE "public"."user_clinic" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
