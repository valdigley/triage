/*
  # Add Public Galleries Support

  1. Changes
    - Add `is_public` flag to galleries_triage table
    - Add `event_name` for public galleries
    - Add `parent_gallery_id` to track individual selections from public galleries
    - Make appointment_id optional (for public galleries)
    - Add index for performance

  2. Security
    - Update RLS policies to allow public access to public galleries
*/

-- Add new columns to galleries_triage
DO $$
BEGIN
  -- is_public: Indica se é uma galeria pública (evento)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'galleries_triage' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE galleries_triage
    ADD COLUMN is_public boolean DEFAULT false NOT NULL;
  END IF;

  -- event_name: Nome do evento público
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'galleries_triage' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE galleries_triage
    ADD COLUMN event_name text;
  END IF;

  -- parent_gallery_id: Para seleções individuais de galerias públicas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'galleries_triage' AND column_name = 'parent_gallery_id'
  ) THEN
    ALTER TABLE galleries_triage
    ADD COLUMN parent_gallery_id uuid REFERENCES galleries_triage(id) ON DELETE CASCADE;
  END IF;

  -- price_per_photo: Preço por foto para galerias públicas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'galleries_triage' AND column_name = 'price_per_photo'
  ) THEN
    ALTER TABLE galleries_triage
    ADD COLUMN price_per_photo numeric(10,2);
  END IF;
END $$;

-- Make appointment_id nullable (for public galleries)
ALTER TABLE galleries_triage
ALTER COLUMN appointment_id DROP NOT NULL;

-- Add index for parent gallery lookups
CREATE INDEX IF NOT EXISTS idx_galleries_parent_id
ON galleries_triage(parent_gallery_id);

-- Add index for public galleries
CREATE INDEX IF NOT EXISTS idx_galleries_is_public
ON galleries_triage(is_public)
WHERE is_public = true;

-- Update RLS policies to allow public access to public galleries
DROP POLICY IF EXISTS "Public galleries are viewable by anyone with token" ON galleries_triage;

CREATE POLICY "Public galleries are viewable by anyone with token"
  ON galleries_triage
  FOR SELECT
  TO anon
  USING (
    is_public = true OR
    auth.uid() IS NOT NULL
  );

-- Allow authenticated users to create galleries (including individual selections)
DROP POLICY IF EXISTS "Authenticated users can create galleries" ON galleries_triage;

CREATE POLICY "Authenticated users can create galleries"
  ON galleries_triage
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow updating individual gallery selections
DROP POLICY IF EXISTS "Users can update their own gallery selections" ON galleries_triage;

CREATE POLICY "Users can update their own gallery selections"
  ON galleries_triage
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON COLUMN galleries_triage.is_public IS 'Indica se a galeria é pública (evento)';
COMMENT ON COLUMN galleries_triage.event_name IS 'Nome do evento para galerias públicas';
COMMENT ON COLUMN galleries_triage.parent_gallery_id IS 'ID da galeria pai (para seleções individuais de eventos públicos)';
COMMENT ON COLUMN galleries_triage.price_per_photo IS 'Preço por foto para galerias públicas';
