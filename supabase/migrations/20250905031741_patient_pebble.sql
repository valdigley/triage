/*
  # Create session types table

  1. New Tables
    - `session_types`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `label` (text)
      - `description` (text)
      - `icon` (text)
      - `is_active` (boolean, default true)
      - `sort_order` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `session_types` table
    - Add policy for public read access to active session types
    - Add policy for authenticated users to manage session types

  3. Initial Data
    - Insert default session types (aniversario, gestante, formatura, comercial, pre_wedding, tematico)
*/

CREATE TABLE IF NOT EXISTS session_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  icon text DEFAULT '📸',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE session_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active session types"
  ON session_types
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage session types"
  ON session_types
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_session_types_updated_at
  BEFORE UPDATE ON session_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default session types
INSERT INTO session_types (name, label, description, icon, sort_order) VALUES
  ('aniversario', 'Aniversário', 'Celebração de aniversário com cenário personalizado', '🎂', 1),
  ('gestante', 'Gestante', 'Ensaio especial para gravidez e maternidade', '🤱', 2),
  ('formatura', 'Formatura', 'Registro do momento da formatura acadêmica', '🎓', 3),
  ('comercial', 'Comercial', 'Fotos para produtos, serviços ou marketing', '💼', 4),
  ('pre_wedding', 'Pré-wedding', 'Ensaio romântico antes do casamento', '💑', 5),
  ('tematico', 'Temático', 'Sessão com tema específico personalizado', '🎨', 6)
ON CONFLICT (name) DO NOTHING;