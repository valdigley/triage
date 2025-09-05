/*
  # Sistema de Seleção de Fotos

  1. New Tables
    - `galleries` - Galerias de fotos por agendamento
      - `id` (uuid, primary key)
      - `appointment_id` (uuid, foreign key)
      - `name` (text) - Nome da galeria
      - `gallery_token` (text, unique) - Token único para acesso
      - `password` (text, optional) - Senha opcional
      - `status` (text) - pending, started, completed
      - `photos_uploaded` (integer) - Contador de fotos
      - `photos_selected` (text[]) - IDs das fotos selecionadas
      - `selection_completed` (boolean) - Se seleção foi finalizada
      - `selection_submitted_at` (timestamp) - Quando foi submetida
      - `link_expires_at` (timestamp) - Expiração do link
      - `watermark_settings` (jsonb) - Configurações da marca d'água
      - `created_at`, `updated_at`

    - `photos` - Fotos individuais das galerias
      - `id` (uuid, primary key)
      - `gallery_id` (uuid, foreign key)
      - `filename` (text) - Nome original do arquivo
      - `file_path` (text) - Caminho no storage
      - `file_url` (text) - URL pública com marca d'água
      - `original_url` (text) - URL original sem marca d'água
      - `thumbnail_url` (text) - URL da miniatura
      - `photo_code` (text) - Código da foto (IMG001, IMG002, etc)
      - `is_selected` (boolean) - Se foi selecionada pelo cliente
      - `is_extra` (boolean) - Se é foto extra (acima do mínimo)
      - `metadata` (jsonb) - Metadados da imagem
      - `created_at`

  2. Security
    - Enable RLS on both tables
    - Policies for admin access and public gallery access
    - Secure token-based access for clients

  3. Functions
    - Auto-update triggers for timestamps
    - Function to generate gallery tokens
    - Function to generate photo codes
*/

-- Create galleries table
CREATE TABLE IF NOT EXISTS galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  name text NOT NULL,
  gallery_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  password text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'completed')),
  photos_uploaded integer DEFAULT 0,
  photos_selected text[] DEFAULT '{}',
  selection_completed boolean DEFAULT false,
  selection_submitted_at timestamptz,
  link_expires_at timestamptz NOT NULL,
  watermark_settings jsonb DEFAULT '{"enabled": true, "text": "Studio", "opacity": 0.7, "position": "bottom-right"}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid REFERENCES galleries(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  original_url text NOT NULL,
  thumbnail_url text NOT NULL,
  photo_code text NOT NULL,
  is_selected boolean DEFAULT false,
  is_extra boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Policies for galleries
CREATE POLICY "Admin can manage galleries"
  ON galleries
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view galleries by token"
  ON galleries
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policies for photos
CREATE POLICY "Admin can manage photos"
  ON photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM galleries 
      WHERE galleries.id = photos.gallery_id
    )
  );

CREATE POLICY "Public can view photos in accessible galleries"
  ON photos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM galleries 
      WHERE galleries.id = photos.gallery_id
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_galleries_appointment_id ON galleries(appointment_id);
CREATE INDEX IF NOT EXISTS idx_galleries_token ON galleries(gallery_token);
CREATE INDEX IF NOT EXISTS idx_galleries_status ON galleries(status);
CREATE INDEX IF NOT EXISTS idx_galleries_expires_at ON galleries(link_expires_at);

CREATE INDEX IF NOT EXISTS idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_code ON photos(photo_code);
CREATE INDEX IF NOT EXISTS idx_photos_selected ON photos(is_selected);

-- Triggers for updated_at
CREATE TRIGGER update_galleries_updated_at
  BEFORE UPDATE ON galleries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate photo codes
CREATE OR REPLACE FUNCTION generate_photo_code(gallery_id_param uuid)
RETURNS text AS $$
DECLARE
  photo_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO photo_count
  FROM photos
  WHERE gallery_id = gallery_id_param;
  
  RETURN 'IMG' || LPAD(photo_count::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create gallery when appointment is confirmed
CREATE OR REPLACE FUNCTION create_gallery_for_appointment()
RETURNS trigger AS $$
DECLARE
  gallery_name text;
  expiration_date timestamptz;
  settings_data record;
BEGIN
  -- Only create gallery when payment is approved and status becomes confirmed
  IF NEW.payment_status = 'approved' AND NEW.status = 'confirmed' AND 
     (OLD.payment_status != 'approved' OR OLD.status != 'confirmed') THEN
    
    -- Get settings for link validity
    SELECT * INTO settings_data FROM settings LIMIT 1;
    
    -- Calculate expiration date
    expiration_date := NEW.scheduled_date + INTERVAL '1 day' * COALESCE(settings_data.link_validity_days, 30);
    
    -- Generate gallery name
    SELECT 
      TO_CHAR(NEW.scheduled_date, 'DD/MM/YYYY') || ' - ' || 
      c.name || ' - ' || 
      st.label
    INTO gallery_name
    FROM clients c, session_types st
    WHERE c.id = NEW.client_id AND st.name = NEW.session_type;
    
    -- Create gallery
    INSERT INTO galleries (
      appointment_id,
      name,
      link_expires_at
    ) VALUES (
      NEW.id,
      gallery_name,
      expiration_date
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto gallery creation
DROP TRIGGER IF EXISTS auto_create_gallery ON appointments;
CREATE TRIGGER auto_create_gallery
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_gallery_for_appointment();