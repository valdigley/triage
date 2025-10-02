/*
  # Corrigir Políticas RLS da Global Settings
  
  1. Mudanças
    - Remove políticas antigas que acessam auth.users
    - Cria novas políticas usando auth.jwt()
    - Verifica email diretamente do JWT
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Master admin can read global settings" ON global_settings;
DROP POLICY IF EXISTS "Master admin can insert global settings" ON global_settings;
DROP POLICY IF EXISTS "Master admin can update global settings" ON global_settings;
DROP POLICY IF EXISTS "Master admin can delete global settings" ON global_settings;

-- Create new policies using JWT
CREATE POLICY "Master admin can read global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'valdigley2007@gmail.com'
  );

CREATE POLICY "Master admin can insert global settings"
  ON global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'valdigley2007@gmail.com'
  );

CREATE POLICY "Master admin can update global settings"
  ON global_settings
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'valdigley2007@gmail.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'valdigley2007@gmail.com'
  );

CREATE POLICY "Master admin can delete global settings"
  ON global_settings
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'valdigley2007@gmail.com'
  );
