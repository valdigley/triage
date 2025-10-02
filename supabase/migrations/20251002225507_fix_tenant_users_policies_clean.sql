/*
  # Clean and recreate tenant_users policies
  
  Remove all policies and recreate with simple, non-recursive rules.
*/

-- Drop ALL possible policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "tenant_users_insert_own" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_select_own" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_master_admin_all" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_insert" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_select" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_update" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "tenant_users_delete" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "Users can create their own tenant_user record" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "Users can view their own tenant_user records" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "Tenant owners can manage their tenant users" ON triagem_tenant_users;
  DROP POLICY IF EXISTS "Master admin can manage all tenant users" ON triagem_tenant_users;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create simple policies
CREATE POLICY "allow_insert_own"
  ON triagem_tenant_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_select_own"
  ON triagem_tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "allow_update_own"
  ON triagem_tenant_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "allow_delete_own"
  ON triagem_tenant_users
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());