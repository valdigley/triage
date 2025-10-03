/*
  # Fix Policies to Accept Owner Role

  1. Changes
    - Update all policies to accept both 'admin' and 'owner' roles
    - Owner is the primary admin role for tenants
  
  2. Security
    - Maintain same security level
    - Accept owner or admin roles for administrative actions
*/

-- Fix triagem_coupons policies
DROP POLICY IF EXISTS "Admins can insert coupons" ON triagem_coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON triagem_coupons;
DROP POLICY IF EXISTS "Admins can delete coupons" ON triagem_coupons;

CREATE POLICY "Admins can insert coupons"
  ON triagem_coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update coupons"
  ON triagem_coupons
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete coupons"
  ON triagem_coupons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );

-- Fix triagem_pricing policies
DROP POLICY IF EXISTS "Admins can insert pricing" ON triagem_pricing;
DROP POLICY IF EXISTS "Admins can update pricing" ON triagem_pricing;
DROP POLICY IF EXISTS "Admins can delete pricing" ON triagem_pricing;

CREATE POLICY "Admins can insert pricing"
  ON triagem_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update pricing"
  ON triagem_pricing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete pricing"
  ON triagem_pricing
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role IN ('admin', 'owner')
    )
  );
