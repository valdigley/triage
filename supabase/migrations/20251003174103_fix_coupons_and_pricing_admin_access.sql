/*
  # Fix Admin Access for Global Resources

  1. Changes
    - Update policies for triagem_coupons and triagem_pricing
    - Allow any user with admin role in any tenant to manage these global resources
    - Simplify the policies to avoid complex joins
  
  2. Security
    - All authenticated users can read coupons and pricing (for validation and display)
    - Only users with admin role can create/update/delete
*/

-- Fix triagem_coupons policies
DROP POLICY IF EXISTS "Admins can manage coupons" ON triagem_coupons;
DROP POLICY IF EXISTS "Authenticated users can view coupons" ON triagem_coupons;

-- Allow all authenticated users to read coupons
CREATE POLICY "Anyone can view coupons"
  ON triagem_coupons
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert coupons
CREATE POLICY "Admins can insert coupons"
  ON triagem_coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );

-- Allow admins to update coupons
CREATE POLICY "Admins can update coupons"
  ON triagem_coupons
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );

-- Allow admins to delete coupons
CREATE POLICY "Admins can delete coupons"
  ON triagem_coupons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );

-- Fix triagem_pricing policies
DROP POLICY IF EXISTS "Admins can manage pricing" ON triagem_pricing;
DROP POLICY IF EXISTS "Authenticated users can view active pricing" ON triagem_pricing;

-- Allow all authenticated users to read active pricing
CREATE POLICY "Anyone can view active pricing"
  ON triagem_pricing
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins to insert pricing
CREATE POLICY "Admins can insert pricing"
  ON triagem_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );

-- Allow admins to update pricing
CREATE POLICY "Admins can update pricing"
  ON triagem_pricing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );

-- Allow admins to delete pricing
CREATE POLICY "Admins can delete pricing"
  ON triagem_pricing
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users
      WHERE triagem_tenant_users.user_id = auth.uid()
      AND triagem_tenant_users.role = 'admin'
    )
  );
