/*
  # Adicionar suporte a notificações com credenciais

  1. Alterações na tabela tenants
    - Adicionar coluna whatsapp_number (usa phone como padrão)
  
  2. Atualizar templates de notificações
    - Adicionar URL da aplicação
    - Incluir credenciais de acesso (email e senha temporária)
  
  3. Novos templates
    - Credenciais de acesso após registro
    - Credenciais após pagamento aprovado
*/

-- Adicionar coluna whatsapp_number aos tenants (usa phone por padrão)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_tenants' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE triagem_tenants ADD COLUMN whatsapp_number text;
    
    -- Copiar phone para whatsapp_number se estiver vazio
    UPDATE triagem_tenants 
    SET whatsapp_number = phone 
    WHERE whatsapp_number IS NULL AND phone IS NOT NULL;
  END IF;
END $$;

-- Atualizar template de boas-vindas com credenciais
UPDATE triagem_tenant_notification_templates
SET message_template = E'🎉 *Bem-vindo ao Sistema de Fotografia!*\n\nOlá {{tenant_name}}! 👋\n\nSua conta foi criada com sucesso!\n\n🔐 *Dados de Acesso*\n🌐 URL: {{app_url}}\n✉️ E-mail: {{email}}\n🔑 Senha: {{password}}\n\n✨ *Período Trial de {{trial_days}} dias*\n📅 Válido até: {{trial_expires_at}}\n\n*Recursos disponíveis:*\n✅ Agendamentos ilimitados\n✅ Galerias de fotos\n✅ Pagamentos via PIX\n✅ Notificações automáticas\n\n💡 Recomendamos alterar sua senha no primeiro acesso!\n\nPrecisa de ajuda? Estamos à disposição!'
WHERE event_type = 'tenant_welcome';

-- Atualizar template de pagamento aprovado com credenciais
UPDATE triagem_tenant_notification_templates
SET message_template = E'✅ *Pagamento Aprovado!*\n\nParabéns {{tenant_name}}! 🎉\n\nSeu pagamento foi confirmado com sucesso!\n\n💰 Valor pago: R$ {{amount}}\n📋 Plano: {{plan_name}}\n📅 Válido até: {{expires_at}}\n\n🔐 *Acesse o Sistema*\n🌐 URL: {{app_url}}\n✉️ E-mail: {{email}}\n\nSua assinatura está ativa e você tem acesso completo a todos os recursos!\n\nObrigado por confiar em nosso sistema! 💙'
WHERE event_type = 'subscription_payment_approved';

-- Criar template para envio de credenciais após pagamento aprovado (se não existir)
INSERT INTO triagem_tenant_notification_templates (event_type, message_template, is_active)
VALUES (
  'credentials_after_payment',
  E'🔐 *Acesso Liberado ao Sistema*\n\nOlá {{tenant_name}}!\n\nSeu pagamento foi confirmado e sua conta está ativa!\n\n*Dados de Acesso:*\n🌐 URL: {{app_url}}\n✉️ E-mail: {{email}}\n\n📋 Plano: {{plan_name}}\n📅 Válido até: {{expires_at}}\n\nFaça login com seu e-mail e senha cadastrados.\n\nSe esqueceu sua senha, use a opção "Esqueci minha senha" na tela de login.\n\nBom trabalho! 💙',
  true
)
ON CONFLICT (event_type) DO UPDATE
SET message_template = EXCLUDED.message_template;
