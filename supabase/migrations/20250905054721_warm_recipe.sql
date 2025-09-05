/*
  # Adicionar templates de notificação configuráveis

  1. New Tables
    - `notification_templates`
      - `id` (uuid, primary key)
      - `type` (text, tipo da notificação)
      - `name` (text, nome amigável)
      - `message_template` (text, template da mensagem)
      - `is_active` (boolean, se está ativa)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `notification_queue`
      - `id` (uuid, primary key)
      - `appointment_id` (uuid, referência ao agendamento)
      - `template_type` (text, tipo do template)
      - `recipient_phone` (text, telefone do destinatário)
      - `message` (text, mensagem processada)
      - `scheduled_for` (timestamp, quando enviar)
      - `sent_at` (timestamp, quando foi enviada)
      - `status` (text, status do envio)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage templates
    - Add policies for system to manage queue
*/

-- Create notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  name text NOT NULL,
  message_template text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_name text NOT NULL,
  message text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for notification templates
CREATE POLICY "Admin can manage notification templates"
  ON notification_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can read active templates"
  ON notification_templates
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create policies for notification queue
CREATE POLICY "Admin can manage notification queue"
  ON notification_queue
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_appointment_id ON notification_queue(appointment_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (type, name, message_template) VALUES
(
  'payment_confirmation',
  'Confirmação de Pagamento',
  '✅ *Pagamento Confirmado!*

Olá {{client_name}}!

Recebemos seu pagamento de {{amount}} com sucesso! 🎉

📋 *Detalhes da sua sessão:*
📸 *Tipo:* {{session_type}}
📅 *Data:* {{appointment_date}}
🕐 *Horário:* {{appointment_time}}

📍 *Local:*
{{studio_address}}

🗺️ *Ver no mapa:*
{{studio_maps_url}}

💡 *Dicas importantes:*
• Chegue 10 minutos antes do horário
• Traga roupas extras se desejar
• Suas fotos ficarão prontas em até {{delivery_days}} dias

Estamos ansiosos para sua sessão! 📸✨

_Mensagem automática do sistema_'
),
(
  'reminder_1_day_before',
  'Lembrete 1 Dia Antes',
  '📅 *Lembrete da Sessão - Amanhã!*

Oi {{client_name}}!

Sua sessão é amanhã às {{appointment_time}}! 📸

💡 *Dicas para aproveitar melhor:*
• Vá salvando referências de poses/estilos que gosta
• Me mande essas referências para sermos mais objetivos
• Confirme a produção e os looks que vai usar
• Chegue 10 minutos antes

📍 *Local:* {{studio_address}}
🗺️ *Mapa:* {{studio_maps_url}}

Qualquer dúvida, me chama! 😊

_Mensagem automática do sistema_'
),
(
  'reminder_day_of_session',
  'Lembrete Dia da Sessão',
  '🎬 *Hoje é o Dia da Sua Sessão!*

Oi {{client_name}}!

Estamos te esperando às {{appointment_time}} no estúdio! 📸

📍 *Endereço:*
{{studio_address}}

🗺️ *Localização:*
{{studio_maps_url}}

💡 *Lembrete final:*
• Chegue 10 minutos antes
• Traga as roupas/acessórios combinados

Mal podemos esperar para criar fotos incríveis com você! ✨

_Mensagem automática do sistema_'
),
(
  'gallery_ready',
  'Galeria Pronta',
  '📸 *Suas Fotos Estão Prontas!*

Oi {{client_name}}!

Suas fotos já estão disponíveis para seleção! 🎉

🔗 *Link da Galeria:*
{{gallery_link}}

⏰ *Importante:* Você tem 7 dias para fazer a seleção. Se não fizer, nós faremos a seleção para você.

💡 *Como funciona:*
• Acesse o link
• Visualize todas as fotos
• Selecione suas favoritas
• Confirme a seleção

Quanto antes fizer, melhor! 😊

_Mensagem automática do sistema_'
),
(
  'selection_received',
  'Seleção Recebida',
  '✅ *Seleção Recebida!*

Opa {{client_name}}!

Recebi sua seleção de fotos! Obrigado! 🎉

📝 *Próximos passos:*
• Vamos editar suas fotos selecionadas
• Em até {{delivery_days}} dias te mando tudo prontinho
• Você receberá o link para download

Suas fotos vão ficar incríveis! 📸✨

_Mensagem automática do sistema_'
),
(
  'selection_reminder',
  'Lembrete de Seleção',
  '⏰ *Último Dia para Seleção!*

Ei {{client_name}}!

Amanhã é o último dia para você selecionar as fotos! 📸

🔗 *Link da Galeria:*
{{gallery_link}}

Se não conseguir fazer até amanhã, vamos selecionar aqui e te mandaremos as melhores! 😊

_Mensagem automática do sistema_'
),
(
  'delivery_reminder',
  'Lembrete de Entrega',
  '📦 *Suas Fotos Chegam Amanhã!*

Oi {{client_name}}!

A entrega das suas fotos editadas está prevista para amanhã! 🎉

📸 Você receberá o link para download via WhatsApp

Mal podemos esperar para você ver o resultado final! ✨

_Mensagem automática do sistema_'
)
ON CONFLICT (type) DO NOTHING;