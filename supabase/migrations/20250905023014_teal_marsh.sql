/*
  # Add MercadoPago columns to settings table

  1. New Columns
    - `mercadopago_public_key` (text, nullable) - Public key for frontend integration
    - `mercadopago_webhook_url` (text, nullable) - Webhook URL for payment notifications

  2. Changes
    - Add two new optional columns to support MercadoPago integration
    - Both columns are nullable as they are optional configuration fields
*/

-- Add MercadoPago public key column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mercadopago_public_key'
  ) THEN
    ALTER TABLE settings ADD COLUMN mercadopago_public_key text;
  END IF;
END $$;

-- Add MercadoPago webhook URL column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mercadopago_webhook_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN mercadopago_webhook_url text;
  END IF;
END $$;