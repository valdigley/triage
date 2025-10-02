/*
  # Fix tenant_users insert policy for registration
  
  Adiciona policy que permite usuários autenticados criarem seu próprio registro
  de tenant_user durante o processo de registro.
*/

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Tenant owners can manage tenant users" ON triagem_tenant_users;

-- Allow authenticated users to insert themselves as tenant users during registration
CREATE POLICY "Users can create their own tenant_user record"
  ON triagem_tenant_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to view their own tenant_user records
CREATE POLICY "Users can view their own tenant_user records"
  ON triagem_tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow tenant owners to manage all users in their tenant
CREATE POLICY "Tenant owners can manage their tenant users"
  ON triagem_tenant_users
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM triagem_tenants WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM triagem_tenants WHERE owner_user_id = auth.uid()
    )
  );

-- Allow master admin to manage all tenant users
CREATE POLICY "Master admin can manage all tenant users"
  ON triagem_tenant_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'valdigley2007@gmail.com'
    )
  );