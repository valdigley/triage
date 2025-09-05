/*
  # Create MercadoPago settings table

  1. New Tables
    - `mercadopago_settings`
      - `id` (uuid, primary key)
      - `access_token` (text, encrypted access token)
      - `public_key` (text, public key for frontend)
      - `webhook_url` (text, webhook URL for notifications)
      - `environment` (text, sandbox or production)
      - `is_active` (boolean, if this configuration is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `mercadopago_settings` table
    - Add policy for authenticated users to manage settings

  3. Changes
    - Remove MercadoPago columns from settings table
    - Create new dedicated table for MercadoPago configuration
*/

-- Create MercadoPago settings table
CREATE TABLE IF NOT EXISTS mercadopago_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text,
  public_key text,
  webhook_url text,
  environment text DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE mercadopago_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin can manage MercadoPago settings"
  ON mercadopago_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE TRIGGER update_mercadopago_settings_updated_at
  BEFORE UPDATE ON mercadopago_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Remove MercadoPago columns from settings table if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mercadopago_access_token'
  ) THEN
    ALTER TABLE settings DROP COLUMN mercadopago_access_token;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mercadopago_public_key'
  ) THEN
    ALTER TABLE settings DROP COLUMN mercadopago_public_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mercadopago_webhook_url'
  ) THEN
    ALTER TABLE settings DROP COLUMN mercadopago_webhook_url;
  END IF;
END $$;