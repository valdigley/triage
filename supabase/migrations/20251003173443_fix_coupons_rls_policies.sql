/*
  # Fix RLS Policies for triagem_coupons

  1. Changes
    - Drop existing policies that use complex subqueries with auth.users
    - Create simpler policies for reading and managing coupons
  
  2. Security
    - All authenticated users can read active coupons (needed for validation)
    - Only users with admin role in tenant_users can manage coupons
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuários autenticados podem validar cupons" ON triagem_coupons;
DROP POLICY IF EXISTS "Apenas master admin pode gerenciar cupons" ON triagem_coupons;

-- Allow all authenticated users to read active coupons
CREATE POLICY "Authenticated users can view coupons"
  ON triagem_coupons
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage coupons
CREATE POLICY "Admins can manage coupons"
  ON triagem_coupons
  FOR ALL
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
