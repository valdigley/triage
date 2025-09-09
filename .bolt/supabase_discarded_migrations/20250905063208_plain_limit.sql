/*
  # Fix galleries-appointments relationship

  1. Changes
    - Add foreign key constraint between galleries.appointment_id and appointments.id
    - This enables proper joins in Supabase queries

  2. Security
    - No changes to existing RLS policies
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'galleries_appointment_id_fkey'
    AND table_name = 'galleries'
  ) THEN
    ALTER TABLE galleries 
    ADD CONSTRAINT galleries_appointment_id_fkey 
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
  END IF;
END $$;