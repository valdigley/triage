/*
  # Atualizar RLS Policies para Multitenancy

  ## Resumo
  Atualiza todas as políticas RLS existentes para incluir isolamento por tenant
  e verificação de assinatura ativa.

  ## Mudanças
  - Remove policies antigas que não consideram tenant_id
  - Adiciona novas policies com isolamento por tenant
  - Adiciona verificação de assinatura ativa para operações de escrita
  - Master admin (valdigley2007@gmail.com) tem acesso total
*/

-- Update clients RLS policies
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

CREATE POLICY "Users can view clients in their tenant"
  ON clients FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert clients in their tenant"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update clients in their tenant"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can delete clients in their tenant"
  ON clients FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

-- Update appointments RLS policies
DROP POLICY IF EXISTS "Authenticated users can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view appointments" ON appointments;
DROP POLICY IF EXISTS "Users can create appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments" ON appointments;

CREATE POLICY "Users can view appointments in their tenant"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert appointments in their tenant"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update appointments in their tenant"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can delete appointments in their tenant"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

-- Update galleries_triage RLS policies
DROP POLICY IF EXISTS "Authenticated users can view their galleries" ON galleries_triage;
DROP POLICY IF EXISTS "Users can view their galleries" ON galleries_triage;
DROP POLICY IF EXISTS "Authenticated users can create galleries" ON galleries_triage;
DROP POLICY IF EXISTS "Authenticated users can update their own gallery selections" ON galleries_triage;
DROP POLICY IF EXISTS "Users can update their own gallery selections" ON galleries_triage;
DROP POLICY IF EXISTS "Authenticated users can update their galleries" ON galleries_triage;
DROP POLICY IF EXISTS "Authenticated users can delete their galleries" ON galleries_triage;
DROP POLICY IF EXISTS "Anyone can view public galleries" ON galleries_triage;

-- Allow public access to public galleries (no auth required)
CREATE POLICY "Anyone can view public galleries"
  ON galleries_triage FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "Users can view galleries in their tenant"
  ON galleries_triage FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert galleries in their tenant"
  ON galleries_triage FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update galleries in their tenant"
  ON galleries_triage FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can delete galleries in their tenant"
  ON galleries_triage FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

-- Update photos_triage RLS policies
DROP POLICY IF EXISTS "Authenticated users can view their photos" ON photos_triage;
DROP POLICY IF EXISTS "Users can view their photos" ON photos_triage;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON photos_triage;
DROP POLICY IF EXISTS "Authenticated users can update their photos" ON photos_triage;
DROP POLICY IF EXISTS "Authenticated users can delete their photos" ON photos_triage;
DROP POLICY IF EXISTS "Anyone can view photos from public galleries" ON photos_triage;

-- Allow public access to photos from public galleries
CREATE POLICY "Anyone can view photos from public galleries"
  ON photos_triage FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM galleries_triage 
      WHERE galleries_triage.id = photos_triage.gallery_id 
      AND galleries_triage.is_public = true
    )
  );

CREATE POLICY "Users can view photos in their tenant"
  ON photos_triage FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert photos in their tenant"
  ON photos_triage FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update photos in their tenant"
  ON photos_triage FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can delete photos in their tenant"
  ON photos_triage FOR DELETE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

-- Update payments RLS policies
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;

CREATE POLICY "Users can view payments in their tenant"
  ON payments FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert payments in their tenant"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update payments in their tenant"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

-- Update settings RLS policies
DROP POLICY IF EXISTS "Authenticated users can view settings" ON settings;
DROP POLICY IF EXISTS "Users can view settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;
DROP POLICY IF EXISTS "Users can update settings" ON settings;

CREATE POLICY "Users can view settings in their tenant"
  ON settings FOR SELECT
  TO authenticated
  USING (
    is_master_admin() OR
    tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Users can insert settings in their tenant"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );

CREATE POLICY "Users can update settings in their tenant"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  )
  WITH CHECK (
    is_master_admin() OR
    (tenant_id = get_current_tenant_id() AND has_active_subscription(tenant_id))
  );