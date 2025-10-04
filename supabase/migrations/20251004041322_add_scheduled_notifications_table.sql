/*
  # Create Scheduled Notifications Table

  1. New Tables
    - `triagem_scheduled_notifications`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key)
      - `appointment_id` (uuid, foreign key)
      - `type` (text) - Tipo de notificação (gallery_ready, selection_reminder, etc)
      - `phone` (text) - Telefone do destinatário
      - `client_name` (text) - Nome do cliente
      - `scheduled_for` (timestamptz) - Quando deve ser enviada
      - `status` (text) - Status (pending, sent, failed)
      - `message_variables` (jsonb) - Variáveis para template
      - `sent_at` (timestamptz) - Quando foi enviada
      - `error` (text) - Mensagem de erro se falhou
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `triagem_scheduled_notifications` table
    - Add policies for authenticated users to manage their tenant's notifications
*/

-- Create scheduled notifications table
CREATE TABLE IF NOT EXISTS triagem_scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES triagem_tenants(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES triagem_appointments(id) ON DELETE CASCADE,
  type text NOT NULL,
  phone text NOT NULL,
  client_name text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message_variables jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tenant ON triagem_scheduled_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_appointment ON triagem_scheduled_notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON triagem_scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON triagem_scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_type ON triagem_scheduled_notifications(type);

-- Enable RLS
ALTER TABLE triagem_scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for viewing notifications
CREATE POLICY "Users can view their tenant notifications"
  ON triagem_scheduled_notifications
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Policies for creating notifications
CREATE POLICY "Users can create notifications for their tenant"
  ON triagem_scheduled_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Policies for updating notifications
CREATE POLICY "Users can update their tenant notifications"
  ON triagem_scheduled_notifications
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Policies for deleting notifications
CREATE POLICY "Users can delete their tenant notifications"
  ON triagem_scheduled_notifications
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_notifications_timestamp
  BEFORE UPDATE ON triagem_scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_notifications_updated_at();
