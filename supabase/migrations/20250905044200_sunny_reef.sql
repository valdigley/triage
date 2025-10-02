/*
  # Add studio location to settings

  1. Changes
    - Add studio_address column to settings table
    - Add studio_maps_url column for Google Maps link
    - Update existing settings with default location if needed

  2. Security
    - No changes to RLS policies needed
*/

-- Add studio location columns to settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'studio_address'
  ) THEN
    ALTER TABLE settings ADD COLUMN studio_address text DEFAULT 'Rua das Flores, 123 - Centro, São Paulo - SP, 01234-567';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'studio_maps_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN studio_maps_url text DEFAULT 'https://maps.google.com/?q=Rua+das+Flores+123+Centro+São+Paulo+SP';
  END IF;
END $$;