create type "public"."connection_status" as enum ('active', 'expired', 'error');

create type "public"."integration_auth_type" as enum ('oauth2', 'api_key', 'webhook');

create type "public"."integration_type" as enum ('crm', 'form', 'other');

create type "public"."lead_status" as enum ('New', 'Engaged', 'Booked', 'Cold', 'Converted');

create type "public"."role_type" as enum ('owner', 'receptionist');

create type "public"."status_enum" as enum ('new', 'scheduled', 'completed', 'inactive', 'cold');

create sequence "public"."stripe_events_id_seq";

create sequence "public"."stripe_subscriptions_id_seq";

revoke delete on table "public"."api_key" from "anon";

revoke insert on table "public"."api_key" from "anon";

revoke references on table "public"."api_key" from "anon";

revoke select on table "public"."api_key" from "anon";

revoke trigger on table "public"."api_key" from "anon";

revoke truncate on table "public"."api_key" from "anon";

revoke update on table "public"."api_key" from "anon";

revoke delete on table "public"."api_key" from "authenticated";

revoke insert on table "public"."api_key" from "authenticated";

revoke references on table "public"."api_key" from "authenticated";

revoke select on table "public"."api_key" from "authenticated";

revoke trigger on table "public"."api_key" from "authenticated";

revoke truncate on table "public"."api_key" from "authenticated";

revoke update on table "public"."api_key" from "authenticated";

revoke delete on table "public"."api_key" from "service_role";

revoke insert on table "public"."api_key" from "service_role";

revoke references on table "public"."api_key" from "service_role";

revoke select on table "public"."api_key" from "service_role";

revoke trigger on table "public"."api_key" from "service_role";

revoke truncate on table "public"."api_key" from "service_role";

revoke update on table "public"."api_key" from "service_role";

revoke delete on table "public"."assistant_files" from "anon";

revoke insert on table "public"."assistant_files" from "anon";

revoke references on table "public"."assistant_files" from "anon";

revoke select on table "public"."assistant_files" from "anon";

revoke trigger on table "public"."assistant_files" from "anon";

revoke truncate on table "public"."assistant_files" from "anon";

revoke update on table "public"."assistant_files" from "anon";

revoke delete on table "public"."assistant_files" from "authenticated";

revoke insert on table "public"."assistant_files" from "authenticated";

revoke references on table "public"."assistant_files" from "authenticated";

revoke select on table "public"."assistant_files" from "authenticated";

revoke trigger on table "public"."assistant_files" from "authenticated";

revoke truncate on table "public"."assistant_files" from "authenticated";

revoke update on table "public"."assistant_files" from "authenticated";

revoke delete on table "public"."assistant_files" from "service_role";

revoke insert on table "public"."assistant_files" from "service_role";

revoke references on table "public"."assistant_files" from "service_role";

revoke select on table "public"."assistant_files" from "service_role";

revoke trigger on table "public"."assistant_files" from "service_role";

revoke truncate on table "public"."assistant_files" from "service_role";

revoke update on table "public"."assistant_files" from "service_role";

revoke delete on table "public"."assistants" from "anon";

revoke insert on table "public"."assistants" from "anon";

revoke references on table "public"."assistants" from "anon";

revoke select on table "public"."assistants" from "anon";

revoke trigger on table "public"."assistants" from "anon";

revoke truncate on table "public"."assistants" from "anon";

revoke update on table "public"."assistants" from "anon";

revoke delete on table "public"."assistants" from "authenticated";

revoke insert on table "public"."assistants" from "authenticated";

revoke references on table "public"."assistants" from "authenticated";

revoke select on table "public"."assistants" from "authenticated";

revoke trigger on table "public"."assistants" from "authenticated";

revoke truncate on table "public"."assistants" from "authenticated";

revoke update on table "public"."assistants" from "authenticated";

revoke delete on table "public"."assistants" from "service_role";

revoke insert on table "public"."assistants" from "service_role";

revoke references on table "public"."assistants" from "service_role";

revoke select on table "public"."assistants" from "service_role";

revoke trigger on table "public"."assistants" from "service_role";

revoke truncate on table "public"."assistants" from "service_role";

revoke update on table "public"."assistants" from "service_role";

revoke delete on table "public"."clinic" from "anon";

revoke insert on table "public"."clinic" from "anon";

revoke references on table "public"."clinic" from "anon";

revoke select on table "public"."clinic" from "anon";

revoke trigger on table "public"."clinic" from "anon";

revoke truncate on table "public"."clinic" from "anon";

revoke update on table "public"."clinic" from "anon";

revoke delete on table "public"."clinic" from "authenticated";

revoke insert on table "public"."clinic" from "authenticated";

revoke references on table "public"."clinic" from "authenticated";

revoke select on table "public"."clinic" from "authenticated";

revoke trigger on table "public"."clinic" from "authenticated";

revoke truncate on table "public"."clinic" from "authenticated";

revoke update on table "public"."clinic" from "authenticated";

revoke delete on table "public"."clinic" from "service_role";

revoke insert on table "public"."clinic" from "service_role";

revoke references on table "public"."clinic" from "service_role";

revoke select on table "public"."clinic" from "service_role";

revoke trigger on table "public"."clinic" from "service_role";

revoke truncate on table "public"."clinic" from "service_role";

revoke update on table "public"."clinic" from "service_role";

revoke delete on table "public"."conversation" from "anon";

revoke insert on table "public"."conversation" from "anon";

revoke references on table "public"."conversation" from "anon";

revoke select on table "public"."conversation" from "anon";

revoke trigger on table "public"."conversation" from "anon";

revoke truncate on table "public"."conversation" from "anon";

revoke update on table "public"."conversation" from "anon";

revoke delete on table "public"."conversation" from "authenticated";

revoke insert on table "public"."conversation" from "authenticated";

revoke references on table "public"."conversation" from "authenticated";

revoke select on table "public"."conversation" from "authenticated";

revoke trigger on table "public"."conversation" from "authenticated";

revoke truncate on table "public"."conversation" from "authenticated";

revoke update on table "public"."conversation" from "authenticated";

revoke delete on table "public"."conversation" from "service_role";

revoke insert on table "public"."conversation" from "service_role";

revoke references on table "public"."conversation" from "service_role";

revoke select on table "public"."conversation" from "service_role";

revoke trigger on table "public"."conversation" from "service_role";

revoke truncate on table "public"."conversation" from "service_role";

revoke update on table "public"."conversation" from "service_role";

revoke delete on table "public"."email_settings" from "anon";

revoke insert on table "public"."email_settings" from "anon";

revoke references on table "public"."email_settings" from "anon";

revoke select on table "public"."email_settings" from "anon";

revoke trigger on table "public"."email_settings" from "anon";

revoke truncate on table "public"."email_settings" from "anon";

revoke update on table "public"."email_settings" from "anon";

revoke delete on table "public"."email_settings" from "authenticated";

revoke insert on table "public"."email_settings" from "authenticated";

revoke references on table "public"."email_settings" from "authenticated";

revoke select on table "public"."email_settings" from "authenticated";

revoke trigger on table "public"."email_settings" from "authenticated";

revoke truncate on table "public"."email_settings" from "authenticated";

revoke update on table "public"."email_settings" from "authenticated";

revoke delete on table "public"."email_settings" from "service_role";

revoke insert on table "public"."email_settings" from "service_role";

revoke references on table "public"."email_settings" from "service_role";

revoke select on table "public"."email_settings" from "service_role";

revoke trigger on table "public"."email_settings" from "service_role";

revoke truncate on table "public"."email_settings" from "service_role";

revoke update on table "public"."email_settings" from "service_role";

revoke delete on table "public"."lead" from "anon";

revoke insert on table "public"."lead" from "anon";

revoke references on table "public"."lead" from "anon";

revoke select on table "public"."lead" from "anon";

revoke trigger on table "public"."lead" from "anon";

revoke truncate on table "public"."lead" from "anon";

revoke update on table "public"."lead" from "anon";

revoke delete on table "public"."lead" from "authenticated";

revoke insert on table "public"."lead" from "authenticated";

revoke references on table "public"."lead" from "authenticated";

revoke select on table "public"."lead" from "authenticated";

revoke trigger on table "public"."lead" from "authenticated";

revoke truncate on table "public"."lead" from "authenticated";

revoke update on table "public"."lead" from "authenticated";

revoke delete on table "public"."lead" from "service_role";

revoke insert on table "public"."lead" from "service_role";

revoke references on table "public"."lead" from "service_role";

revoke select on table "public"."lead" from "service_role";

revoke trigger on table "public"."lead" from "service_role";

revoke truncate on table "public"."lead" from "service_role";

revoke update on table "public"."lead" from "service_role";

revoke delete on table "public"."lead_source" from "anon";

revoke insert on table "public"."lead_source" from "anon";

revoke references on table "public"."lead_source" from "anon";

revoke select on table "public"."lead_source" from "anon";

revoke trigger on table "public"."lead_source" from "anon";

revoke truncate on table "public"."lead_source" from "anon";

revoke update on table "public"."lead_source" from "anon";

revoke delete on table "public"."lead_source" from "authenticated";

revoke insert on table "public"."lead_source" from "authenticated";

revoke references on table "public"."lead_source" from "authenticated";

revoke select on table "public"."lead_source" from "authenticated";

revoke trigger on table "public"."lead_source" from "authenticated";

revoke truncate on table "public"."lead_source" from "authenticated";

revoke update on table "public"."lead_source" from "authenticated";

revoke delete on table "public"."lead_source" from "service_role";

revoke insert on table "public"."lead_source" from "service_role";

revoke references on table "public"."lead_source" from "service_role";

revoke select on table "public"."lead_source" from "service_role";

revoke trigger on table "public"."lead_source" from "service_role";

revoke truncate on table "public"."lead_source" from "service_role";

revoke update on table "public"."lead_source" from "service_role";

revoke delete on table "public"."threads" from "anon";

revoke insert on table "public"."threads" from "anon";

revoke references on table "public"."threads" from "anon";

revoke select on table "public"."threads" from "anon";

revoke trigger on table "public"."threads" from "anon";

revoke truncate on table "public"."threads" from "anon";

revoke update on table "public"."threads" from "anon";

revoke delete on table "public"."threads" from "authenticated";

revoke insert on table "public"."threads" from "authenticated";

revoke references on table "public"."threads" from "authenticated";

revoke select on table "public"."threads" from "authenticated";

revoke trigger on table "public"."threads" from "authenticated";

revoke truncate on table "public"."threads" from "authenticated";

revoke update on table "public"."threads" from "authenticated";

revoke delete on table "public"."threads" from "service_role";

revoke insert on table "public"."threads" from "service_role";

revoke references on table "public"."threads" from "service_role";

revoke select on table "public"."threads" from "service_role";

revoke trigger on table "public"."threads" from "service_role";

revoke truncate on table "public"."threads" from "service_role";

revoke update on table "public"."threads" from "service_role";

revoke delete on table "public"."user" from "anon";

revoke insert on table "public"."user" from "anon";

revoke references on table "public"."user" from "anon";

revoke select on table "public"."user" from "anon";

revoke trigger on table "public"."user" from "anon";

revoke truncate on table "public"."user" from "anon";

revoke update on table "public"."user" from "anon";

revoke delete on table "public"."user" from "authenticated";

revoke insert on table "public"."user" from "authenticated";

revoke references on table "public"."user" from "authenticated";

revoke select on table "public"."user" from "authenticated";

revoke trigger on table "public"."user" from "authenticated";

revoke truncate on table "public"."user" from "authenticated";

revoke update on table "public"."user" from "authenticated";

revoke delete on table "public"."user" from "service_role";

revoke insert on table "public"."user" from "service_role";

revoke references on table "public"."user" from "service_role";

revoke select on table "public"."user" from "service_role";

revoke trigger on table "public"."user" from "service_role";

revoke truncate on table "public"."user" from "service_role";

revoke update on table "public"."user" from "service_role";

revoke delete on table "public"."user_clinic" from "anon";

revoke insert on table "public"."user_clinic" from "anon";

revoke references on table "public"."user_clinic" from "anon";

revoke select on table "public"."user_clinic" from "anon";

revoke trigger on table "public"."user_clinic" from "anon";

revoke truncate on table "public"."user_clinic" from "anon";

revoke update on table "public"."user_clinic" from "anon";

revoke delete on table "public"."user_clinic" from "authenticated";

revoke insert on table "public"."user_clinic" from "authenticated";

revoke references on table "public"."user_clinic" from "authenticated";

revoke select on table "public"."user_clinic" from "authenticated";

revoke trigger on table "public"."user_clinic" from "authenticated";

revoke truncate on table "public"."user_clinic" from "authenticated";

revoke update on table "public"."user_clinic" from "authenticated";

revoke delete on table "public"."user_clinic" from "service_role";

revoke insert on table "public"."user_clinic" from "service_role";

revoke references on table "public"."user_clinic" from "service_role";

revoke select on table "public"."user_clinic" from "service_role";

revoke trigger on table "public"."user_clinic" from "service_role";

revoke truncate on table "public"."user_clinic" from "service_role";

revoke update on table "public"."user_clinic" from "service_role";

alter table "public"."lead" drop constraint "lead_status_check";

alter table "public"."lead" drop constraint "lead_interest_level_check";

alter table "public"."lead" drop constraint "lead_urgency_check";

drop function if exists "public"."custom_access_token_hook"(event jsonb);

create table "public"."clinic_lead_form" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "field_id" character varying(255) not null,
    "field_name" character varying(255) not null,
    "field_type" character varying(50) not null,
    "is_required" boolean default false,
    "field_options" text[],
    "field_order" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."clinic_lead_form" enable row level security;

create table "public"."emails" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid not null,
    "message_id" text not null,
    "direction" text not null,
    "from_email" text not null,
    "from_name" text,
    "to_email" text not null,
    "to_name" text,
    "subject" text,
    "body_text" text,
    "body_html" text,
    "attachments" jsonb default '[]'::jsonb,
    "status" text default 'received'::text,
    "received_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
);


alter table "public"."emails" enable row level security;

create table "public"."facebook_lead_form_connections" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "facebook_page_id" character varying not null,
    "lead_form_id" character varying not null,
    "page_access_token" text not null,
    "app_id" character varying not null,
    "app_secret" character varying not null,
    "webhook_verify_token" character varying,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying not null default 'pending'::character varying,
    "token_expiry" timestamp without time zone,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


alter table "public"."facebook_lead_form_connections" enable row level security;

create table "public"."google_form_connections" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "google_form_id" character varying,
    "access_token" text not null,
    "refresh_token" text,
    "token_expiry" timestamp without time zone,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying not null default 'pending'::character varying,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "user_id" character varying
);


alter table "public"."google_form_connections" enable row level security;

create table "public"."google_form_sheets" (
    "id" uuid not null default gen_random_uuid(),
    "connection_id" uuid not null,
    "spreadsheet_id" character varying not null,
    "spreadsheet_title" character varying not null,
    "sheet_id" character varying not null,
    "sheet_title" character varying not null,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


create table "public"."google_lead_form_connections" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "google_customer_id" character varying not null,
    "lead_form_id" character varying not null,
    "campaign_id" character varying,
    "access_token" text not null,
    "refresh_token" text,
    "token_expiry" timestamp without time zone,
    "webhook_url" character varying,
    "last_sync_at" timestamp without time zone,
    "sync_status" character varying not null default 'pending'::character varying,
    "developer_token" character varying,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


alter table "public"."google_lead_form_connections" enable row level security;

create table "public"."hubspot_connections" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "access_token" text,
    "refresh_token" text,
    "token_expires_at" timestamp without time zone,
    "account_name" text,
    "contact_count" integer default 0,
    "deal_count" integer default 0,
    "hub_id" text,
    "hub_domain" text,
    "scope" text,
    "connection_status" text default 'disconnected'::text,
    "last_sync_at" timestamp without time zone,
    "error_message" text,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
);


alter table "public"."hubspot_connections" enable row level security;

create table "public"."integration_connections" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "integration_id" uuid not null,
    "status" connection_status not null default 'active'::connection_status,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "auth_data" jsonb not null
);


create table "public"."integrations" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" integration_type not null,
    "auth_type" integration_auth_type not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."mailgun_settings" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid not null,
    "mailgun_domain" text not null,
    "sender_name" text not null,
    "sender_email" text not null,
    "auto_reply_enabled" boolean default false,
    "auto_reply_message" text default 'Thank you for contacting us. We will get back to you soon.'::text,
    "auto_reply_subject" text default 'Thank you for contacting us'::text,
    "email_tracking_enabled" boolean default true,
    "click_tracking_enabled" boolean default true,
    "open_tracking_enabled" boolean default true,
    "domain_verified" boolean default false,
    "status" text default 'active'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."mailgun_settings" enable row level security;

create table "public"."meeting_schedule" (
    "id" uuid not null default gen_random_uuid(),
    "username" character varying(50) not null,
    "email" character varying(100) not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "preferred_meeting_time" timestamp without time zone,
    "meeting_link" character varying(255),
    "calendly_link" character varying(255),
    "meeting_notes" text,
    "clinic_id" uuid,
    "status" character varying(20) not null default 'pending'::character varying,
    "phone_number" character varying(20)
);


create table "public"."pipedrive_integration" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "access_token" text not null,
    "refresh_token" text,
    "api_domain" character varying(255) not null,
    "company_id" character varying(100) not null,
    "user_id" character varying(100) not null,
    "expires_at" timestamp with time zone,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


alter table "public"."pipedrive_integration" enable row level security;

create table "public"."plans" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "interval" text not null,
    "price_id" text not null,
    "amount" numeric not null,
    "currency" text default 'usd'::text,
    "trial_days" integer default 0,
    "features" jsonb default '[]'::jsonb,
    "active" boolean default true,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "description" text
);


create table "public"."role" (
    "id" uuid not null default gen_random_uuid(),
    "type" role_type not null,
    "permissions" jsonb not null,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
);


create table "public"."stripe_events" (
    "id" integer not null default nextval('stripe_events_id_seq'::regclass),
    "event_id" text,
    "type" text,
    "payload" jsonb,
    "stripe_subscription_id" text,
    "subscription_id" integer,
    "received_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "summary" text
);


create table "public"."stripe_subscriptions" (
    "id" integer not null default nextval('stripe_subscriptions_id_seq'::regclass),
    "clinic_id" uuid,
    "stripe_subscription_id" text,
    "stripe_price_id" text,
    "status" text,
    "current_period_end" timestamp without time zone,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "trial_end" timestamp without time zone,
    "cardholder_name" text,
    "last4" text,
    "exp_month" integer,
    "exp_year" integer,
    "brand" text
);


create table "public"."tasks" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid,
    "task" text not null,
    "priority" text not null default 'low'::text,
    "time" text not null,
    "due_at" timestamp with time zone not null,
    "completed" boolean not null default false,
    "is_automated" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."twilio_config" (
    "id" uuid not null default gen_random_uuid(),
    "clinic_id" uuid not null,
    "phone_number" character varying(20) not null,
    "twilio_account_sid" character varying(100),
    "twilio_auth_token" character varying(100),
    "twilio_phone_number" character varying(20),
    "status" character varying(50) default 'pending'::character varying,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);


alter table "public"."assistant_files" add column "document_type" character varying(50);

alter table "public"."assistant_files" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."assistants" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."clinic" add column "clinic_type" text;

alter table "public"."clinic" add column "has_chatbot" boolean default false;

alter table "public"."clinic" add column "mailgun_domain" character varying;

alter table "public"."clinic" add column "mailgun_email" character varying;

alter table "public"."clinic" add column "other_tools" text default ''::text;

alter table "public"."clinic" add column "slug" character varying not null default ''::character varying;

alter table "public"."clinic" add column "stripe_customer_id" text;

alter table "public"."clinic" add column "use_pipedrive" boolean not null default false;

alter table "public"."clinic" add column "uses_ads" boolean default false;

alter table "public"."clinic" add column "uses_hubspot" boolean default false;

alter table "public"."clinic" alter column "language" drop not null;

alter table "public"."email_settings" drop column "auto_reply_enabled";

alter table "public"."email_settings" add column "sms_auto_reply_enabled" boolean default true;

alter table "public"."email_settings" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."email_settings" alter column "imap_password" set data type text using "imap_password"::text;

alter table "public"."email_settings" alter column "imap_port" drop default;

alter table "public"."email_settings" alter column "imap_server" set data type text using "imap_server"::text;

alter table "public"."email_settings" alter column "imap_use_ssl" drop default;

alter table "public"."email_settings" alter column "imap_user" set data type text using "imap_user"::text;

alter table "public"."email_settings" alter column "smtp_host" set data type text using "smtp_host"::text;

alter table "public"."email_settings" alter column "smtp_password" set data type text using "smtp_password"::text;

alter table "public"."email_settings" alter column "smtp_port" drop default;

alter table "public"."email_settings" alter column "smtp_sender_email" set data type text using "smtp_sender_email"::text;

alter table "public"."email_settings" alter column "smtp_sender_name" set data type text using "smtp_sender_name"::text;

alter table "public"."email_settings" alter column "smtp_use_tls" drop default;

alter table "public"."email_settings" alter column "smtp_user" set data type text using "smtp_user"::text;

alter table "public"."lead" add column "form_data" jsonb default '{}'::jsonb;

alter table "public"."lead" alter column "status" set default 'New'::lead_status;

alter table "public"."lead" alter column "status" set data type lead_status using "status"::lead_status;

alter table "public"."lead_source" alter column "id" set default gen_random_uuid();

alter table "public"."threads" alter column "status" set data type status_enum using "status"::status_enum;

alter table "public"."user_clinic" drop column "position";

alter table "public"."user_clinic" drop column "role";

alter table "public"."user_clinic" add column "role_id" uuid not null;

alter table "public"."user_clinic" alter column "id" set default gen_random_uuid();

alter sequence "public"."stripe_events_id_seq" owned by "public"."stripe_events"."id";

alter sequence "public"."stripe_subscriptions_id_seq" owned by "public"."stripe_subscriptions"."id";

CREATE UNIQUE INDEX clinic_lead_form_pkey ON public.clinic_lead_form USING btree (id);

CREATE UNIQUE INDEX emails_pkey ON public.emails USING btree (id);

CREATE UNIQUE INDEX facebook_lead_form_connections_pkey ON public.facebook_lead_form_connections USING btree (id);

CREATE UNIQUE INDEX google_form_connections_pkey ON public.google_form_connections USING btree (id);

CREATE UNIQUE INDEX google_form_sheets_pkey ON public.google_form_sheets USING btree (id);

CREATE UNIQUE INDEX google_lead_form_connections_pkey ON public.google_lead_form_connections USING btree (id);

CREATE UNIQUE INDEX hubspot_connections_pkey ON public.hubspot_connections USING btree (id);

CREATE INDEX idx_assistant_files_document_type ON public.assistant_files USING btree (assistant_id, document_type);

CREATE INDEX idx_clinic_lead_form_clinic_id ON public.clinic_lead_form USING btree (clinic_id);

CREATE INDEX idx_clinic_lead_form_field_id ON public.clinic_lead_form USING btree (field_id);

CREATE INDEX idx_clinic_lead_form_order ON public.clinic_lead_form USING btree (clinic_id, field_order);

CREATE INDEX idx_facebook_lead_form_connections_clinic_id ON public.facebook_lead_form_connections USING btree (clinic_id);

CREATE INDEX idx_facebook_lead_form_connections_last_sync_at ON public.facebook_lead_form_connections USING btree (last_sync_at);

CREATE INDEX idx_facebook_lead_form_connections_page_id ON public.facebook_lead_form_connections USING btree (facebook_page_id);

CREATE INDEX idx_facebook_lead_form_connections_sync_status ON public.facebook_lead_form_connections USING btree (sync_status);

CREATE INDEX idx_google_form_connections_clinic_id ON public.google_form_connections USING btree (clinic_id);

CREATE INDEX idx_google_form_connections_last_sync_at ON public.google_form_connections USING btree (last_sync_at);

CREATE INDEX idx_google_form_connections_sync_status ON public.google_form_connections USING btree (sync_status);

CREATE INDEX idx_google_form_sheets_connection_id ON public.google_form_sheets USING btree (connection_id);

CREATE INDEX idx_google_form_sheets_spreadsheet_id ON public.google_form_sheets USING btree (spreadsheet_id);

CREATE INDEX idx_google_lead_form_connections_clinic_id ON public.google_lead_form_connections USING btree (clinic_id);

CREATE INDEX idx_google_lead_form_connections_customer_id ON public.google_lead_form_connections USING btree (google_customer_id);

CREATE INDEX idx_google_lead_form_connections_last_sync_at ON public.google_lead_form_connections USING btree (last_sync_at);

CREATE INDEX idx_google_lead_form_connections_sync_status ON public.google_lead_form_connections USING btree (sync_status);

CREATE INDEX idx_hubspot_connections_status ON public.hubspot_connections USING btree (connection_status);

CREATE INDEX idx_hubspot_connections_user_id ON public.hubspot_connections USING btree (user_id);

CREATE INDEX idx_pipedrive_active ON public.pipedrive_integration USING btree (is_active) WHERE (is_active = true);

CREATE INDEX idx_pipedrive_clinic_id ON public.pipedrive_integration USING btree (clinic_id);

CREATE INDEX idx_twilio_config_clinic_id ON public.twilio_config USING btree (clinic_id);

CREATE UNIQUE INDEX integration_connections_clinic_id_integration_id_key ON public.integration_connections USING btree (clinic_id, integration_id);

CREATE UNIQUE INDEX integration_connections_pkey ON public.integration_connections USING btree (id);

CREATE UNIQUE INDEX integrations_pkey ON public.integrations USING btree (id);

CREATE UNIQUE INDEX mailgun_settings_clinic_id_key ON public.mailgun_settings USING btree (clinic_id);

CREATE UNIQUE INDEX mailgun_settings_pkey ON public.mailgun_settings USING btree (id);

CREATE UNIQUE INDEX meeting_schedule_email_key ON public.meeting_schedule USING btree (email);

CREATE UNIQUE INDEX meeting_schedule_pkey ON public.meeting_schedule USING btree (id);

CREATE UNIQUE INDEX pipedrive_integration_pkey ON public.pipedrive_integration USING btree (id);

CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id);

CREATE UNIQUE INDEX plans_price_id_key ON public.plans USING btree (price_id);

CREATE UNIQUE INDEX role_pkey ON public.role USING btree (id);

CREATE UNIQUE INDEX stripe_events_event_id_key ON public.stripe_events USING btree (event_id);

CREATE UNIQUE INDEX stripe_events_pkey ON public.stripe_events USING btree (id);

CREATE INDEX stripe_events_stripe_subscription_id_idx ON public.stripe_events USING btree (stripe_subscription_id);

CREATE UNIQUE INDEX stripe_subscriptions_pkey ON public.stripe_subscriptions USING btree (id);

CREATE UNIQUE INDEX stripe_subscriptions_stripe_subscription_id_key ON public.stripe_subscriptions USING btree (stripe_subscription_id);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX twilio_config_pkey ON public.twilio_config USING btree (id);

CREATE UNIQUE INDEX unique_clinic ON public.stripe_subscriptions USING btree (clinic_id);

CREATE UNIQUE INDEX unique_clinic_phone ON public.twilio_config USING btree (clinic_id, phone_number);

CREATE UNIQUE INDEX unique_clinic_pipedrive ON public.pipedrive_integration USING btree (clinic_id);

CREATE UNIQUE INDEX unique_facebook_lead_form_connection ON public.facebook_lead_form_connections USING btree (clinic_id, facebook_page_id, lead_form_id);

CREATE UNIQUE INDEX unique_field_per_clinic ON public.clinic_lead_form USING btree (clinic_id, field_id);

CREATE UNIQUE INDEX unique_google_lead_form_connection ON public.google_lead_form_connections USING btree (clinic_id, google_customer_id, lead_form_id);

CREATE UNIQUE INDEX unique_lead_email ON public.lead USING btree (email);

CREATE UNIQUE INDEX unique_spreadsheet_sheet ON public.google_form_sheets USING btree (connection_id, spreadsheet_id, sheet_id);

alter table "public"."clinic_lead_form" add constraint "clinic_lead_form_pkey" PRIMARY KEY using index "clinic_lead_form_pkey";

alter table "public"."emails" add constraint "emails_pkey" PRIMARY KEY using index "emails_pkey";

alter table "public"."facebook_lead_form_connections" add constraint "facebook_lead_form_connections_pkey" PRIMARY KEY using index "facebook_lead_form_connections_pkey";

alter table "public"."google_form_connections" add constraint "google_form_connections_pkey" PRIMARY KEY using index "google_form_connections_pkey";

alter table "public"."google_form_sheets" add constraint "google_form_sheets_pkey" PRIMARY KEY using index "google_form_sheets_pkey";

alter table "public"."google_lead_form_connections" add constraint "google_lead_form_connections_pkey" PRIMARY KEY using index "google_lead_form_connections_pkey";

alter table "public"."hubspot_connections" add constraint "hubspot_connections_pkey" PRIMARY KEY using index "hubspot_connections_pkey";

alter table "public"."integration_connections" add constraint "integration_connections_pkey" PRIMARY KEY using index "integration_connections_pkey";

alter table "public"."integrations" add constraint "integrations_pkey" PRIMARY KEY using index "integrations_pkey";

alter table "public"."mailgun_settings" add constraint "mailgun_settings_pkey" PRIMARY KEY using index "mailgun_settings_pkey";

alter table "public"."meeting_schedule" add constraint "meeting_schedule_pkey" PRIMARY KEY using index "meeting_schedule_pkey";

alter table "public"."pipedrive_integration" add constraint "pipedrive_integration_pkey" PRIMARY KEY using index "pipedrive_integration_pkey";

alter table "public"."plans" add constraint "plans_pkey" PRIMARY KEY using index "plans_pkey";

alter table "public"."role" add constraint "role_pkey" PRIMARY KEY using index "role_pkey";

alter table "public"."stripe_events" add constraint "stripe_events_pkey" PRIMARY KEY using index "stripe_events_pkey";

alter table "public"."stripe_subscriptions" add constraint "stripe_subscriptions_pkey" PRIMARY KEY using index "stripe_subscriptions_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."twilio_config" add constraint "twilio_config_pkey" PRIMARY KEY using index "twilio_config_pkey";

alter table "public"."assistant_files" add constraint "chk_document_type" CHECK ((((document_type)::text = ANY ((ARRAY['service'::character varying, 'pricing'::character varying, 'testimonials'::character varying])::text[])) OR (document_type IS NULL))) not valid;

alter table "public"."assistant_files" validate constraint "chk_document_type";

alter table "public"."clinic_lead_form" add constraint "clinic_lead_form_field_type_check" CHECK (((field_type)::text = ANY ((ARRAY['text'::character varying, 'email'::character varying, 'tel'::character varying, 'number'::character varying, 'select'::character varying, 'textarea'::character varying])::text[]))) not valid;

alter table "public"."clinic_lead_form" validate constraint "clinic_lead_form_field_type_check";

alter table "public"."clinic_lead_form" add constraint "unique_field_per_clinic" UNIQUE using index "unique_field_per_clinic";

alter table "public"."emails" add constraint "emails_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."emails" validate constraint "emails_clinic_id_fkey";

alter table "public"."emails" add constraint "emails_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))) not valid;

alter table "public"."emails" validate constraint "emails_direction_check";

alter table "public"."emails" add constraint "emails_status_check" CHECK ((status = ANY (ARRAY['received'::text, 'read'::text, 'replied'::text, 'archived'::text]))) not valid;

alter table "public"."emails" validate constraint "emails_status_check";

alter table "public"."facebook_lead_form_connections" add constraint "facebook_lead_form_connections_sync_status_check" CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::text[]))) not valid;

alter table "public"."facebook_lead_form_connections" validate constraint "facebook_lead_form_connections_sync_status_check";

alter table "public"."facebook_lead_form_connections" add constraint "fk_facebook_lead_form_connections_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."facebook_lead_form_connections" validate constraint "fk_facebook_lead_form_connections_clinic";

alter table "public"."facebook_lead_form_connections" add constraint "unique_facebook_lead_form_connection" UNIQUE using index "unique_facebook_lead_form_connection";

alter table "public"."google_form_connections" add constraint "fk_google_form_connections_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."google_form_connections" validate constraint "fk_google_form_connections_clinic";

alter table "public"."google_form_connections" add constraint "google_form_connections_sync_status_check" CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::text[]))) not valid;

alter table "public"."google_form_connections" validate constraint "google_form_connections_sync_status_check";

alter table "public"."google_form_sheets" add constraint "fk_google_form_sheets_connection" FOREIGN KEY (connection_id) REFERENCES google_form_connections(id) ON DELETE CASCADE not valid;

alter table "public"."google_form_sheets" validate constraint "fk_google_form_sheets_connection";

alter table "public"."google_form_sheets" add constraint "unique_spreadsheet_sheet" UNIQUE using index "unique_spreadsheet_sheet";

alter table "public"."google_lead_form_connections" add constraint "fk_google_lead_form_connections_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."google_lead_form_connections" validate constraint "fk_google_lead_form_connections_clinic";

alter table "public"."google_lead_form_connections" add constraint "google_lead_form_connections_sync_status_check" CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::text[]))) not valid;

alter table "public"."google_lead_form_connections" validate constraint "google_lead_form_connections_sync_status_check";

alter table "public"."google_lead_form_connections" add constraint "unique_google_lead_form_connection" UNIQUE using index "unique_google_lead_form_connection";

alter table "public"."hubspot_connections" add constraint "hubspot_connections_connection_status_check" CHECK ((connection_status = ANY (ARRAY['disconnected'::text, 'connecting'::text, 'connected'::text]))) not valid;

alter table "public"."hubspot_connections" validate constraint "hubspot_connections_connection_status_check";

alter table "public"."hubspot_connections" add constraint "hubspot_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."hubspot_connections" validate constraint "hubspot_connections_user_id_fkey";

alter table "public"."integration_connections" add constraint "integration_connections_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."integration_connections" validate constraint "integration_connections_clinic_id_fkey";

alter table "public"."integration_connections" add constraint "integration_connections_clinic_id_integration_id_key" UNIQUE using index "integration_connections_clinic_id_integration_id_key";

alter table "public"."integration_connections" add constraint "integration_connections_integration_id_fkey" FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE not valid;

alter table "public"."integration_connections" validate constraint "integration_connections_integration_id_fkey";

alter table "public"."lead" add constraint "unique_lead_email" UNIQUE using index "unique_lead_email";

alter table "public"."mailgun_settings" add constraint "mailgun_settings_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."mailgun_settings" validate constraint "mailgun_settings_clinic_id_fkey";

alter table "public"."mailgun_settings" add constraint "mailgun_settings_clinic_id_key" UNIQUE using index "mailgun_settings_clinic_id_key";

alter table "public"."mailgun_settings" add constraint "mailgun_settings_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."mailgun_settings" validate constraint "mailgun_settings_status_check";

alter table "public"."meeting_schedule" add constraint "meeting_schedule_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."meeting_schedule" validate constraint "meeting_schedule_clinic_id_fkey";

alter table "public"."meeting_schedule" add constraint "meeting_schedule_email_key" UNIQUE using index "meeting_schedule_email_key";

alter table "public"."meeting_schedule" add constraint "meeting_schedule_status_check" CHECK (((status)::text = ANY ((ARRAY['confirmed'::character varying, 'pending'::character varying])::text[]))) not valid;

alter table "public"."meeting_schedule" validate constraint "meeting_schedule_status_check";

alter table "public"."pipedrive_integration" add constraint "fk_pipedrive_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."pipedrive_integration" validate constraint "fk_pipedrive_clinic";

alter table "public"."pipedrive_integration" add constraint "unique_clinic_pipedrive" UNIQUE using index "unique_clinic_pipedrive";

alter table "public"."plans" add constraint "plans_interval_check" CHECK (("interval" = ANY (ARRAY['month'::text, 'year'::text]))) not valid;

alter table "public"."plans" validate constraint "plans_interval_check";

alter table "public"."plans" add constraint "plans_price_id_key" UNIQUE using index "plans_price_id_key";

alter table "public"."stripe_events" add constraint "stripe_events_event_id_key" UNIQUE using index "stripe_events_event_id_key";

alter table "public"."stripe_events" add constraint "stripe_events_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES stripe_subscriptions(id) ON DELETE SET NULL not valid;

alter table "public"."stripe_events" validate constraint "stripe_events_subscription_id_fkey";

alter table "public"."stripe_subscriptions" add constraint "stripe_subscriptions_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."stripe_subscriptions" validate constraint "stripe_subscriptions_clinic_id_fkey";

alter table "public"."stripe_subscriptions" add constraint "stripe_subscriptions_stripe_subscription_id_key" UNIQUE using index "stripe_subscriptions_stripe_subscription_id_key";

alter table "public"."stripe_subscriptions" add constraint "unique_clinic" UNIQUE using index "unique_clinic";

alter table "public"."tasks" add constraint "tasks_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_clinic_id_fkey";

alter table "public"."tasks" add constraint "tasks_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."tasks" validate constraint "tasks_priority_check";

alter table "public"."twilio_config" add constraint "twilio_config_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."twilio_config" validate constraint "twilio_config_clinic_id_fkey";

alter table "public"."twilio_config" add constraint "unique_clinic_phone" UNIQUE using index "unique_clinic_phone";

alter table "public"."user_clinic" add constraint "fk_uc_role" FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE not valid;

alter table "public"."user_clinic" validate constraint "fk_uc_role";

alter table "public"."lead" add constraint "lead_interest_level_check" CHECK (((interest_level)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))) not valid;

alter table "public"."lead" validate constraint "lead_interest_level_check";

alter table "public"."lead" add constraint "lead_urgency_check" CHECK (((urgency)::text = ANY ((ARRAY['asap'::character varying, 'this_month'::character varying, 'curious'::character varying])::text[]))) not valid;

alter table "public"."lead" validate constraint "lead_urgency_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_email_settings_with_vault(p_clinic_id uuid, p_smtp_host text DEFAULT 'smtp.gmail.com'::text, p_smtp_port integer DEFAULT 587, p_smtp_user text DEFAULT 'abdullah.salman@hashlogics.com'::text, p_smtp_sender_name text DEFAULT 'Algoricum'::text, p_smtp_sender_email text DEFAULT 'abdullah.salman@hashlogics.com'::text, p_smtp_use_tls boolean DEFAULT true, p_imap_server text DEFAULT 'imap.gmail.com'::text, p_imap_port integer DEFAULT 993, p_imap_user text DEFAULT 'abdullah.salman@hashlogics.com'::text, p_imap_use_ssl boolean DEFAULT true, p_imap_folder text DEFAULT 'INBOX'::text, p_check_frequency_minutes integer DEFAULT 5, p_sms_auto_reply_enabled boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_email_from_queue(queue_name text, msg_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result boolean;
BEGIN
  SELECT pgmq.delete(queue_name, msg_id) INTO result;
  RAISE NOTICE 'Deleted message % from queue %: %', msg_id, queue_name, result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error deleting message % from queue %: %', msg_id, queue_name, SQLERRM;
  RETURN false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_conversion_funnel(clinic uuid)
 RETURNS TABLE(source_name text, total_leads bigint, converted_leads bigint, conversion_rate numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    ls.name AS source_name,
    COUNT(l.id) AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'Converted'::lead_status) AS converted_leads,
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE l.status = 'Converted'::lead_status))::numeric
        / NULLIF(COUNT(l.id), 0) * 100
      , 2),
      0
    ) AS conversion_rate
  FROM public.lead l
  JOIN public.lead_source ls
    ON ls.id = l.source_id
  WHERE l.clinic_id = clinic
  GROUP BY ls.name
  ORDER BY conversion_rate DESC, total_leads DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_lead_metrics(p_clinic_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  weekly_booked_count integer;
  weekly_leads_count integer;
  weekly_engaged_count integer;
  weekly_closed_count integer;
  newly_created_leads_count integer;
  weekly_leads_per_source jsonb;
BEGIN
  -- Weekly booked count: leads updated to 'Booked' in the last 7 days
  SELECT COUNT(*) INTO weekly_booked_count
  FROM public.lead
  WHERE lead.clinic_id = p_clinic_id
  AND status = 'Booked'::lead_status
  AND updated_at >= now() - interval '7 days';

  -- Weekly leads count: leads created in the last 7 days
  SELECT COUNT(*) INTO weekly_leads_count
  FROM public.lead
  WHERE lead.clinic_id = p_clinic_id
  AND created_at >= now() - interval '7 days';

  -- Weekly engaged leads count: leads created in the last 7 days and status 'Engaged'
  SELECT COUNT(*) INTO weekly_engaged_count
  FROM public.lead
  WHERE lead.clinic_id = p_clinic_id
  AND created_at >= now() - interval '7 days'
  AND status = 'Engaged'::lead_status;

  -- Weekly closed count: leads updated to 'Closed' in the last 7 days
  SELECT COUNT(*) INTO weekly_closed_count
  FROM public.lead
  WHERE lead.clinic_id = p_clinic_id
  AND status = 'Cold'::lead_status
  AND updated_at >= now() - interval '7 days';

  -- Newly created leads count: leads created in the last 24 hours
  SELECT COUNT(*) INTO newly_created_leads_count
  FROM public.lead
  WHERE lead.clinic_id = p_clinic_id
  AND created_at >= now() - interval '24 hours';

  -- All leads count per lead source: all leads grouped by source
  SELECT jsonb_agg(jsonb_build_object('source_name', ls.name, 'count', cnt))
  INTO weekly_leads_per_source
  FROM (
    SELECT source_id, COUNT(*) as cnt
    FROM public.lead
    WHERE lead.clinic_id = p_clinic_id
    GROUP BY source_id
  ) l
  JOIN public.lead_source ls ON l.source_id = ls.id;

  -- Return JSON with headings as keys
  RETURN jsonb_build_object(
    'Weekly Booked Leads Count', weekly_booked_count,
    'Weekly New Leads Count', weekly_leads_count,
    'Weekly Engaged Leads Count', weekly_engaged_count,
    'Weekly Closed Leads Count', weekly_closed_count,
    'Newly Created Leads Count (Last 24 Hours)', newly_created_leads_count,
    'All Leads Count Per Source', coalesce(weekly_leads_per_source, '[]'::jsonb)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets 
  WHERE name = secret_name;
  
  RETURN secret_value;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_lead_converted_task()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_meeting_scheduled_task()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$declare
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
end;$function$
;

CREATE OR REPLACE FUNCTION public.read_email_from_queue(queue_name text, visibility_timeout integer DEFAULT 30)
 RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamp with time zone, vt timestamp with time zone, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Try different function variations
  RETURN QUERY SELECT * FROM pgmq.read(queue_name, visibility_timeout, 1); -- limit 1 message
EXCEPTION WHEN OTHERS THEN
  -- Fallback to simpler version
  RETURN QUERY SELECT * FROM pgmq.read(queue_name, visibility_timeout::bigint);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_email_to_queue(queue_name text, message jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, message);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_facebook_lead_form_connections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_google_lead_form_connections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
;

create policy "Authenticated users can manage form fields"
on "public"."clinic_lead_form"
as permissive
for all
to public
using ((auth.role() = 'authenticated'::text));


create policy "Users can manage emails for their clinics"
on "public"."emails"
as permissive
for all
to public
using ((clinic_id IN ( SELECT clinic.id
   FROM clinic
  WHERE (clinic.owner_id = auth.uid()))));


create policy "Users can create facebook lead form connections for their clini"
on "public"."facebook_lead_form_connections"
as permissive
for insert
to public
with check ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can delete facebook lead form connections for their clini"
on "public"."facebook_lead_form_connections"
as permissive
for delete
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can update facebook lead form connections for their clini"
on "public"."facebook_lead_form_connections"
as permissive
for update
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can view facebook lead form connections for their clinic"
on "public"."facebook_lead_form_connections"
as permissive
for select
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can create connections for their clinic"
on "public"."google_form_connections"
as permissive
for insert
to public
with check ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can delete connections for their clinic"
on "public"."google_form_connections"
as permissive
for delete
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can update connections for their clinic"
on "public"."google_form_connections"
as permissive
for update
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can view connections for their clinic"
on "public"."google_form_connections"
as permissive
for select
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can create lead form connections for their clinic"
on "public"."google_lead_form_connections"
as permissive
for insert
to public
with check ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can delete lead form connections for their clinic"
on "public"."google_lead_form_connections"
as permissive
for delete
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can update lead form connections for their clinic"
on "public"."google_lead_form_connections"
as permissive
for update
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "Users can view lead form connections for their clinic"
on "public"."google_lead_form_connections"
as permissive
for select
to public
using ((clinic_id IN ( SELECT c.id
   FROM clinic c
  WHERE (c.owner_id = auth.uid()))));


create policy "user_access"
on "public"."hubspot_connections"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can manage mailgun settings for their clinics"
on "public"."mailgun_settings"
as permissive
for all
to public
using ((clinic_id IN ( SELECT clinic.id
   FROM clinic
  WHERE (clinic.owner_id = auth.uid()))));


create policy "Users can insert pipedrive integration for their clinic"
on "public"."pipedrive_integration"
as permissive
for insert
to public
with check ((clinic_id IN ( SELECT clinic.id
   FROM clinic
  WHERE (clinic.owner_id = auth.uid()))));


create policy "Users can update their clinic's pipedrive integration"
on "public"."pipedrive_integration"
as permissive
for update
to public
using ((clinic_id IN ( SELECT clinic.id
   FROM clinic
  WHERE (clinic.owner_id = auth.uid()))));


create policy "Users can view their clinic's pipedrive integration"
on "public"."pipedrive_integration"
as permissive
for select
to public
using ((clinic_id IN ( SELECT clinic.id
   FROM clinic
  WHERE (clinic.owner_id = auth.uid()))));


CREATE TRIGGER update_clinic_lead_form_updated_at BEFORE UPDATE ON public.clinic_lead_form FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facebook_lead_form_connections_updated_at BEFORE UPDATE ON public.facebook_lead_form_connections FOR EACH ROW EXECUTE FUNCTION update_facebook_lead_form_connections_updated_at();

CREATE TRIGGER update_google_lead_form_connections_updated_at BEFORE UPDATE ON public.google_lead_form_connections FOR EACH ROW EXECUTE FUNCTION update_google_lead_form_connections_updated_at();

CREATE TRIGGER update_hubspot_connections_updated_at BEFORE UPDATE ON public.hubspot_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_lead_converted_task AFTER UPDATE ON public.lead FOR EACH ROW EXECUTE FUNCTION handle_lead_converted_task();

CREATE TRIGGER trigger_meeting_scheduled_task AFTER INSERT ON public.meeting_schedule FOR EACH ROW EXECUTE FUNCTION handle_meeting_scheduled_task();

CREATE TRIGGER update_twilio_config_updated_at BEFORE UPDATE ON public.twilio_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


