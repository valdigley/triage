/*
  # Configurações Globais da Evolution API
  
  1. Nova Tabela
    - `global_settings`
      - `id` (uuid, primary key)
      - `evolution_api_url` (text) - URL do servidor Evolution API
      - `evolution_api_key` (text) - API Key global
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Segurança
    - Apenas o admin master pode acessar e modificar
    - RLS habilitado
*/

-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url text NOT NULL,
  evolution_api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Only master admin can read global settings
CREATE POLICY "Master admin can read global settings"
  ON global_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );

-- Only master admin can insert global settings
CREATE POLICY "Master admin can insert global settings"
  ON global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );

-- Only master admin can update global settings
CREATE POLICY "Master admin can update global settings"
  ON global_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );

-- Only master admin can delete global settings
CREATE POLICY "Master admin can delete global settings"
  ON global_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'valdigley2007@gmail.com'
    )
  );