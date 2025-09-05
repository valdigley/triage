/*
  # Create WhatsApp instances tracking table

  1. New Tables
    - `whatsapp_instances`
      - `id` (uuid, primary key)
      - `instance_name` (text, unique)
      - `status` (text) - created, connecting, connected, disconnected, error
      - `instance_data` (jsonb) - dados completos da instância da Evolution API
      - `last_updated` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `whatsapp_instances` table
    - Add policy for authenticated users to manage instances
*/

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'created',
  instance_data jsonb DEFAULT '{}',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage WhatsApp instances"
  ON whatsapp_instances
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();