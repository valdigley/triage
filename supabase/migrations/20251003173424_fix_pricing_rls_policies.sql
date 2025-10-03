/*
  # Fix RLS Policies for triagem_pricing

  1. Changes
    - Drop existing policies that use complex subqueries
    - Create simpler policies that allow authenticated users to read active pricing
    - Keep admin-only write permissions using tenant_users table instead of auth.users
  
  2. Security
    - All authenticated users can read active pricing (needed for subscription page)
    - Only users with admin role in tenant_users can manage pricing
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Todos podem ver preços ativos" ON triagem_pricing;
DROP POLICY IF EXISTS "Apenas master admin pode gerenciar preços" ON triagem_pricing;

-- Allow all authenticated users to read active pricing
CREATE POLICY "Authenticated users can view active pricing"
  ON triagem_pricing
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins to manage pricing (using tenant_users table)
CREATE POLICY "Admins can manage pricing"
  ON triagem_pricing
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
