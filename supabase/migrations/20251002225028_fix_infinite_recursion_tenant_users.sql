/*
  # Fix infinite recursion in tenant_users policies
  
  Remove todas as policies existentes e recria sem causar recursão.
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can create their own tenant_user record" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Users can view their own tenant_user records" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage their tenant users" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Master admin can manage all tenant users" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Master admin can view all tenant users" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Users can view their tenant users" ON triagem_tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage tenant users" ON triagem_tenant_users;

-- Simple policy: users can insert their own records
CREATE POLICY "tenant_users_insert_own"
  ON triagem_tenant_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Simple policy: users can select their own records
CREATE POLICY "tenant_users_select_own"
  ON triagem_tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Master admin can do everything
CREATE POLICY "tenant_users_master_admin_all"
  ON triagem_tenant_users
  FOR ALL
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'valdigley2007@gmail.com'
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'valdigley2007@gmail.com'
  );