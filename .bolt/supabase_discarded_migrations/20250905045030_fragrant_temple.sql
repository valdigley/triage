/*
  # Add evolution_api_instance column to settings table

  1. Changes
    - Add `evolution_api_instance` column to `settings` table
    - Column is optional (nullable) and stores text data
  
  2. Purpose
    - Fix error: "Could not find the 'evolution_api_instance' column of 'settings' in the schema cache"
    - Allow storing WhatsApp Evolution API instance name in settings
*/

-- Add the missing evolution_api_instance column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS evolution_api_instance TEXT;