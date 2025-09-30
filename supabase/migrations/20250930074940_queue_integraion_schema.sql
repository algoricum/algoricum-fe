alter table "public"."lead" drop constraint "unique_lead_email_per_clinic";

drop function if exists "public"."get_clinic_integrations_with_status"(clinic_uuid uuid);

drop index if exists "public"."unique_lead_email_per_clinic";

alter table "public"."integrations" drop column "description";

alter table "public"."integrations" drop column "integration_logo";

CREATE UNIQUE INDEX unique_lead_email ON public.lead USING btree (email);

alter table "public"."lead" add constraint "unique_lead_email" UNIQUE using index "unique_lead_email";

grant delete on table "public"."clinic_lead_form" to "anon";

grant insert on table "public"."clinic_lead_form" to "anon";

grant references on table "public"."clinic_lead_form" to "anon";

grant select on table "public"."clinic_lead_form" to "anon";

grant trigger on table "public"."clinic_lead_form" to "anon";

grant truncate on table "public"."clinic_lead_form" to "anon";

grant update on table "public"."clinic_lead_form" to "anon";

grant delete on table "public"."clinic_lead_form" to "authenticated";

grant insert on table "public"."clinic_lead_form" to "authenticated";

grant references on table "public"."clinic_lead_form" to "authenticated";

grant select on table "public"."clinic_lead_form" to "authenticated";

grant trigger on table "public"."clinic_lead_form" to "authenticated";

grant truncate on table "public"."clinic_lead_form" to "authenticated";

grant update on table "public"."clinic_lead_form" to "authenticated";

grant delete on table "public"."clinic_lead_form" to "service_role";

grant insert on table "public"."clinic_lead_form" to "service_role";

grant references on table "public"."clinic_lead_form" to "service_role";

grant select on table "public"."clinic_lead_form" to "service_role";

grant trigger on table "public"."clinic_lead_form" to "service_role";

grant truncate on table "public"."clinic_lead_form" to "service_role";

grant update on table "public"."clinic_lead_form" to "service_role";

grant delete on table "public"."emails" to "anon";

grant insert on table "public"."emails" to "anon";

grant references on table "public"."emails" to "anon";

grant select on table "public"."emails" to "anon";

grant trigger on table "public"."emails" to "anon";

grant truncate on table "public"."emails" to "anon";

grant update on table "public"."emails" to "anon";

grant delete on table "public"."emails" to "authenticated";

grant insert on table "public"."emails" to "authenticated";

grant references on table "public"."emails" to "authenticated";

grant select on table "public"."emails" to "authenticated";

grant trigger on table "public"."emails" to "authenticated";

grant truncate on table "public"."emails" to "authenticated";

grant update on table "public"."emails" to "authenticated";

grant delete on table "public"."emails" to "service_role";

grant insert on table "public"."emails" to "service_role";

grant references on table "public"."emails" to "service_role";

grant select on table "public"."emails" to "service_role";

grant trigger on table "public"."emails" to "service_role";

grant truncate on table "public"."emails" to "service_role";

grant update on table "public"."emails" to "service_role";

grant delete on table "public"."facebook_lead_form_connections" to "anon";

grant insert on table "public"."facebook_lead_form_connections" to "anon";

grant references on table "public"."facebook_lead_form_connections" to "anon";

grant select on table "public"."facebook_lead_form_connections" to "anon";

grant trigger on table "public"."facebook_lead_form_connections" to "anon";

grant truncate on table "public"."facebook_lead_form_connections" to "anon";

grant update on table "public"."facebook_lead_form_connections" to "anon";

grant delete on table "public"."facebook_lead_form_connections" to "authenticated";

grant insert on table "public"."facebook_lead_form_connections" to "authenticated";

grant references on table "public"."facebook_lead_form_connections" to "authenticated";

grant select on table "public"."facebook_lead_form_connections" to "authenticated";

grant trigger on table "public"."facebook_lead_form_connections" to "authenticated";

grant truncate on table "public"."facebook_lead_form_connections" to "authenticated";

grant update on table "public"."facebook_lead_form_connections" to "authenticated";

grant delete on table "public"."facebook_lead_form_connections" to "service_role";

grant insert on table "public"."facebook_lead_form_connections" to "service_role";

grant references on table "public"."facebook_lead_form_connections" to "service_role";

grant select on table "public"."facebook_lead_form_connections" to "service_role";

grant trigger on table "public"."facebook_lead_form_connections" to "service_role";

grant truncate on table "public"."facebook_lead_form_connections" to "service_role";

grant update on table "public"."facebook_lead_form_connections" to "service_role";

grant delete on table "public"."google_form_connections" to "anon";

grant insert on table "public"."google_form_connections" to "anon";

grant references on table "public"."google_form_connections" to "anon";

grant select on table "public"."google_form_connections" to "anon";

grant trigger on table "public"."google_form_connections" to "anon";

grant truncate on table "public"."google_form_connections" to "anon";

grant update on table "public"."google_form_connections" to "anon";

grant delete on table "public"."google_form_connections" to "authenticated";

grant insert on table "public"."google_form_connections" to "authenticated";

grant references on table "public"."google_form_connections" to "authenticated";

grant select on table "public"."google_form_connections" to "authenticated";

grant trigger on table "public"."google_form_connections" to "authenticated";

grant truncate on table "public"."google_form_connections" to "authenticated";

grant update on table "public"."google_form_connections" to "authenticated";

grant delete on table "public"."google_form_connections" to "service_role";

grant insert on table "public"."google_form_connections" to "service_role";

grant references on table "public"."google_form_connections" to "service_role";

grant select on table "public"."google_form_connections" to "service_role";

grant trigger on table "public"."google_form_connections" to "service_role";

grant truncate on table "public"."google_form_connections" to "service_role";

grant update on table "public"."google_form_connections" to "service_role";

grant delete on table "public"."google_form_sheets" to "anon";

grant insert on table "public"."google_form_sheets" to "anon";

grant references on table "public"."google_form_sheets" to "anon";

grant select on table "public"."google_form_sheets" to "anon";

grant trigger on table "public"."google_form_sheets" to "anon";

grant truncate on table "public"."google_form_sheets" to "anon";

grant update on table "public"."google_form_sheets" to "anon";

grant delete on table "public"."google_form_sheets" to "authenticated";

grant insert on table "public"."google_form_sheets" to "authenticated";

grant references on table "public"."google_form_sheets" to "authenticated";

grant select on table "public"."google_form_sheets" to "authenticated";

grant trigger on table "public"."google_form_sheets" to "authenticated";

grant truncate on table "public"."google_form_sheets" to "authenticated";

grant update on table "public"."google_form_sheets" to "authenticated";

grant delete on table "public"."google_form_sheets" to "service_role";

grant insert on table "public"."google_form_sheets" to "service_role";

grant references on table "public"."google_form_sheets" to "service_role";

grant select on table "public"."google_form_sheets" to "service_role";

grant trigger on table "public"."google_form_sheets" to "service_role";

grant truncate on table "public"."google_form_sheets" to "service_role";

grant update on table "public"."google_form_sheets" to "service_role";

grant delete on table "public"."google_lead_form_connections" to "anon";

grant insert on table "public"."google_lead_form_connections" to "anon";

grant references on table "public"."google_lead_form_connections" to "anon";

grant select on table "public"."google_lead_form_connections" to "anon";

grant trigger on table "public"."google_lead_form_connections" to "anon";

grant truncate on table "public"."google_lead_form_connections" to "anon";

grant update on table "public"."google_lead_form_connections" to "anon";

grant delete on table "public"."google_lead_form_connections" to "authenticated";

grant insert on table "public"."google_lead_form_connections" to "authenticated";

grant references on table "public"."google_lead_form_connections" to "authenticated";

grant select on table "public"."google_lead_form_connections" to "authenticated";

grant trigger on table "public"."google_lead_form_connections" to "authenticated";

grant truncate on table "public"."google_lead_form_connections" to "authenticated";

grant update on table "public"."google_lead_form_connections" to "authenticated";

grant delete on table "public"."google_lead_form_connections" to "service_role";

grant insert on table "public"."google_lead_form_connections" to "service_role";

grant references on table "public"."google_lead_form_connections" to "service_role";

grant select on table "public"."google_lead_form_connections" to "service_role";

grant trigger on table "public"."google_lead_form_connections" to "service_role";

grant truncate on table "public"."google_lead_form_connections" to "service_role";

grant update on table "public"."google_lead_form_connections" to "service_role";

grant delete on table "public"."hubspot_connections" to "anon";

grant insert on table "public"."hubspot_connections" to "anon";

grant references on table "public"."hubspot_connections" to "anon";

grant select on table "public"."hubspot_connections" to "anon";

grant trigger on table "public"."hubspot_connections" to "anon";

grant truncate on table "public"."hubspot_connections" to "anon";

grant update on table "public"."hubspot_connections" to "anon";

grant delete on table "public"."hubspot_connections" to "authenticated";

grant insert on table "public"."hubspot_connections" to "authenticated";

grant references on table "public"."hubspot_connections" to "authenticated";

grant select on table "public"."hubspot_connections" to "authenticated";

grant trigger on table "public"."hubspot_connections" to "authenticated";

grant truncate on table "public"."hubspot_connections" to "authenticated";

grant update on table "public"."hubspot_connections" to "authenticated";

grant delete on table "public"."hubspot_connections" to "service_role";

grant insert on table "public"."hubspot_connections" to "service_role";

grant references on table "public"."hubspot_connections" to "service_role";

grant select on table "public"."hubspot_connections" to "service_role";

grant trigger on table "public"."hubspot_connections" to "service_role";

grant truncate on table "public"."hubspot_connections" to "service_role";

grant update on table "public"."hubspot_connections" to "service_role";

grant delete on table "public"."integration_connections" to "anon";

grant insert on table "public"."integration_connections" to "anon";

grant references on table "public"."integration_connections" to "anon";

grant select on table "public"."integration_connections" to "anon";

grant trigger on table "public"."integration_connections" to "anon";

grant truncate on table "public"."integration_connections" to "anon";

grant update on table "public"."integration_connections" to "anon";

grant delete on table "public"."integration_connections" to "authenticated";

grant insert on table "public"."integration_connections" to "authenticated";

grant references on table "public"."integration_connections" to "authenticated";

grant select on table "public"."integration_connections" to "authenticated";

grant trigger on table "public"."integration_connections" to "authenticated";

grant truncate on table "public"."integration_connections" to "authenticated";

grant update on table "public"."integration_connections" to "authenticated";

grant delete on table "public"."integration_connections" to "service_role";

grant insert on table "public"."integration_connections" to "service_role";

grant references on table "public"."integration_connections" to "service_role";

grant select on table "public"."integration_connections" to "service_role";

grant trigger on table "public"."integration_connections" to "service_role";

grant truncate on table "public"."integration_connections" to "service_role";

grant update on table "public"."integration_connections" to "service_role";

grant delete on table "public"."integrations" to "anon";

grant insert on table "public"."integrations" to "anon";

grant references on table "public"."integrations" to "anon";

grant select on table "public"."integrations" to "anon";

grant trigger on table "public"."integrations" to "anon";

grant truncate on table "public"."integrations" to "anon";

grant update on table "public"."integrations" to "anon";

grant delete on table "public"."integrations" to "authenticated";

grant insert on table "public"."integrations" to "authenticated";

grant references on table "public"."integrations" to "authenticated";

grant select on table "public"."integrations" to "authenticated";

grant trigger on table "public"."integrations" to "authenticated";

grant truncate on table "public"."integrations" to "authenticated";

grant update on table "public"."integrations" to "authenticated";

grant delete on table "public"."integrations" to "service_role";

grant insert on table "public"."integrations" to "service_role";

grant references on table "public"."integrations" to "service_role";

grant select on table "public"."integrations" to "service_role";

grant trigger on table "public"."integrations" to "service_role";

grant truncate on table "public"."integrations" to "service_role";

grant update on table "public"."integrations" to "service_role";

grant delete on table "public"."mailgun_settings" to "anon";

grant insert on table "public"."mailgun_settings" to "anon";

grant references on table "public"."mailgun_settings" to "anon";

grant select on table "public"."mailgun_settings" to "anon";

grant trigger on table "public"."mailgun_settings" to "anon";

grant truncate on table "public"."mailgun_settings" to "anon";

grant update on table "public"."mailgun_settings" to "anon";

grant delete on table "public"."mailgun_settings" to "authenticated";

grant insert on table "public"."mailgun_settings" to "authenticated";

grant references on table "public"."mailgun_settings" to "authenticated";

grant select on table "public"."mailgun_settings" to "authenticated";

grant trigger on table "public"."mailgun_settings" to "authenticated";

grant truncate on table "public"."mailgun_settings" to "authenticated";

grant update on table "public"."mailgun_settings" to "authenticated";

grant delete on table "public"."mailgun_settings" to "service_role";

grant insert on table "public"."mailgun_settings" to "service_role";

grant references on table "public"."mailgun_settings" to "service_role";

grant select on table "public"."mailgun_settings" to "service_role";

grant trigger on table "public"."mailgun_settings" to "service_role";

grant truncate on table "public"."mailgun_settings" to "service_role";

grant update on table "public"."mailgun_settings" to "service_role";

grant delete on table "public"."meeting_schedule" to "anon";

grant insert on table "public"."meeting_schedule" to "anon";

grant references on table "public"."meeting_schedule" to "anon";

grant select on table "public"."meeting_schedule" to "anon";

grant trigger on table "public"."meeting_schedule" to "anon";

grant truncate on table "public"."meeting_schedule" to "anon";

grant update on table "public"."meeting_schedule" to "anon";

grant delete on table "public"."meeting_schedule" to "authenticated";

grant insert on table "public"."meeting_schedule" to "authenticated";

grant references on table "public"."meeting_schedule" to "authenticated";

grant select on table "public"."meeting_schedule" to "authenticated";

grant trigger on table "public"."meeting_schedule" to "authenticated";

grant truncate on table "public"."meeting_schedule" to "authenticated";

grant update on table "public"."meeting_schedule" to "authenticated";

grant delete on table "public"."meeting_schedule" to "service_role";

grant insert on table "public"."meeting_schedule" to "service_role";

grant references on table "public"."meeting_schedule" to "service_role";

grant select on table "public"."meeting_schedule" to "service_role";

grant trigger on table "public"."meeting_schedule" to "service_role";

grant truncate on table "public"."meeting_schedule" to "service_role";

grant update on table "public"."meeting_schedule" to "service_role";

grant delete on table "public"."pipedrive_integration" to "anon";

grant insert on table "public"."pipedrive_integration" to "anon";

grant references on table "public"."pipedrive_integration" to "anon";

grant select on table "public"."pipedrive_integration" to "anon";

grant trigger on table "public"."pipedrive_integration" to "anon";

grant truncate on table "public"."pipedrive_integration" to "anon";

grant update on table "public"."pipedrive_integration" to "anon";

grant delete on table "public"."pipedrive_integration" to "authenticated";

grant insert on table "public"."pipedrive_integration" to "authenticated";

grant references on table "public"."pipedrive_integration" to "authenticated";

grant select on table "public"."pipedrive_integration" to "authenticated";

grant trigger on table "public"."pipedrive_integration" to "authenticated";

grant truncate on table "public"."pipedrive_integration" to "authenticated";

grant update on table "public"."pipedrive_integration" to "authenticated";

grant delete on table "public"."pipedrive_integration" to "service_role";

grant insert on table "public"."pipedrive_integration" to "service_role";

grant references on table "public"."pipedrive_integration" to "service_role";

grant select on table "public"."pipedrive_integration" to "service_role";

grant trigger on table "public"."pipedrive_integration" to "service_role";

grant truncate on table "public"."pipedrive_integration" to "service_role";

grant update on table "public"."pipedrive_integration" to "service_role";

grant delete on table "public"."plans" to "anon";

grant insert on table "public"."plans" to "anon";

grant references on table "public"."plans" to "anon";

grant select on table "public"."plans" to "anon";

grant trigger on table "public"."plans" to "anon";

grant truncate on table "public"."plans" to "anon";

grant update on table "public"."plans" to "anon";

grant delete on table "public"."plans" to "authenticated";

grant insert on table "public"."plans" to "authenticated";

grant references on table "public"."plans" to "authenticated";

grant select on table "public"."plans" to "authenticated";

grant trigger on table "public"."plans" to "authenticated";

grant truncate on table "public"."plans" to "authenticated";

grant update on table "public"."plans" to "authenticated";

grant delete on table "public"."plans" to "service_role";

grant insert on table "public"."plans" to "service_role";

grant references on table "public"."plans" to "service_role";

grant select on table "public"."plans" to "service_role";

grant trigger on table "public"."plans" to "service_role";

grant truncate on table "public"."plans" to "service_role";

grant update on table "public"."plans" to "service_role";

grant delete on table "public"."role" to "anon";

grant insert on table "public"."role" to "anon";

grant references on table "public"."role" to "anon";

grant select on table "public"."role" to "anon";

grant trigger on table "public"."role" to "anon";

grant truncate on table "public"."role" to "anon";

grant update on table "public"."role" to "anon";

grant delete on table "public"."role" to "authenticated";

grant insert on table "public"."role" to "authenticated";

grant references on table "public"."role" to "authenticated";

grant select on table "public"."role" to "authenticated";

grant trigger on table "public"."role" to "authenticated";

grant truncate on table "public"."role" to "authenticated";

grant update on table "public"."role" to "authenticated";

grant delete on table "public"."role" to "service_role";

grant insert on table "public"."role" to "service_role";

grant references on table "public"."role" to "service_role";

grant select on table "public"."role" to "service_role";

grant trigger on table "public"."role" to "service_role";

grant truncate on table "public"."role" to "service_role";

grant update on table "public"."role" to "service_role";

grant delete on table "public"."stripe_events" to "anon";

grant insert on table "public"."stripe_events" to "anon";

grant references on table "public"."stripe_events" to "anon";

grant select on table "public"."stripe_events" to "anon";

grant trigger on table "public"."stripe_events" to "anon";

grant truncate on table "public"."stripe_events" to "anon";

grant update on table "public"."stripe_events" to "anon";

grant delete on table "public"."stripe_events" to "authenticated";

grant insert on table "public"."stripe_events" to "authenticated";

grant references on table "public"."stripe_events" to "authenticated";

grant select on table "public"."stripe_events" to "authenticated";

grant trigger on table "public"."stripe_events" to "authenticated";

grant truncate on table "public"."stripe_events" to "authenticated";

grant update on table "public"."stripe_events" to "authenticated";

grant delete on table "public"."stripe_events" to "service_role";

grant insert on table "public"."stripe_events" to "service_role";

grant references on table "public"."stripe_events" to "service_role";

grant select on table "public"."stripe_events" to "service_role";

grant trigger on table "public"."stripe_events" to "service_role";

grant truncate on table "public"."stripe_events" to "service_role";

grant update on table "public"."stripe_events" to "service_role";

grant delete on table "public"."stripe_subscriptions" to "anon";

grant insert on table "public"."stripe_subscriptions" to "anon";

grant references on table "public"."stripe_subscriptions" to "anon";

grant select on table "public"."stripe_subscriptions" to "anon";

grant trigger on table "public"."stripe_subscriptions" to "anon";

grant truncate on table "public"."stripe_subscriptions" to "anon";

grant update on table "public"."stripe_subscriptions" to "anon";

grant delete on table "public"."stripe_subscriptions" to "authenticated";

grant insert on table "public"."stripe_subscriptions" to "authenticated";

grant references on table "public"."stripe_subscriptions" to "authenticated";

grant select on table "public"."stripe_subscriptions" to "authenticated";

grant trigger on table "public"."stripe_subscriptions" to "authenticated";

grant truncate on table "public"."stripe_subscriptions" to "authenticated";

grant update on table "public"."stripe_subscriptions" to "authenticated";

grant delete on table "public"."stripe_subscriptions" to "service_role";

grant insert on table "public"."stripe_subscriptions" to "service_role";

grant references on table "public"."stripe_subscriptions" to "service_role";

grant select on table "public"."stripe_subscriptions" to "service_role";

grant trigger on table "public"."stripe_subscriptions" to "service_role";

grant truncate on table "public"."stripe_subscriptions" to "service_role";

grant update on table "public"."stripe_subscriptions" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."twilio_config" to "anon";

grant insert on table "public"."twilio_config" to "anon";

grant references on table "public"."twilio_config" to "anon";

grant select on table "public"."twilio_config" to "anon";

grant trigger on table "public"."twilio_config" to "anon";

grant truncate on table "public"."twilio_config" to "anon";

grant update on table "public"."twilio_config" to "anon";

grant delete on table "public"."twilio_config" to "authenticated";

grant insert on table "public"."twilio_config" to "authenticated";

grant references on table "public"."twilio_config" to "authenticated";

grant select on table "public"."twilio_config" to "authenticated";

grant trigger on table "public"."twilio_config" to "authenticated";

grant truncate on table "public"."twilio_config" to "authenticated";

grant update on table "public"."twilio_config" to "authenticated";

grant delete on table "public"."twilio_config" to "service_role";

grant insert on table "public"."twilio_config" to "service_role";

grant references on table "public"."twilio_config" to "service_role";

grant select on table "public"."twilio_config" to "service_role";

grant trigger on table "public"."twilio_config" to "service_role";

grant truncate on table "public"."twilio_config" to "service_role";

grant update on table "public"."twilio_config" to "service_role";


