/*
  # Remove get_current_tenant_id() from All Policies

  This migration removes the use of get_current_tenant_id() from all RLS policies
  to prevent infinite recursion. Instead, we use direct subqueries.

  ## Changes
  - Drop and recreate all policies without using get_current_tenant_id()
  - Use direct subqueries to tenant_users table
  - Maintain same security logic but without recursion risk
*/

-- Helper: Get tenant_id subquery pattern
-- (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)

-- ============================================================================
-- CLIENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON clients;
CREATE POLICY "Users can view clients in their tenant"
  ON clients FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert clients in their tenant" ON clients;
CREATE POLICY "Users can insert clients in their tenant"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update clients in their tenant" ON clients;
CREATE POLICY "Users can update clients in their tenant"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can delete clients in their tenant" ON clients;
CREATE POLICY "Users can delete clients in their tenant"
  ON clients FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

-- ============================================================================
-- APPOINTMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view appointments in their tenant" ON appointments;
CREATE POLICY "Users can view appointments in their tenant"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert appointments in their tenant" ON appointments;
CREATE POLICY "Users can insert appointments in their tenant"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update appointments in their tenant" ON appointments;
CREATE POLICY "Users can update appointments in their tenant"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can delete appointments in their tenant" ON appointments;
CREATE POLICY "Users can delete appointments in their tenant"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

-- ============================================================================
-- GALLERIES_TRIAGE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view galleries in their tenant" ON galleries_triage;
CREATE POLICY "Users can view galleries in their tenant"
  ON galleries_triage FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert galleries in their tenant" ON galleries_triage;
CREATE POLICY "Users can insert galleries in their tenant"
  ON galleries_triage FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update galleries in their tenant" ON galleries_triage;
CREATE POLICY "Users can update galleries in their tenant"
  ON galleries_triage FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can delete galleries in their tenant" ON galleries_triage;
CREATE POLICY "Users can delete galleries in their tenant"
  ON galleries_triage FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

-- ============================================================================
-- PHOTOS_TRIAGE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view photos in their tenant" ON photos_triage;
CREATE POLICY "Users can view photos in their tenant"
  ON photos_triage FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert photos in their tenant" ON photos_triage;
CREATE POLICY "Users can insert photos in their tenant"
  ON photos_triage FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update photos in their tenant" ON photos_triage;
CREATE POLICY "Users can update photos in their tenant"
  ON photos_triage FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can delete photos in their tenant" ON photos_triage;
CREATE POLICY "Users can delete photos in their tenant"
  ON photos_triage FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

-- ============================================================================
-- PAYMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view payments in their tenant" ON payments;
CREATE POLICY "Users can view payments in their tenant"
  ON payments FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert payments in their tenant" ON payments;
CREATE POLICY "Users can insert payments in their tenant"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update payments in their tenant" ON payments;
CREATE POLICY "Users can update payments in their tenant"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can delete payments in their tenant" ON payments;
CREATE POLICY "Users can delete payments in their tenant"
  ON payments FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

-- ============================================================================
-- SETTINGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view settings in their tenant" ON settings;
CREATE POLICY "Users can view settings in their tenant"
  ON settings FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert settings in their tenant" ON settings;
CREATE POLICY "Users can insert settings in their tenant"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) 
     AND has_active_subscription(tenant_id))
  );

DROP POLICY IF EXISTS "Users can update settings in their tenant" ON settings;
CREATE POLICY "Users can update settings in their tenant"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

-- ============================================================================
-- TENANTS POLICIES (for master admin)
-- ============================================================================
DROP POLICY IF EXISTS "Master admin can view all tenants" ON tenants;
CREATE POLICY "Master admin can view all tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;
CREATE POLICY "Users can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) AND
    owner_user_id = auth.uid()
  )
  WITH CHECK (
    id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1) AND
    owner_user_id = auth.uid()
  );

-- ============================================================================
-- SUBSCRIPTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view subscriptions in their tenant" ON subscriptions;
CREATE POLICY "Users can view subscriptions in their tenant"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can insert subscriptions for their tenant" ON subscriptions;
CREATE POLICY "Users can insert subscriptions for their tenant"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

-- ============================================================================
-- SUBSCRIPTION_PAYMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view subscription payments for their tenant" ON subscription_payments;
CREATE POLICY "Users can view subscription payments for their tenant"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can create subscription payments for their tenant" ON subscription_payments;
CREATE POLICY "Users can create subscription payments for their tenant"
  ON subscription_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );