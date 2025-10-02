/*
  # Add client and payment fields to galleries_triage

  1. Changes
    - Add `client_id` column to `galleries_triage` (optional foreign key to clients)
    - Add `payment_status` column to `galleries_triage` (for public galleries)
    
  2. Purpose
    - Allow public galleries to be created without appointments
    - Track payment status directly in the gallery
*/

-- Add client_id column
ALTER TABLE galleries_triage 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Add payment_status column
ALTER TABLE galleries_triage 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_galleries_triage_client_id ON galleries_triage(client_id);
CREATE INDEX IF NOT EXISTS idx_galleries_triage_payment_status ON galleries_triage(payment_status);