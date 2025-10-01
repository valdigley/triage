/*
  # Add client and gallery fields to payments

  1. Changes
    - Add `client_id` column to `payments` (optional foreign key to clients)
    - Add `gallery_id` column to `payments` (optional foreign key to galleries_triage)
    
  2. Purpose
    - Allow payments to be linked directly to clients (without appointment)
    - Allow payments to be linked directly to galleries (for public galleries)
*/

-- Add client_id column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Add gallery_id column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS gallery_id uuid REFERENCES galleries_triage(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_gallery_id ON payments(gallery_id);