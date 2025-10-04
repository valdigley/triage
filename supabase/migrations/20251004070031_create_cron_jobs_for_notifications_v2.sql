/*
  # Configurar Cron Jobs para Notificações Automáticas

  1. Cron Jobs
    - `process_scheduled_notifications` - Executa a cada 5 minutos
      - Processa todas as notificações pendentes na fila
      - Envia mensagens WhatsApp para clientes
      - Atualiza status das notificações

  2. Funções
    - Chama a edge function `send-scheduled-notifications`
    - Processa lembretes de:
      - Sessão (1 dia antes e dia da sessão)
      - Seleção de fotos
      - Entrega de fotos
      - Confirmações de pagamento

  3. Segurança
    - Apenas extensão pg_net pode fazer requisições HTTP
    - URL da edge function é configurada dinamicamente

  ## Como Funciona
  
  O cron job executa a cada 5 minutos e:
  1. Busca notificações pendentes com `scheduled_for <= NOW()`
  2. Envia mensagens via WhatsApp
  3. Marca como enviadas ou com erro
  4. Registra logs de execução
*/

-- Habilitar extensão pg_cron se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensão pg_net para fazer requisições HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar tabela para logs de execução do cron (se não existir)
CREATE TABLE IF NOT EXISTS triagem_cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  executed_at timestamptz DEFAULT now(),
  status text NOT NULL,
  message text,
  notifications_processed int DEFAULT 0
);

-- Habilitar RLS na tabela de logs
ALTER TABLE triagem_cron_logs ENABLE ROW LEVEL SECURITY;

-- Política para visualizar logs (apenas autenticados)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'triagem_cron_logs' 
    AND policyname = 'Usuários autenticados podem ver logs de cron'
  ) THEN
    CREATE POLICY "Usuários autenticados podem ver logs de cron"
      ON triagem_cron_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Criar job de cron para processar notificações a cada 5 minutos
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-scheduled-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
      ),
      body := jsonb_build_object(
        'scheduled', true,
        'source', 'cron'
      )
    ) AS request_id;
  $$
);

-- Inserir log de criação do cron job
INSERT INTO triagem_cron_logs (job_name, status, message)
VALUES (
  'process-scheduled-notifications',
  'created',
  'Cron job criado para executar a cada 5 minutos'
);
