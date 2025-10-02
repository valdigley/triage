/*
  # Add preview image support to galleries

  1. Changes
    - Add `preview_image_url` column to `galleries_triage` table
    - Add `og_title` column for custom Open Graph title
    - Add `og_description` column for custom Open Graph description
  
  2. Purpose
    - Enable rich link previews when sharing gallery links
    - Show gallery cover image as thumbnail in WhatsApp/social media
    - Allow customization of preview text
*/

-- Add preview columns to galleries_triage
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'galleries_triage' AND column_name = 'preview_image_url'
  ) THEN
    ALTER TABLE galleries_triage 
    ADD COLUMN preview_image_url TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'galleries_triage' AND column_name = 'og_title'
  ) THEN
    ALTER TABLE galleries_triage 
    ADD COLUMN og_title TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'galleries_triage' AND column_name = 'og_description'
  ) THEN
    ALTER TABLE galleries_triage 
    ADD COLUMN og_description TEXT;
  END IF;
END $$;

-- Create index for faster lookups by token
CREATE INDEX IF NOT EXISTS idx_galleries_token ON galleries_triage(gallery_token);