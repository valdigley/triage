/*
  # Add missing tables for photo studio management

  1. New Tables
    - `settings` - System configuration and pricing
    - `clients` - Client information and contact details  
    - `appointments` - Session bookings and scheduling
    - `payments` - Payment tracking and status

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated admin access
    - Add public read access where needed for booking system

  3. Data
    - Insert default settings record
    - Add indexes for performance
*/

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_name text DEFAULT 'Studio Fotográfico',
  mercadopago_access_token text,
  evolution_api_url text,
  evolution_api_key text,
  price_commercial_hour decimal(10,2) DEFAULT 30.00,
  price_after_hours decimal(10,2) DEFAULT 40.00,
  minimum_photos integer DEFAULT 5,
  delivery_days integer DEFAULT 7,
  link_validity_days integer DEFAULT 30,
  cleanup_days integer DEFAULT 30,
  commercial_hours jsonb DEFAULT '{"monday":{"start":"09:00","end":"18:00","enabled":true},"tuesday":{"start":"09:00","end":"18:00","enabled":true},"wednesday":{"start":"09:00","end":"18:00","enabled":true},"thursday":{"start":"09:00","end":"18:00","enabled":true},"friday":{"start":"09:00","end":"18:00","enabled":true},"saturday":{"start":"09:00","end":"16:00","enabled":true},"sunday":{"start":"09:00","end":"16:00","enabled":false}}'::jsonb,
  terms_conditions text DEFAULT '📸 Edição: Ajustes básicos de cor, enquadramento e pequenos retoques
🖼 Entrega: Até 7 dias após a seleção das fotos
➕ Foto extra: R$30,00 cada
📆 Cancelamento: Até 48h antes, com perda de 30% do valor pago
📩 Entrega: via link com validade de 30 dias
🕒 Seleção: O cliente tem 7 dias para escolher as fotos. Se não o fizer, o fotógrafo fará a seleção
📢 As fotos podem ser usadas no portfólio e redes sociais do fotógrafo, salvo aviso prévio do cliente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  total_spent decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  session_type text NOT NULL,
  session_details jsonb DEFAULT '{}'::jsonb,
  scheduled_date timestamptz NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  minimum_photos integer DEFAULT 5,
  status text DEFAULT 'pending',
  payment_id text,
  payment_status text DEFAULT 'pending',
  terms_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  mercadopago_id text,
  amount decimal(10,2) NOT NULL,
  status text DEFAULT 'pending',
  payment_type text DEFAULT 'initial',
  webhook_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Admin can manage settings"
  ON settings
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can read settings"
  ON settings
  FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for clients
CREATE POLICY "Admin can manage clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for appointments
CREATE POLICY "Admin can manage appointments"
  ON appointments
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can create appointments"
  ON appointments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read appointment availability"
  ON appointments
  FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for payments
CREATE POLICY "Admin can manage payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Insert default settings if none exist
INSERT INTO settings (id) 
SELECT gen_random_uuid() 
WHERE NOT EXISTS (SELECT 1 FROM settings);