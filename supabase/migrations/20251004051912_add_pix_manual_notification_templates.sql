/*
  # Adicionar Templates de Notificação para PIX Manual

  1. Novos Templates
    - `pix_extra_photos` - Notificação de PIX para fotos extras
    - `pix_public_gallery` - Notificação de PIX para galeria pública
    - `pix_appointment` - Notificação de PIX para agendamento

  2. Variáveis Disponíveis
    - {{client_name}} - Nome do cliente
    - {{studio_name}} - Nome do estúdio
    - {{pix_key}} - Chave PIX do estúdio
    - {{amount}} - Valor formatado
    - {{extra_photos}} - Quantidade de fotos extras
    - {{event_name}} - Nome do evento (galerias públicas)
    - {{photos_count}} - Total de fotos selecionadas
    - {{session_type}} - Tipo de sessão
    - {{appointment_date}} - Data do agendamento
    - {{appointment_time}} - Horário do agendamento
*/

-- Inserir template para fotos extras com PIX manual
INSERT INTO triagem_notification_templates (type, name, message_template, is_active)
VALUES (
  'pix_extra_photos',
  'PIX - Fotos Extras',
  '🎉 *Seleção Confirmada!*

Olá *{{client_name}}*!

Recebemos sua seleção de fotos:
📸 *{{extra_photos}} foto(s) extra(s)*
💰 *Valor: {{amount}}*

*Dados para Pagamento PIX:*
🔑 Chave: `{{pix_key}}`
🏢 Favorecido: {{studio_name}}

Após o pagamento, envie o comprovante para este número.

✨ Obrigado por escolher nosso estúdio!',
  true
)
ON CONFLICT (type) DO UPDATE SET
  message_template = EXCLUDED.message_template,
  updated_at = now();

-- Inserir template para galeria pública com PIX manual
INSERT INTO triagem_notification_templates (type, name, message_template, is_active)
VALUES (
  'pix_public_gallery',
  'PIX - Galeria Pública',
  '🎉 *Galeria Pública - Seleção Confirmada!*

Olá *{{client_name}}*!

📸 *Evento:* {{event_name}}
🖼️ *Fotos selecionadas:* {{photos_count}}
💰 *Valor total: {{amount}}*

*Dados para Pagamento PIX:*
🔑 Chave: `{{pix_key}}`
🏢 Favorecido: {{studio_name}}

Após o pagamento, envie o comprovante para este número.

✨ Obrigado por escolher nosso estúdio!',
  true
)
ON CONFLICT (type) DO UPDATE SET
  message_template = EXCLUDED.message_template,
  updated_at = now();

-- Inserir template para agendamento com PIX manual
INSERT INTO triagem_notification_templates (type, name, message_template, is_active)
VALUES (
  'pix_appointment',
  'PIX - Agendamento',
  '📸 *Agendamento Confirmado!*

Olá *{{client_name}}*!

Sua sessão foi agendada com sucesso:

📋 *Detalhes:*
📸 *Tipo:* {{session_type}}
📅 *Data:* {{appointment_date}}
🕐 *Horário:* {{appointment_time}}
💰 *Valor: {{amount}}*

*Dados para Pagamento PIX:*
🔑 Chave: `{{pix_key}}`
🏢 Favorecido: {{studio_name}}

Após o pagamento, envie o comprovante para confirmar.

✨ Estamos ansiosos para sua sessão!',
  true
)
ON CONFLICT (type) DO UPDATE SET
  message_template = EXCLUDED.message_template,
  updated_at = now();