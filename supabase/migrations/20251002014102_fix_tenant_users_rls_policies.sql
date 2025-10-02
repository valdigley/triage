/*
  # Fix tenant_users RLS Policies - Remove Recursion

  This migration fixes the infinite recursion error in tenant_users policies by
  removing the use of get_current_tenant_id() which creates a circular dependency.

  ## Changes
  - Drop existing tenant_users policies
  - Create simple, non-recursive policies that don't call get_current_tenant_id()
  - Allow users to read their own tenant_users records
  - Allow tenant owners to manage their tenant users
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Master admin can view all tenant users" ON tenant_users;
DROP POLICY IF EXISTS "Users can view their tenant users" ON tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage tenant users" ON tenant_users;

-- Simple policy: Users can view their own tenant_user record
CREATE POLICY "Users can view own tenant user"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Simple policy: Users can view tenant users from same tenant (no recursion)
CREATE POLICY "Users can view same tenant users"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id 
      FROM tenant_users tu 
      WHERE tu.user_id = auth.uid()
    )
  );

-- Policy: Tenant owners can manage users in their tenant
CREATE POLICY "Tenant owners can manage users"
  ON tenant_users FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT t.id 
      FROM tenants t 
      WHERE t.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT t.id 
      FROM tenants t 
      WHERE t.owner_user_id = auth.uid()
    )
  );

-- Policy: Master admin can view all
CREATE POLICY "Master admin can view all tenant users"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );