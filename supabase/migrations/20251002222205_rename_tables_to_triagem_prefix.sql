/*
  # Renomear Tabelas com Prefixo triagem_
  
  Este migration renomeia todas as tabelas do sistema com o prefixo "triagem_"
  para facilitar a identificação e organização em projetos com múltiplas funcionalidades.
  
  ## Alterações
  
  ### Tabelas Renomeadas:
  1. settings → triagem_settings
  2. clients → triagem_clients
  3. appointments → triagem_appointments
  4. payments → triagem_payments
  5. session_types → triagem_session_types
  6. galleries_triage → triagem_galleries
  7. photos_triage → triagem_photos
  8. whatsapp_instances → triagem_whatsapp_instances
  9. mercadopago_settings → triagem_mercadopago_settings
  10. notification_templates → triagem_notification_templates
  11. notification_queue → triagem_notification_queue
  12. google_calendar_settings → triagem_google_calendar_settings
  13. user_sessions → triagem_user_sessions
  14. tenants → triagem_tenants
  15. subscriptions → triagem_subscriptions
  16. subscription_payments → triagem_subscription_payments
  17. tenant_users → triagem_tenant_users
  
  ## Segurança
  - Todas as constraints, indices, triggers e policies RLS são preservados
  - Todas as foreign keys são automaticamente atualizadas pelo PostgreSQL
  - Nenhum dado é perdido ou modificado
*/

-- ============================================================================
-- RENOMEAR TABELAS (ordem respeitando dependências)
-- ============================================================================

-- Primeiro renomear tabelas base (sem dependências)
ALTER TABLE IF EXISTS tenants RENAME TO triagem_tenants;
ALTER TABLE IF EXISTS settings RENAME TO triagem_settings;
ALTER TABLE IF EXISTS clients RENAME TO triagem_clients;
ALTER TABLE IF EXISTS session_types RENAME TO triagem_session_types;
ALTER TABLE IF EXISTS whatsapp_instances RENAME TO triagem_whatsapp_instances;
ALTER TABLE IF EXISTS mercadopago_settings RENAME TO triagem_mercadopago_settings;
ALTER TABLE IF EXISTS google_calendar_settings RENAME TO triagem_google_calendar_settings;
ALTER TABLE IF EXISTS notification_templates RENAME TO triagem_notification_templates;
ALTER TABLE IF EXISTS user_sessions RENAME TO triagem_user_sessions;

-- Tabelas que dependem de triagem_tenants
ALTER TABLE IF EXISTS subscriptions RENAME TO triagem_subscriptions;
ALTER TABLE IF EXISTS subscription_payments RENAME TO triagem_subscription_payments;
ALTER TABLE IF EXISTS tenant_users RENAME TO triagem_tenant_users;

-- Tabelas que dependem de triagem_clients
ALTER TABLE IF EXISTS appointments RENAME TO triagem_appointments;

-- Tabelas que dependem de triagem_appointments
ALTER TABLE IF EXISTS payments RENAME TO triagem_payments;
ALTER TABLE IF EXISTS galleries_triage RENAME TO triagem_galleries;
ALTER TABLE IF EXISTS notification_queue RENAME TO triagem_notification_queue;

-- Tabelas que dependem de triagem_galleries
ALTER TABLE IF EXISTS photos_triage RENAME TO triagem_photos;

-- ============================================================================
-- RENOMEAR ÍNDICES
-- ============================================================================

-- Índices de triagem_tenants
ALTER INDEX IF EXISTS idx_tenants_owner_user_id RENAME TO idx_triagem_tenants_owner_user_id;
ALTER INDEX IF EXISTS idx_tenants_email RENAME TO idx_triagem_tenants_email;
ALTER INDEX IF EXISTS idx_tenants_status RENAME TO idx_triagem_tenants_status;

-- Índices de triagem_subscriptions
ALTER INDEX IF EXISTS idx_subscriptions_tenant_id RENAME TO idx_triagem_subscriptions_tenant_id;
ALTER INDEX IF EXISTS idx_subscriptions_status RENAME TO idx_triagem_subscriptions_status;

-- Índices de triagem_subscription_payments
ALTER INDEX IF EXISTS idx_subscription_payments_tenant_id RENAME TO idx_triagem_subscription_payments_tenant_id;

-- Índices de triagem_tenant_users
ALTER INDEX IF EXISTS idx_tenant_users_tenant_id RENAME TO idx_triagem_tenant_users_tenant_id;
ALTER INDEX IF EXISTS idx_tenant_users_user_id RENAME TO idx_triagem_tenant_users_user_id;

-- Índices de triagem_clients
ALTER INDEX IF EXISTS idx_clients_phone RENAME TO idx_triagem_clients_phone;
ALTER INDEX IF EXISTS idx_clients_tenant_id RENAME TO idx_triagem_clients_tenant_id;

-- Índices de triagem_appointments
ALTER INDEX IF EXISTS idx_appointments_scheduled_date RENAME TO idx_triagem_appointments_scheduled_date;
ALTER INDEX IF EXISTS idx_appointments_status RENAME TO idx_triagem_appointments_status;
ALTER INDEX IF EXISTS idx_appointments_client_id RENAME TO idx_triagem_appointments_client_id;
ALTER INDEX IF EXISTS idx_appointments_tenant_id RENAME TO idx_triagem_appointments_tenant_id;

-- Índices de triagem_payments
ALTER INDEX IF EXISTS idx_payments_appointment_id RENAME TO idx_triagem_payments_appointment_id;
ALTER INDEX IF EXISTS idx_payments_status RENAME TO idx_triagem_payments_status;
ALTER INDEX IF EXISTS idx_payments_tenant_id RENAME TO idx_triagem_payments_tenant_id;

-- Índices de triagem_settings
ALTER INDEX IF EXISTS idx_settings_tenant_id RENAME TO idx_triagem_settings_tenant_id;

-- Índices de triagem_galleries
ALTER INDEX IF EXISTS idx_galleries_triage_appointment_id RENAME TO idx_triagem_galleries_appointment_id;
ALTER INDEX IF EXISTS idx_galleries_triage_token RENAME TO idx_triagem_galleries_token;
ALTER INDEX IF EXISTS idx_galleries_triage_status RENAME TO idx_triagem_galleries_status;
ALTER INDEX IF EXISTS idx_galleries_triage_expires RENAME TO idx_triagem_galleries_expires;
ALTER INDEX IF EXISTS idx_galleries_triage_tenant_id RENAME TO idx_triagem_galleries_tenant_id;

-- Índices de triagem_photos
ALTER INDEX IF EXISTS idx_photos_triage_gallery_id RENAME TO idx_triagem_photos_gallery_id;
ALTER INDEX IF EXISTS idx_photos_triage_selected RENAME TO idx_triagem_photos_selected;
ALTER INDEX IF EXISTS idx_photos_triage_upload_date RENAME TO idx_triagem_photos_upload_date;
ALTER INDEX IF EXISTS idx_photos_triage_tenant_id RENAME TO idx_triagem_photos_tenant_id;

-- Índices de triagem_mercadopago_settings
ALTER INDEX IF EXISTS idx_mercadopago_settings_tenant_id RENAME TO idx_triagem_mercadopago_settings_tenant_id;

-- Índices de triagem_google_calendar_settings
ALTER INDEX IF EXISTS idx_google_calendar_settings_tenant_id RENAME TO idx_triagem_google_calendar_settings_tenant_id;

-- Índices de triagem_whatsapp_instances
ALTER INDEX IF EXISTS idx_whatsapp_instances_tenant_id RENAME TO idx_triagem_whatsapp_instances_tenant_id;

-- ============================================================================
-- RENOMEAR TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_settings_updated_at ON triagem_settings;
CREATE TRIGGER update_triagem_settings_updated_at 
  BEFORE UPDATE ON triagem_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON triagem_clients;
CREATE TRIGGER update_triagem_clients_updated_at 
  BEFORE UPDATE ON triagem_clients 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON triagem_appointments;
CREATE TRIGGER update_triagem_appointments_updated_at 
  BEFORE UPDATE ON triagem_appointments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON triagem_payments;
CREATE TRIGGER update_triagem_payments_updated_at 
  BEFORE UPDATE ON triagem_payments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_galleries_triage_updated_at ON triagem_galleries;
CREATE TRIGGER update_triagem_galleries_updated_at 
  BEFORE UPDATE ON triagem_galleries 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RECRIAR FUNÇÃO get_current_tenant_id para usar nova tabela
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id 
  FROM triagem_tenant_users 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- RECRIAR FUNÇÃO has_active_subscription para usar nova tabela
-- ============================================================================

CREATE OR REPLACE FUNCTION has_active_subscription(tenant_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM triagem_tenants t
    LEFT JOIN triagem_subscriptions s ON s.tenant_id = t.id AND s.status = 'active' AND s.expires_at > now()
    WHERE t.id = tenant_uuid
    AND (
      (t.status = 'trial' AND t.trial_ends_at > now()) OR
      (t.status = 'active' AND s.id IS NOT NULL)
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER;