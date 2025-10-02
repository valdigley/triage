/*
  # Criar tabela galleries_triage para o sistema de agendamento

  1. Nova Tabela
    - `galleries_triage`
      - `id` (uuid, primary key)
      - `appointment_id` (uuid, foreign key para appointments)
      - `name` (text)
      - `gallery_token` (text, unique)
      - `password` (text, opcional)
      - `status` (text, default 'pending')
      - `photos_uploaded` (integer, default 0)
      - `photos_selected` (text[], array de IDs das fotos selecionadas)
      - `selection_completed` (boolean, default false)
      - `selection_submitted_at` (timestamp)
      - `link_expires_at` (timestamp)
      - `watermark_settings` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Nova Tabela
    - `photos_triage`
      - `id` (uuid, primary key)
      - `gallery_id` (uuid, foreign key para galleries_triage)
      - `filename` (text)
      - `url` (text)
      - `thumbnail` (text)
      - `size` (bigint)
      - `is_selected` (boolean, default false)
      - `metadata` (jsonb)
      - `upload_date` (timestamp)
      - `created_at` (timestamp)

  3. Segurança
    - Enable RLS em ambas as tabelas
    - Políticas para admin e acesso público às galerias
*/

-- Criar tabela galleries_triage
CREATE TABLE IF NOT EXISTS galleries_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  name text NOT NULL,
  gallery_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  password text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'completed')),
  photos_uploaded integer DEFAULT 0,
  photos_selected text[] DEFAULT '{}',
  selection_completed boolean DEFAULT false,
  selection_submitted_at timestamptz,
  link_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  watermark_settings jsonb DEFAULT '{
    "enabled": true,
    "text": "Preview",
    "opacity": 0.7,
    "position": "center"
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela photos_triage
CREATE TABLE IF NOT EXISTS photos_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid REFERENCES galleries_triage(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  thumbnail text NOT NULL,
  size bigint NOT NULL,
  is_selected boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  upload_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_galleries_triage_appointment_id ON galleries_triage(appointment_id);
CREATE INDEX IF NOT EXISTS idx_galleries_triage_token ON galleries_triage(gallery_token);
CREATE INDEX IF NOT EXISTS idx_galleries_triage_status ON galleries_triage(status);
CREATE INDEX IF NOT EXISTS idx_galleries_triage_expires ON galleries_triage(link_expires_at);

CREATE INDEX IF NOT EXISTS idx_photos_triage_gallery_id ON photos_triage(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_triage_selected ON photos_triage(is_selected);
CREATE INDEX IF NOT EXISTS idx_photos_triage_upload_date ON photos_triage(upload_date);

-- Enable RLS
ALTER TABLE galleries_triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_triage ENABLE ROW LEVEL SECURITY;

-- Políticas para galleries_triage
CREATE POLICY "Admin can manage galleries_triage"
  ON galleries_triage
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view galleries_triage by token"
  ON galleries_triage
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Políticas para photos_triage
CREATE POLICY "Admin can manage photos_triage"
  ON photos_triage
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view photos_triage"
  ON photos_triage
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_galleries_triage_updated_at
    BEFORE UPDATE ON galleries_triage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();