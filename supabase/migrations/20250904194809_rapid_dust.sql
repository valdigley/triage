/*
  # Add evolution_api_instance column to settings table

  1. Changes
    - Add `evolution_api_instance` column to `settings` table
    - Column type: text (nullable)
    - Used to store the Evolution API instance name for WhatsApp integration

  2. Purpose
    - Complete the Evolution API integration configuration
    - Allow users to specify which instance to use for sending messages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'evolution_api_instance'
  ) THEN
    ALTER TABLE settings ADD COLUMN evolution_api_instance text;
  END IF;
END $$;