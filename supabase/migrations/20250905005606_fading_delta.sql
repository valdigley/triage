/*
  # Add studio_phone column to settings table

  1. Changes
    - Add `studio_phone` column to `settings` table
    - Column type: text (nullable)
    - Used for WhatsApp integration and contact information

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'studio_phone'
  ) THEN
    ALTER TABLE settings ADD COLUMN studio_phone text;
  END IF;
END $$;