/*
  # Criar tabela de configurações globais do Evolution API

  1. Nova Tabela
    - `triagem_global_evolution_settings`
      - Configurações globais da Evolution API
      - URL, API Key, Instance Name
      - Usado para enviar notificações aos tenants

  2. Segurança
    - RLS habilitado
    - Apenas admins podem gerenciar
*/

-- Criar tabela de configurações globais do Evolution
CREATE TABLE IF NOT EXISTS triagem_global_evolution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice para busca rápida da configuração ativa
CREATE INDEX IF NOT EXISTS idx_global_evolution_settings_active 
  ON triagem_global_evolution_settings(is_active) 
  WHERE is_active = true;

-- RLS
ALTER TABLE triagem_global_evolution_settings ENABLE ROW LEVEL SECURITY;

-- Policy para admins gerenciarem
CREATE POLICY "Admins can manage global evolution settings"
  ON triagem_global_evolution_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triagem_tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Comentário
COMMENT ON TABLE triagem_global_evolution_settings IS 'Configurações globais da Evolution API para envio de notificações aos tenants';
