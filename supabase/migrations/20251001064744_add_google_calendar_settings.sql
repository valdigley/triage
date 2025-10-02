/*
  # Add Google Calendar Integration Settings

  1. New Tables
    - `google_calendar_settings`
      - `id` (uuid, primary key)
      - `calendar_id` (text) - ID do calendário Google
      - `service_account_email` (text) - Email da conta de serviço
      - `service_account_key` (jsonb) - Chave privada JSON da conta de serviço
      - `is_active` (boolean) - Se a integração está ativa
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `google_calendar_settings` table
    - Add policy for authenticated users to read settings
    - Add policy for authenticated users to manage settings
*/

-- Create google_calendar_settings table
CREATE TABLE IF NOT EXISTS google_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id text NOT NULL,
  service_account_email text NOT NULL,
  service_account_key jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE google_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read settings
CREATE POLICY "Authenticated users can read google calendar settings"
  ON google_calendar_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert settings
CREATE POLICY "Authenticated users can insert google calendar settings"
  ON google_calendar_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update settings
CREATE POLICY "Authenticated users can update google calendar settings"
  ON google_calendar_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete settings
CREATE POLICY "Authenticated users can delete google calendar settings"
  ON google_calendar_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_settings_active 
ON google_calendar_settings (is_active) 
WHERE is_active = true;