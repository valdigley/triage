/*
  # Add app_url field to settings table

  1. Changes
    - Add `app_url` column to `settings` table to store the application URL
    - This is used by edge functions to generate correct redirect URLs
    - Default value is 'https://triagem.online'

  2. Notes
    - This allows the gallery link previews to work correctly in WhatsApp
    - The URL can be configured in the settings panel
*/

-- Add app_url column to settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'app_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN app_url text DEFAULT 'https://triagem.online';
  END IF;
END $$;
