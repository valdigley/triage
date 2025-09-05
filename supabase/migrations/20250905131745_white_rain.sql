/*
  # Add watermark image URL to settings

  1. Changes
    - Add `watermark_image_url` column to settings table for PNG watermark images
    
  2. Security
    - Column allows NULL values for optional watermark images
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_image_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_image_url text;
  END IF;
END $$;