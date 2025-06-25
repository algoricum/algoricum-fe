create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";


create type "public"."app_permission" as enum ('clinics.create', 'clinics.read', 'clinics.update', 'clinics.delete', 'staff.create', 'staff.read', 'staff.update', 'staff.delete', 'leads.create', 'leads.read', 'leads.update', 'leads.delete', 'messages.create', 'messages.read', 'messages.update', 'messages.delete', 'settings.read', 'settings.update', 'analytics.read');

create type "public"."app_role" as enum ('super_admin', 'clinic_admin', 'clinic_staff');

create table "public"."api_key" (
    "id" uuid not null default auth.uid(),
    "name" character varying not null,
    "api_key" character varying not null,
    "key_expires_at" timestamp without time zone not null,
    "last_used_at" timestamp without time zone,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "clinic_id" uuid not null
);


create table "public"."assistant_files" (
    "id" uuid not null default uuid_generate_v4(),
    "assistant_id" uuid not null,
    "openai_file_id" text not null,
    "file_name" text not null,
    "purpose" text not null default 'assistants'::text,
    "created_at" timestamp with time zone default now()
);


create table "public"."assistants" (
    "id" uuid not null default uuid_generate_v4(),
    "clinic_id" uuid not null,
    "openai_assistant_id" text not null,
    "assistant_name" text not null,
    "assistant_description" text,
    "model" text not null default 'gpt-4'::text,
    "instructions" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."clinic" (
    "id" uuid not null default auth.uid(),
    "name" character varying not null,
    "address" character varying,
    "phone" character varying,
    "email" character varying,
    "language" character varying not null,
    "owner_id" uuid not null,
    "widget_theme" jsonb,
    "domain" character varying,
    "logo" character varying,
    "dashboard_theme" jsonb,
    "openai_api_key" character varying(255),
    "assistant_prompt" text,
    "assistant_model" character varying(100),
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "widget_logo" character varying,
    "legal_business_name" character varying,
    "dba_name" character varying,
    "business_hours" jsonb,
    "calendly_link" character varying,
    "tone_selector" character varying,
    "sentence_length" character varying,
    "formality_level" character varying,
    "chatbot_name" character varying,
    "chatbot_avatar" character varying
);


create table "public"."conversation" (
    "id" uuid not null default gen_random_uuid(),
    "thread_id" uuid not null,
    "message" text not null,
    "timestamp" timestamp without time zone not null,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "is_from_user" boolean default true,
    "sender_type" character varying default 'user'::character varying,
    "email_message_id" character varying
);


create table "public"."email_settings" (
    "id" uuid not null default uuid_generate_v4(),
    "clinic_id" uuid not null,
    "smtp_host" character varying,
    "smtp_port" integer default 587,
    "smtp_user" character varying,
    "smtp_password" character varying,
    "smtp_sender_name" character varying,
    "smtp_sender_email" character varying,
    "smtp_use_tls" boolean default true,
    "imap_server" character varying,
    "imap_port" integer default 995,
    "imap_user" character varying,
    "imap_password" character varying,
    "imap_use_ssl" boolean default true,
    "last_email_check" timestamp with time zone,
    "auto_reply_enabled" boolean default true,
    "check_frequency_minutes" integer default 5,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "imap_folder" character varying(100) default 'INBOX'::character varying,
    "last_processed_uid" integer default 0
);


create table "public"."lead" (
    "id" uuid not null default gen_random_uuid(),
    "first_name" character varying,
    "last_name" character varying,
    "email" character varying,
    "phone" character varying,
    "status" character varying not null,
    "source_id" uuid not null,
    "clinic_id" uuid not null,
    "assigned_to" uuid,
    "notes" text,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "interest_level" character varying(10),
    "urgency" character varying(15)
);


create table "public"."lead_source" (
    "id" uuid not null default auth.uid(),
    "name" character varying not null,
    "description" text,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


create table "public"."threads" (
    "id" uuid not null default gen_random_uuid(),
    "lead_id" uuid,
    "clinic_id" uuid not null,
    "status" character varying not null,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "openai_thread_id" text,
    "channel" character varying default 'widget'::character varying,
    "email_subject" character varying,
    "email_from" character varying,
    "email_to" character varying
);


create table "public"."user" (
    "id" uuid not null default auth.uid(),
    "name" character varying not null,
    "email" character varying not null,
    "is_email_verified" boolean default false,
    "otp" character varying,
    "otp_expires_at" timestamp without time zone,
    "is_super_admin" boolean default false,
    "updated_at" timestamp without time zone not null default now(),
    "created_at" timestamp without time zone not null default now(),
    "user_id" uuid
);


create table "public"."user_clinic" (
    "id" uuid not null default auth.uid(),
    "user_id" uuid not null,
    "clinic_id" uuid not null,
    "role" character varying not null,
    "position" character varying,
    "is_active" boolean default true,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


CREATE UNIQUE INDEX api_key_pkey ON public.api_key USING btree (id);

CREATE UNIQUE INDEX assistant_files_pkey ON public.assistant_files USING btree (id);

CREATE UNIQUE INDEX assistants_pkey ON public.assistants USING btree (id);

CREATE UNIQUE INDEX clinic_pkey ON public.clinic USING btree (id);

CREATE UNIQUE INDEX conversation_pkey ON public.conversation USING btree (id);

CREATE UNIQUE INDEX email_settings_clinic_id_key ON public.email_settings USING btree (clinic_id);

CREATE UNIQUE INDEX email_settings_pkey ON public.email_settings USING btree (id);

CREATE INDEX idx_assistant_files_assistant_id ON public.assistant_files USING btree (assistant_id);

CREATE INDEX idx_assistants_clinic_id ON public.assistants USING btree (clinic_id);

CREATE INDEX idx_thread_openai_thread_id ON public.threads USING btree (openai_thread_id);

CREATE UNIQUE INDEX lead_pkey ON public.lead USING btree (id);

CREATE UNIQUE INDEX lead_source_pkey ON public.lead_source USING btree (id);

CREATE UNIQUE INDEX threads_pkey ON public.threads USING btree (id);

CREATE UNIQUE INDEX unique_user_clinic ON public.user_clinic USING btree (user_id, clinic_id);

CREATE UNIQUE INDEX user_clinic_pkey ON public.user_clinic USING btree (id);

CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email);

CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id);

alter table "public"."api_key" add constraint "api_key_pkey" PRIMARY KEY using index "api_key_pkey";

alter table "public"."assistant_files" add constraint "assistant_files_pkey" PRIMARY KEY using index "assistant_files_pkey";

alter table "public"."assistants" add constraint "assistants_pkey" PRIMARY KEY using index "assistants_pkey";

alter table "public"."clinic" add constraint "clinic_pkey" PRIMARY KEY using index "clinic_pkey";

alter table "public"."conversation" add constraint "conversation_pkey" PRIMARY KEY using index "conversation_pkey";

alter table "public"."email_settings" add constraint "email_settings_pkey" PRIMARY KEY using index "email_settings_pkey";

alter table "public"."lead" add constraint "lead_pkey" PRIMARY KEY using index "lead_pkey";

alter table "public"."lead_source" add constraint "lead_source_pkey" PRIMARY KEY using index "lead_source_pkey";

alter table "public"."threads" add constraint "threads_pkey" PRIMARY KEY using index "threads_pkey";

alter table "public"."user" add constraint "user_pkey" PRIMARY KEY using index "user_pkey";

alter table "public"."user_clinic" add constraint "user_clinic_pkey" PRIMARY KEY using index "user_clinic_pkey";

alter table "public"."api_key" add constraint "fk_api_key_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."api_key" validate constraint "fk_api_key_clinic";

alter table "public"."assistant_files" add constraint "assistant_files_assistant_id_fkey" FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE not valid;

alter table "public"."assistant_files" validate constraint "assistant_files_assistant_id_fkey";

alter table "public"."assistants" add constraint "assistants_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."assistants" validate constraint "assistants_clinic_id_fkey";

alter table "public"."clinic" add constraint "fk_clinic_owner" FOREIGN KEY (owner_id) REFERENCES "user"(id) ON DELETE CASCADE not valid;

alter table "public"."clinic" validate constraint "fk_clinic_owner";

alter table "public"."conversation" add constraint "fk_conversation_thread" FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE not valid;

alter table "public"."conversation" validate constraint "fk_conversation_thread";

alter table "public"."email_settings" add constraint "email_settings_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."email_settings" validate constraint "email_settings_clinic_id_fkey";

alter table "public"."email_settings" add constraint "email_settings_clinic_id_key" UNIQUE using index "email_settings_clinic_id_key";

alter table "public"."lead" add constraint "fk_lead_assigned_to" FOREIGN KEY (assigned_to) REFERENCES "user"(id) ON DELETE SET NULL not valid;

alter table "public"."lead" validate constraint "fk_lead_assigned_to";

alter table "public"."lead" add constraint "fk_lead_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."lead" validate constraint "fk_lead_clinic";

alter table "public"."lead" add constraint "fk_lead_source" FOREIGN KEY (source_id) REFERENCES lead_source(id) ON DELETE RESTRICT not valid;

alter table "public"."lead" validate constraint "fk_lead_source";

alter table "public"."lead" add constraint "lead_interest_level_check" CHECK (((interest_level)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))) not valid;

alter table "public"."lead" validate constraint "lead_interest_level_check";

alter table "public"."lead" add constraint "lead_status_check" CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'responded'::character varying, 'needs-follow-up'::character varying, 'in-nurture'::character varying, 'cold'::character varying, 'reactivated'::character varying, 'booked'::character varying, 'confirmed'::character varying, 'no-show'::character varying, 'converted'::character varying, 'not-interested'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."lead" validate constraint "lead_status_check";

alter table "public"."lead" add constraint "lead_urgency_check" CHECK (((urgency)::text = ANY ((ARRAY['asap'::character varying, 'this_month'::character varying, 'curious'::character varying])::text[]))) not valid;

alter table "public"."lead" validate constraint "lead_urgency_check";

alter table "public"."threads" add constraint "fk_threads_lead" FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE not valid;

alter table "public"."threads" validate constraint "fk_threads_lead";

alter table "public"."user" add constraint "user_email_key" UNIQUE using index "user_email_key";

alter table "public"."user" add constraint "user_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user" validate constraint "user_user_id_fkey";

alter table "public"."user_clinic" add constraint "fk_uc_clinic" FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE not valid;

alter table "public"."user_clinic" validate constraint "fk_uc_clinic";

alter table "public"."user_clinic" add constraint "fk_uc_user" FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE not valid;

alter table "public"."user_clinic" validate constraint "fk_uc_user";

alter table "public"."user_clinic" add constraint "unique_user_clinic" UNIQUE using index "unique_user_clinic";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

grant delete on table "public"."api_key" to "anon";

grant insert on table "public"."api_key" to "anon";

grant references on table "public"."api_key" to "anon";

grant select on table "public"."api_key" to "anon";

grant trigger on table "public"."api_key" to "anon";

grant truncate on table "public"."api_key" to "anon";

grant update on table "public"."api_key" to "anon";

grant delete on table "public"."api_key" to "authenticated";

grant insert on table "public"."api_key" to "authenticated";

grant references on table "public"."api_key" to "authenticated";

grant select on table "public"."api_key" to "authenticated";

grant trigger on table "public"."api_key" to "authenticated";

grant truncate on table "public"."api_key" to "authenticated";

grant update on table "public"."api_key" to "authenticated";

grant delete on table "public"."api_key" to "service_role";

grant insert on table "public"."api_key" to "service_role";

grant references on table "public"."api_key" to "service_role";

grant select on table "public"."api_key" to "service_role";

grant trigger on table "public"."api_key" to "service_role";

grant truncate on table "public"."api_key" to "service_role";

grant update on table "public"."api_key" to "service_role";

grant delete on table "public"."assistant_files" to "anon";

grant insert on table "public"."assistant_files" to "anon";

grant references on table "public"."assistant_files" to "anon";

grant select on table "public"."assistant_files" to "anon";

grant trigger on table "public"."assistant_files" to "anon";

grant truncate on table "public"."assistant_files" to "anon";

grant update on table "public"."assistant_files" to "anon";

grant delete on table "public"."assistant_files" to "authenticated";

grant insert on table "public"."assistant_files" to "authenticated";

grant references on table "public"."assistant_files" to "authenticated";

grant select on table "public"."assistant_files" to "authenticated";

grant trigger on table "public"."assistant_files" to "authenticated";

grant truncate on table "public"."assistant_files" to "authenticated";

grant update on table "public"."assistant_files" to "authenticated";

grant delete on table "public"."assistant_files" to "service_role";

grant insert on table "public"."assistant_files" to "service_role";

grant references on table "public"."assistant_files" to "service_role";

grant select on table "public"."assistant_files" to "service_role";

grant trigger on table "public"."assistant_files" to "service_role";

grant truncate on table "public"."assistant_files" to "service_role";

grant update on table "public"."assistant_files" to "service_role";

grant delete on table "public"."assistants" to "anon";

grant insert on table "public"."assistants" to "anon";

grant references on table "public"."assistants" to "anon";

grant select on table "public"."assistants" to "anon";

grant trigger on table "public"."assistants" to "anon";

grant truncate on table "public"."assistants" to "anon";

grant update on table "public"."assistants" to "anon";

grant delete on table "public"."assistants" to "authenticated";

grant insert on table "public"."assistants" to "authenticated";

grant references on table "public"."assistants" to "authenticated";

grant select on table "public"."assistants" to "authenticated";

grant trigger on table "public"."assistants" to "authenticated";

grant truncate on table "public"."assistants" to "authenticated";

grant update on table "public"."assistants" to "authenticated";

grant delete on table "public"."assistants" to "service_role";

grant insert on table "public"."assistants" to "service_role";

grant references on table "public"."assistants" to "service_role";

grant select on table "public"."assistants" to "service_role";

grant trigger on table "public"."assistants" to "service_role";

grant truncate on table "public"."assistants" to "service_role";

grant update on table "public"."assistants" to "service_role";

grant delete on table "public"."clinic" to "anon";

grant insert on table "public"."clinic" to "anon";

grant references on table "public"."clinic" to "anon";

grant select on table "public"."clinic" to "anon";

grant trigger on table "public"."clinic" to "anon";

grant truncate on table "public"."clinic" to "anon";

grant update on table "public"."clinic" to "anon";

grant delete on table "public"."clinic" to "authenticated";

grant insert on table "public"."clinic" to "authenticated";

grant references on table "public"."clinic" to "authenticated";

grant select on table "public"."clinic" to "authenticated";

grant trigger on table "public"."clinic" to "authenticated";

grant truncate on table "public"."clinic" to "authenticated";

grant update on table "public"."clinic" to "authenticated";

grant delete on table "public"."clinic" to "service_role";

grant insert on table "public"."clinic" to "service_role";

grant references on table "public"."clinic" to "service_role";

grant select on table "public"."clinic" to "service_role";

grant trigger on table "public"."clinic" to "service_role";

grant truncate on table "public"."clinic" to "service_role";

grant update on table "public"."clinic" to "service_role";

grant delete on table "public"."conversation" to "anon";

grant insert on table "public"."conversation" to "anon";

grant references on table "public"."conversation" to "anon";

grant select on table "public"."conversation" to "anon";

grant trigger on table "public"."conversation" to "anon";

grant truncate on table "public"."conversation" to "anon";

grant update on table "public"."conversation" to "anon";

grant delete on table "public"."conversation" to "authenticated";

grant insert on table "public"."conversation" to "authenticated";

grant references on table "public"."conversation" to "authenticated";

grant select on table "public"."conversation" to "authenticated";

grant trigger on table "public"."conversation" to "authenticated";

grant truncate on table "public"."conversation" to "authenticated";

grant update on table "public"."conversation" to "authenticated";

grant delete on table "public"."conversation" to "service_role";

grant insert on table "public"."conversation" to "service_role";

grant references on table "public"."conversation" to "service_role";

grant select on table "public"."conversation" to "service_role";

grant trigger on table "public"."conversation" to "service_role";

grant truncate on table "public"."conversation" to "service_role";

grant update on table "public"."conversation" to "service_role";

grant delete on table "public"."email_settings" to "anon";

grant insert on table "public"."email_settings" to "anon";

grant references on table "public"."email_settings" to "anon";

grant select on table "public"."email_settings" to "anon";

grant trigger on table "public"."email_settings" to "anon";

grant truncate on table "public"."email_settings" to "anon";

grant update on table "public"."email_settings" to "anon";

grant delete on table "public"."email_settings" to "authenticated";

grant insert on table "public"."email_settings" to "authenticated";

grant references on table "public"."email_settings" to "authenticated";

grant select on table "public"."email_settings" to "authenticated";

grant trigger on table "public"."email_settings" to "authenticated";

grant truncate on table "public"."email_settings" to "authenticated";

grant update on table "public"."email_settings" to "authenticated";

grant delete on table "public"."email_settings" to "service_role";

grant insert on table "public"."email_settings" to "service_role";

grant references on table "public"."email_settings" to "service_role";

grant select on table "public"."email_settings" to "service_role";

grant trigger on table "public"."email_settings" to "service_role";

grant truncate on table "public"."email_settings" to "service_role";

grant update on table "public"."email_settings" to "service_role";

grant delete on table "public"."lead" to "anon";

grant insert on table "public"."lead" to "anon";

grant references on table "public"."lead" to "anon";

grant select on table "public"."lead" to "anon";

grant trigger on table "public"."lead" to "anon";

grant truncate on table "public"."lead" to "anon";

grant update on table "public"."lead" to "anon";

grant delete on table "public"."lead" to "authenticated";

grant insert on table "public"."lead" to "authenticated";

grant references on table "public"."lead" to "authenticated";

grant select on table "public"."lead" to "authenticated";

grant trigger on table "public"."lead" to "authenticated";

grant truncate on table "public"."lead" to "authenticated";

grant update on table "public"."lead" to "authenticated";

grant delete on table "public"."lead" to "service_role";

grant insert on table "public"."lead" to "service_role";

grant references on table "public"."lead" to "service_role";

grant select on table "public"."lead" to "service_role";

grant trigger on table "public"."lead" to "service_role";

grant truncate on table "public"."lead" to "service_role";

grant update on table "public"."lead" to "service_role";

grant delete on table "public"."lead_source" to "anon";

grant insert on table "public"."lead_source" to "anon";

grant references on table "public"."lead_source" to "anon";

grant select on table "public"."lead_source" to "anon";

grant trigger on table "public"."lead_source" to "anon";

grant truncate on table "public"."lead_source" to "anon";

grant update on table "public"."lead_source" to "anon";

grant delete on table "public"."lead_source" to "authenticated";

grant insert on table "public"."lead_source" to "authenticated";

grant references on table "public"."lead_source" to "authenticated";

grant select on table "public"."lead_source" to "authenticated";

grant trigger on table "public"."lead_source" to "authenticated";

grant truncate on table "public"."lead_source" to "authenticated";

grant update on table "public"."lead_source" to "authenticated";

grant delete on table "public"."lead_source" to "service_role";

grant insert on table "public"."lead_source" to "service_role";

grant references on table "public"."lead_source" to "service_role";

grant select on table "public"."lead_source" to "service_role";

grant trigger on table "public"."lead_source" to "service_role";

grant truncate on table "public"."lead_source" to "service_role";

grant update on table "public"."lead_source" to "service_role";

grant delete on table "public"."threads" to "anon";

grant insert on table "public"."threads" to "anon";

grant references on table "public"."threads" to "anon";

grant select on table "public"."threads" to "anon";

grant trigger on table "public"."threads" to "anon";

grant truncate on table "public"."threads" to "anon";

grant update on table "public"."threads" to "anon";

grant delete on table "public"."threads" to "authenticated";

grant insert on table "public"."threads" to "authenticated";

grant references on table "public"."threads" to "authenticated";

grant select on table "public"."threads" to "authenticated";

grant trigger on table "public"."threads" to "authenticated";

grant truncate on table "public"."threads" to "authenticated";

grant update on table "public"."threads" to "authenticated";

grant delete on table "public"."threads" to "service_role";

grant insert on table "public"."threads" to "service_role";

grant references on table "public"."threads" to "service_role";

grant select on table "public"."threads" to "service_role";

grant trigger on table "public"."threads" to "service_role";

grant truncate on table "public"."threads" to "service_role";

grant update on table "public"."threads" to "service_role";

grant delete on table "public"."user" to "anon";

grant insert on table "public"."user" to "anon";

grant references on table "public"."user" to "anon";

grant select on table "public"."user" to "anon";

grant trigger on table "public"."user" to "anon";

grant truncate on table "public"."user" to "anon";

grant update on table "public"."user" to "anon";

grant delete on table "public"."user" to "authenticated";

grant insert on table "public"."user" to "authenticated";

grant references on table "public"."user" to "authenticated";

grant select on table "public"."user" to "authenticated";

grant trigger on table "public"."user" to "authenticated";

grant truncate on table "public"."user" to "authenticated";

grant update on table "public"."user" to "authenticated";

grant delete on table "public"."user" to "service_role";

grant insert on table "public"."user" to "service_role";

grant references on table "public"."user" to "service_role";

grant select on table "public"."user" to "service_role";

grant trigger on table "public"."user" to "service_role";

grant truncate on table "public"."user" to "service_role";

grant update on table "public"."user" to "service_role";

grant delete on table "public"."user_clinic" to "anon";

grant insert on table "public"."user_clinic" to "anon";

grant references on table "public"."user_clinic" to "anon";

grant select on table "public"."user_clinic" to "anon";

grant trigger on table "public"."user_clinic" to "anon";

grant truncate on table "public"."user_clinic" to "anon";

grant update on table "public"."user_clinic" to "anon";

grant delete on table "public"."user_clinic" to "authenticated";

grant insert on table "public"."user_clinic" to "authenticated";

grant references on table "public"."user_clinic" to "authenticated";

grant select on table "public"."user_clinic" to "authenticated";

grant trigger on table "public"."user_clinic" to "authenticated";

grant truncate on table "public"."user_clinic" to "authenticated";

grant update on table "public"."user_clinic" to "authenticated";

grant delete on table "public"."user_clinic" to "service_role";

grant insert on table "public"."user_clinic" to "service_role";

grant references on table "public"."user_clinic" to "service_role";

grant select on table "public"."user_clinic" to "service_role";

grant trigger on table "public"."user_clinic" to "service_role";

grant truncate on table "public"."user_clinic" to "service_role";

grant update on table "public"."user_clinic" to "service_role";


