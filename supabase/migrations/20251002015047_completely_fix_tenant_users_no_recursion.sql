/*
  # Completely Fix tenant_users RLS - No Recursion

  Remove ALL policies from tenant_users and create the simplest possible policies
  that do NOT depend on any other tables.

  ## Changes
  - Drop ALL existing policies on tenant_users
  - Create only 2 simple policies:
    1. Users can view their own record (user_id = auth.uid())
    2. Master admin can view all (checks only auth.users)
  - NO policies that check tenants table (prevents recursion)
*/

-- Drop ALL policies
DROP POLICY IF EXISTS "Users can view own tenant user" ON tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage users" ON tenant_users;
DROP POLICY IF EXISTS "Master admin can view all tenant users" ON tenant_users;
DROP POLICY IF EXISTS "Users can view same tenant users" ON tenant_users;

-- Policy 1: Users can view their own tenant_users record
CREATE POLICY "Users view own record"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Master admin can view all
CREATE POLICY "Master admin views all"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND users.email = 'valdigley2007@gmail.com'
    )
  );

-- Policy 3: Master admin can insert
CREATE POLICY "Master admin inserts"
  ON tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND users.email = 'valdigley2007@gmail.com'
    )
  );

-- Policy 4: Master admin can update
CREATE POLICY "Master admin updates"
  ON tenant_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND users.email = 'valdigley2007@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND users.email = 'valdigley2007@gmail.com'
    )
  );

-- Policy 5: Master admin can delete
CREATE POLICY "Master admin deletes"
  ON tenant_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND users.email = 'valdigley2007@gmail.com'
    )
  );