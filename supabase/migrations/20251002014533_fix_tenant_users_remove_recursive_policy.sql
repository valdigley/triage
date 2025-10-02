/*
  # Fix tenant_users - Remove Recursive Policy

  Remove the recursive policy that queries tenant_users from within tenant_users policies.
  Keep only simple, non-recursive policies.

  ## Changes
  - Drop "Users can view same tenant users" policy (causes recursion)
  - Keep only direct, non-recursive policies
*/

-- Remove the recursive policy
DROP POLICY IF EXISTS "Users can view same tenant users" ON tenant_users;

-- The remaining policies are:
-- 1. "Users can view own tenant user" - user_id = auth.uid() (no recursion)
-- 2. "Tenant owners can manage users" - checks tenants table only (no recursion)
-- 3. "Master admin can view all tenant users" - checks auth.users only (no recursion)