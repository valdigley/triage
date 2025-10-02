/*
  # Reverter renomeação das tabelas (rollback)

  1. Objetivo
    - Reverter todas as tabelas aos nomes originais
    - Restaurar o sistema ao estado funcional anterior

  2. Tabelas Revertidas
    - triagem_tenants → tenants
    - triagem_tenant_users → tenant_users
    - triagem_settings → settings
    - triagem_clients → clients
    - triagem_appointments → appointments
    - triagem_session_types → session_types
    - triagem_galleries → galleries
    - triagem_photos → photos
    - triagem_payments → payments
    - triagem_subscription_payments → subscription_payments
    - triagem_notification_templates → notification_templates
    - triagem_notification_queue → notification_queue
    - triagem_whatsapp_instances → whatsapp_instances
    - triagem_whatsapp_logs → whatsapp_logs
    - triagem_mercadopago_settings → mercadopago_settings
    - triagem_google_calendar_settings → google_calendar_settings
*/

-- Reverter tabelas aos nomes originais
ALTER TABLE IF EXISTS triagem_tenants RENAME TO tenants;
ALTER TABLE IF EXISTS triagem_tenant_users RENAME TO tenant_users;
ALTER TABLE IF EXISTS triagem_settings RENAME TO settings;
ALTER TABLE IF EXISTS triagem_session_types RENAME TO session_types;
ALTER TABLE IF EXISTS triagem_clients RENAME TO clients;
ALTER TABLE IF EXISTS triagem_appointments RENAME TO appointments;
ALTER TABLE IF EXISTS triagem_galleries RENAME TO galleries;
ALTER TABLE IF EXISTS triagem_photos RENAME TO photos;
ALTER TABLE IF EXISTS triagem_payments RENAME TO payments;
ALTER TABLE IF EXISTS triagem_subscription_payments RENAME TO subscription_payments;
ALTER TABLE IF EXISTS triagem_notification_templates RENAME TO notification_templates;
ALTER TABLE IF EXISTS triagem_notification_queue RENAME TO notification_queue;
ALTER TABLE IF EXISTS triagem_whatsapp_instances RENAME TO whatsapp_instances;
ALTER TABLE IF EXISTS triagem_whatsapp_logs RENAME TO whatsapp_logs;
ALTER TABLE IF EXISTS triagem_mercadopago_settings RENAME TO mercadopago_settings;
ALTER TABLE IF EXISTS triagem_google_calendar_settings RENAME TO google_calendar_settings;

-- Reverter sequences
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_tenants_id_seq') THEN
    ALTER SEQUENCE triagem_tenants_id_seq RENAME TO tenants_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_tenant_users_id_seq') THEN
    ALTER SEQUENCE triagem_tenant_users_id_seq RENAME TO tenant_users_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_settings_id_seq') THEN
    ALTER SEQUENCE triagem_settings_id_seq RENAME TO settings_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_session_types_id_seq') THEN
    ALTER SEQUENCE triagem_session_types_id_seq RENAME TO session_types_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_clients_id_seq') THEN
    ALTER SEQUENCE triagem_clients_id_seq RENAME TO clients_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_appointments_id_seq') THEN
    ALTER SEQUENCE triagem_appointments_id_seq RENAME TO appointments_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_galleries_id_seq') THEN
    ALTER SEQUENCE triagem_galleries_id_seq RENAME TO galleries_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_photos_id_seq') THEN
    ALTER SEQUENCE triagem_photos_id_seq RENAME TO photos_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_payments_id_seq') THEN
    ALTER SEQUENCE triagem_payments_id_seq RENAME TO payments_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_subscription_payments_id_seq') THEN
    ALTER SEQUENCE triagem_subscription_payments_id_seq RENAME TO subscription_payments_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_notification_templates_id_seq') THEN
    ALTER SEQUENCE triagem_notification_templates_id_seq RENAME TO notification_templates_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_notification_queue_id_seq') THEN
    ALTER SEQUENCE triagem_notification_queue_id_seq RENAME TO notification_queue_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_whatsapp_instances_id_seq') THEN
    ALTER SEQUENCE triagem_whatsapp_instances_id_seq RENAME TO whatsapp_instances_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_whatsapp_logs_id_seq') THEN
    ALTER SEQUENCE triagem_whatsapp_logs_id_seq RENAME TO whatsapp_logs_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_mercadopago_settings_id_seq') THEN
    ALTER SEQUENCE triagem_mercadopago_settings_id_seq RENAME TO mercadopago_settings_id_seq;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'triagem_google_calendar_settings_id_seq') THEN
    ALTER SEQUENCE triagem_google_calendar_settings_id_seq RENAME TO google_calendar_settings_id_seq;
  END IF;
END $$;
