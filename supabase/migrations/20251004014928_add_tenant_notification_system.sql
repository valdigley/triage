/*
  # Sistema de Notificações para Tenants

  1. Novas Tabelas
    - `triagem_tenant_notification_templates`
      - Templates de mensagens para diferentes eventos de tenant
      - Suporta variáveis dinâmicas nas mensagens
    
    - `triagem_tenant_notification_log`
      - Log de todas as notificações enviadas aos tenants
      - Rastreamento de status e erros
  
  2. Eventos Suportados
    - `tenant_welcome`: Boas-vindas ao criar conta
    - `subscription_payment_pending`: Pagamento de assinatura pendente
    - `subscription_payment_approved`: Pagamento de assinatura aprovado
    - `subscription_expiring_soon`: Assinatura expirando em breve (3 dias)
    - `subscription_expired`: Assinatura expirada
    - `trial_expiring_soon`: Trial expirando em breve (2 dias)
    - `trial_expired`: Trial expirado

  3. Segurança
    - RLS habilitado em ambas as tabelas
    - Admins podem gerenciar templates
    - Tenants podem visualizar seu próprio log
*/

-- Templates de notificações
CREATE TABLE IF NOT EXISTS triagem_tenant_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  message_template text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Log de notificações enviadas
CREATE TABLE IF NOT EXISTS triagem_tenant_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES triagem_tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenant_notification_log_tenant_id 
  ON triagem_tenant_notification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notification_log_event_type 
  ON triagem_tenant_notification_log(event_type);
CREATE INDEX IF NOT EXISTS idx_tenant_notification_log_status 
  ON triagem_tenant_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_tenant_notification_log_created_at 
  ON triagem_tenant_notification_log(created_at DESC);

-- RLS
ALTER TABLE triagem_tenant_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE triagem_tenant_notification_log ENABLE ROW LEVEL SECURITY;

-- Policies para templates
CREATE POLICY "Admins can manage notification templates"
  ON triagem_tenant_notification_templates FOR ALL
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

CREATE POLICY "Everyone can view active templates"
  ON triagem_tenant_notification_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies para log
CREATE POLICY "Tenants can view their notification log"
  ON triagem_tenant_notification_log FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM triagem_tenant_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert notification logs"
  ON triagem_tenant_notification_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Inserir templates padrão
INSERT INTO triagem_tenant_notification_templates (event_type, message_template, is_active)
VALUES
  (
    'tenant_welcome',
    E'🎉 *Bem-vindo ao Sistema de Fotografia!*\n\nOlá {{tenant_name}}! 👋\n\nSua conta foi criada com sucesso!\n\n✨ Você está no período trial de {{trial_days}} dias.\n\n📅 Trial válido até: {{trial_expires_at}}\n\nAproveite todos os recursos:\n✅ Agendamentos ilimitados\n✅ Galerias de fotos\n✅ Pagamentos via PIX\n✅ Notificações automáticas\n\nPrecisa de ajuda? Estamos à disposição!',
    true
  ),
  (
    'subscription_payment_pending',
    E'⏰ *Pagamento Pendente*\n\nOlá {{tenant_name}}!\n\nSeu pagamento de assinatura está aguardando confirmação.\n\n💰 Valor: R$ {{amount}}\n📋 Plano: {{plan_name}}\n\nO PIX foi gerado e está aguardando pagamento.\n\nAssim que confirmarmos o pagamento, sua assinatura será ativada automaticamente!',
    true
  ),
  (
    'subscription_payment_approved',
    E'✅ *Pagamento Aprovado!*\n\nParabéns {{tenant_name}}! 🎉\n\nSeu pagamento foi confirmado com sucesso!\n\n💰 Valor pago: R$ {{amount}}\n📋 Plano: {{plan_name}}\n📅 Válido até: {{expires_at}}\n\nSua assinatura está ativa e você tem acesso completo a todos os recursos!\n\nObrigado por confiar em nosso sistema! 💙',
    true
  ),
  (
    'subscription_expiring_soon',
    E'⚠️ *Assinatura Expirando em Breve*\n\nOlá {{tenant_name}},\n\nSua assinatura está próxima do vencimento:\n\n📅 Vence em: {{expires_at}}\n⏰ Faltam {{days_remaining}} dias\n\nPara continuar usando todos os recursos, renove sua assinatura antes do vencimento.\n\n💡 Renovando agora você garante que não haverá interrupção no serviço!',
    true
  ),
  (
    'subscription_expired',
    E'⛔ *Assinatura Expirada*\n\nOlá {{tenant_name}},\n\nSua assinatura expirou em {{expired_at}}.\n\n❌ Seu acesso aos recursos está bloqueado.\n\nPara reativar sua conta e continuar usando o sistema:\n\n1. Acesse o painel de controle\n2. Vá em "Assinatura"\n3. Escolha um plano e renove\n\nEstamos aguardando você! 💙',
    true
  ),
  (
    'trial_expiring_soon',
    E'⏰ *Trial Expirando em Breve*\n\nOlá {{tenant_name}}!\n\nSeu período trial está acabando:\n\n📅 Expira em: {{trial_expires_at}}\n⏰ Faltam {{days_remaining}} dias\n\n💡 Para continuar usando todos os recursos após o trial:\n\n1. Acesse "Assinatura" no painel\n2. Escolha o melhor plano para você\n3. Faça o pagamento via PIX\n\nNão perca acesso aos seus dados! Assine agora! 🚀',
    true
  ),
  (
    'trial_expired',
    E'⛔ *Trial Expirado*\n\nOlá {{tenant_name}},\n\nSeu período trial expirou em {{expired_at}}.\n\n❌ Seu acesso está bloqueado.\n\n✨ Para reativar sua conta e continuar:\n\n1. Acesse o painel de controle\n2. Vá em "Assinatura"\n3. Escolha um plano e faça o pagamento\n\nTodos os seus dados estão seguros e serão restaurados assim que assinar! 💙',
    true
  )
ON CONFLICT (event_type) DO NOTHING;
