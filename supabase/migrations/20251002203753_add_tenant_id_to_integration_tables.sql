/*
  # Add tenant_id to Integration Tables

  This migration adds tenant_id columns to all integration tables to ensure
  proper tenant isolation for MercadoPago, Google Calendar, and WhatsApp settings.

  ## Changes
  1. Add tenant_id column to mercadopago_settings
  2. Add tenant_id column to google_calendar_settings
  3. Add tenant_id column to whatsapp_instances
  4. Add foreign key constraints
  5. Create RLS policies for tenant isolation
  6. Migrate existing data to admin tenant
*/

-- ============================================================================
-- STEP 1: Add tenant_id columns
-- ============================================================================

-- Add tenant_id to mercadopago_settings
ALTER TABLE mercadopago_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to google_calendar_settings
ALTER TABLE google_calendar_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to whatsapp_instances
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Migrate existing data to tenants
-- ============================================================================

-- Assign all existing mercadopago_settings to their respective tenant
-- First check if there are any records
DO $$
DECLARE
  admin_tenant_id UUID;
  valdigley_tenant_id UUID;
BEGIN
  -- Get tenant IDs
  SELECT id INTO admin_tenant_id FROM tenants WHERE email = 'contato.dartes@gmail.com' LIMIT 1;
  SELECT id INTO valdigley_tenant_id FROM tenants WHERE email = 'valdigley2007@gmail.com' LIMIT 1;
  
  -- Update mercadopago_settings
  IF EXISTS (SELECT 1 FROM mercadopago_settings WHERE tenant_id IS NULL) THEN
    -- If only one exists, assign to valdigley (master admin)
    UPDATE mercadopago_settings 
    SET tenant_id = valdigley_tenant_id 
    WHERE tenant_id IS NULL;
  END IF;

  -- Update google_calendar_settings
  IF EXISTS (SELECT 1 FROM google_calendar_settings WHERE tenant_id IS NULL) THEN
    UPDATE google_calendar_settings 
    SET tenant_id = valdigley_tenant_id 
    WHERE tenant_id IS NULL;
  END IF;

  -- Update whatsapp_instances
  IF EXISTS (SELECT 1 FROM whatsapp_instances WHERE tenant_id IS NULL) THEN
    UPDATE whatsapp_instances 
    SET tenant_id = valdigley_tenant_id 
    WHERE tenant_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Make tenant_id NOT NULL after migration
-- ============================================================================

ALTER TABLE mercadopago_settings 
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE google_calendar_settings 
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE whatsapp_instances 
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mercadopago_settings_tenant_id 
ON mercadopago_settings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_settings_tenant_id 
ON google_calendar_settings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_id 
ON whatsapp_instances(tenant_id);

-- ============================================================================
-- STEP 5: Enable RLS
-- ============================================================================

ALTER TABLE mercadopago_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies for mercadopago_settings
-- ============================================================================

CREATE POLICY "mercadopago_settings_select"
  ON mercadopago_settings FOR SELECT
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "mercadopago_settings_insert"
  ON mercadopago_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "mercadopago_settings_update"
  ON mercadopago_settings FOR UPDATE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "mercadopago_settings_delete"
  ON mercadopago_settings FOR DELETE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

-- ============================================================================
-- STEP 7: Create RLS policies for google_calendar_settings
-- ============================================================================

CREATE POLICY "google_calendar_settings_select"
  ON google_calendar_settings FOR SELECT
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "google_calendar_settings_insert"
  ON google_calendar_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "google_calendar_settings_update"
  ON google_calendar_settings FOR UPDATE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "google_calendar_settings_delete"
  ON google_calendar_settings FOR DELETE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

-- ============================================================================
-- STEP 8: Create RLS policies for whatsapp_instances
-- ============================================================================

CREATE POLICY "whatsapp_instances_select"
  ON whatsapp_instances FOR SELECT
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "whatsapp_instances_insert"
  ON whatsapp_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "whatsapp_instances_update"
  ON whatsapp_instances FOR UPDATE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "whatsapp_instances_delete"
  ON whatsapp_instances FOR DELETE
  TO authenticated
  USING (
    is_master_admin()
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );