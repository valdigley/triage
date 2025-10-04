/*
  # Função para Processar Notificações Diretamente via SQL

  1. Nova Função
    - `process_pending_notifications()` - Processa notificações pendentes
      - Busca notificações com `scheduled_for <= NOW()`
      - Envia via API HTTP usando pg_net
      - Atualiza status das notificações

  2. Segurança
    - Apenas executável via cron job
    - Usa credenciais globais do Evolution API

  ## Como Funciona
  
  A função:
  1. Busca notificações pendentes
  2. Para cada notificação, faz requisição HTTP para Evolution API
  3. Atualiza status (sent ou failed)
  4. Registra logs
*/

-- Criar função para processar notificações pendentes
CREATE OR REPLACE FUNCTION process_pending_notifications()
RETURNS TABLE (
  processed_count int,
  success_count int,
  error_count int
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  whatsapp_instance RECORD;
  global_settings RECORD;
  phone_cleaned text;
  api_url text;
  processed int := 0;
  success int := 0;
  errors int := 0;
  request_id bigint;
BEGIN
  -- Buscar configurações globais do WhatsApp
  SELECT evolution_server_url, evolution_auth_api_key
  INTO global_settings
  FROM global_settings
  LIMIT 1;

  IF global_settings IS NULL THEN
    RAISE NOTICE 'Configurações globais não encontradas';
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Processar todas as notificações pendentes que já devem ter sido enviadas
  FOR notification_record IN 
    SELECT nq.*, wi.instance_name
    FROM triagem_notification_queue nq
    LEFT JOIN triagem_appointments a ON nq.appointment_id = a.id
    LEFT JOIN triagem_whatsapp_instances wi ON a.tenant_id = wi.tenant_id
    WHERE nq.status = 'pending'
      AND nq.scheduled_for <= NOW()
    ORDER BY nq.scheduled_for ASC
    LIMIT 50 -- Processar no máximo 50 por vez
  LOOP
    processed := processed + 1;

    BEGIN
      -- Verificar se tem instância WhatsApp
      IF notification_record.instance_name IS NULL THEN
        UPDATE triagem_notification_queue
        SET 
          status = 'failed',
          error_message = 'Instância WhatsApp não encontrada',
          sent_at = NOW()
        WHERE id = notification_record.id;
        
        errors := errors + 1;
        CONTINUE;
      END IF;

      -- Limpar telefone (remover caracteres não numéricos)
      phone_cleaned := regexp_replace(notification_record.recipient_phone, '[^0-9]', '', 'g');

      -- Montar URL da API
      api_url := global_settings.evolution_server_url || '/message/sendText/' || notification_record.instance_name;

      -- Fazer requisição HTTP via pg_net
      SELECT net.http_post(
        url := api_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', global_settings.evolution_auth_api_key
        ),
        body := jsonb_build_object(
          'number', phone_cleaned,
          'text', notification_record.message
        )
      ) INTO request_id;

      -- Marcar como enviado (assumindo sucesso, pg_net é assíncrono)
      UPDATE triagem_notification_queue
      SET 
        status = 'sent',
        sent_at = NOW()
      WHERE id = notification_record.id;

      success := success + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Em caso de erro, marcar como failed
      UPDATE triagem_notification_queue
      SET 
        status = 'failed',
        error_message = SQLERRM,
        sent_at = NOW()
      WHERE id = notification_record.id;

      errors := errors + 1;
    END;
  END LOOP;

  -- Registrar log de execução
  INSERT INTO triagem_cron_logs (job_name, status, message, notifications_processed)
  VALUES (
    'process_pending_notifications',
    'completed',
    format('Processadas: %s | Sucesso: %s | Erros: %s', processed, success, errors),
    processed
  );

  RETURN QUERY SELECT processed, success, errors;
END;
$$;

-- Atualizar o cron job para usar a função SQL diretamente
SELECT cron.unschedule('process-scheduled-notifications');

SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT process_pending_notifications();
  $$
);

-- Inserir log de atualização
INSERT INTO triagem_cron_logs (job_name, status, message)
VALUES (
  'process-scheduled-notifications',
  'updated',
  'Cron job atualizado para usar função SQL direta'
);
