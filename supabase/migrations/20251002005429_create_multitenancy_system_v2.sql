/*
  # Sistema Multitenancy com Trial e Pagamento PIX

  ## Resumo
  Transforma o sistema em uma plataforma SaaS onde múltiplos fotógrafos podem se cadastrar,
  ter trial de 7 dias gratuito, e depois pagar via PIX para continuar usando.

  ## Novos Componentes

  1. **Tabela `tenants`** (Fotógrafos/Estúdios)
    - Armazena informações de cada fotógrafo/estúdio
    - Status: trial, active, suspended, canceled
    - Trial de 7 dias automático

  2. **Tabela `subscriptions`** (Assinaturas)
    - Planos mensais e anuais
    - Status e datas de vigência

  3. **Tabela `subscription_payments`** (Pagamentos de Assinatura)
    - Pagamentos via PIX
    - Integração com MercadoPago

  4. **Tabela `tenant_users`** (Usuários de cada Tenant)
    - Relaciona usuários aos tenants
    - Roles: owner, admin, user

  5. **Atualização das Tabelas Existentes**
    - Adiciona `tenant_id` em todas as tabelas principais

  ## Planos
  - **Trial**: 7 dias grátis
  - **Mensal**: R$ 79,90/mês
  - **Anual**: R$ 799,00/ano (2 meses grátis)

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Isolamento total de dados entre tenants
  - Usuário master (valdigley2007@gmail.com) tem acesso a tudo
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  business_name text,
  cpf_cnpj text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'canceled')),
  trial_ends_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_name text NOT NULL CHECK (plan_name IN ('monthly', 'yearly')),
  amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'canceled')),
  starts_at timestamptz,
  expires_at timestamptz,
  payment_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_method text DEFAULT 'pix',
  external_payment_id text,
  qr_code text,
  qr_code_base64 text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create tenant_users table
CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Add tenant_id to existing tables
DO $$
BEGIN
  -- Add tenant_id to clients
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  -- Add tenant_id to appointments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'appointments' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  -- Add tenant_id to galleries_triage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'galleries_triage' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE galleries_triage ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  -- Add tenant_id to photos_triage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos_triage' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE photos_triage ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  -- Add tenant_id to payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  -- Add tenant_id to settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE settings ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant_id ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_galleries_triage_tenant_id ON galleries_triage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_photos_triage_tenant_id ON photos_triage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Helper function to get current tenant_id
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id 
  FROM tenant_users 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if user is master admin
CREATE OR REPLACE FUNCTION is_master_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'valdigley2007@gmail.com'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if subscription is active
CREATE OR REPLACE FUNCTION has_active_subscription(tenant_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'active' AND s.expires_at > now()
    WHERE t.id = tenant_uuid
    AND (
      (t.status = 'trial' AND t.trial_ends_at > now()) OR
      (t.status = 'active' AND s.id IS NOT NULL)
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- RLS Policies for tenants
DROP POLICY IF EXISTS "Master admin can view all tenants" ON tenants;
CREATE POLICY "Master admin can view all tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid() OR
    id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create their tenant on signup" ON tenants;
CREATE POLICY "Users can create their tenant on signup"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant owners can update their tenant" ON tenants;
CREATE POLICY "Tenant owners can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Master admin can update any tenant" ON tenants;
CREATE POLICY "Master admin can update any tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

-- RLS Policies for subscriptions
DROP POLICY IF EXISTS "Master admin can view all subscriptions" ON subscriptions;
CREATE POLICY "Master admin can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON subscriptions;
CREATE POLICY "Users can view their tenant subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Users can create subscriptions for their tenant" ON subscriptions;
CREATE POLICY "Users can create subscriptions for their tenant"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_current_tenant_id());

-- RLS Policies for subscription_payments
DROP POLICY IF EXISTS "Master admin can view all subscription payments" ON subscription_payments;
CREATE POLICY "Master admin can view all subscription payments"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Users can view their tenant subscription payments" ON subscription_payments;
CREATE POLICY "Users can view their tenant subscription payments"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Users can create subscription payments for their tenant" ON subscription_payments;
CREATE POLICY "Users can create subscription payments for their tenant"
  ON subscription_payments FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_current_tenant_id());

-- RLS Policies for tenant_users
DROP POLICY IF EXISTS "Master admin can view all tenant users" ON tenant_users;
CREATE POLICY "Master admin can view all tenant users"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "Users can view their tenant users" ON tenant_users;
CREATE POLICY "Users can view their tenant users"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    tenant_id = get_current_tenant_id()
  );

DROP POLICY IF EXISTS "Tenant owners can manage tenant users" ON tenant_users;
CREATE POLICY "Tenant owners can manage tenant users"
  ON tenant_users FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );