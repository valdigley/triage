/*
  # Add studio_name column to settings table

  1. Changes
    - Add `studio_name` column to `settings` table
    - Set default value to empty string
    - Make it nullable initially to avoid issues with existing data

  2. Notes
    - This column will store the studio name for display in the application
    - Column is added as nullable text field with default empty string
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'studio_name'
  ) THEN
    ALTER TABLE settings ADD COLUMN studio_name text DEFAULT '' NULL;
  END IF;
END $$;