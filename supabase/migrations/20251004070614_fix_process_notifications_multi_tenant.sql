/*
  # Corrigir processamento de notificações para multi-tenancy

  1. Mudanças
    - Atualiza função para buscar instância WhatsApp pelo tenant_id correto
    - Remove dependência do appointment (pode não existir)
    - Melhora logs de erro

  2. Segurança
    - Cada notificação usa a instância WhatsApp do seu próprio tenant
    - Isola completamente os tenants
*/

-- Recriar função com multi-tenancy correto
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
  -- Usa tenant_id da própria notificação para buscar a instância WhatsApp correta
  FOR notification_record IN 
    SELECT 
      nq.id,
      nq.tenant_id,
      nq.appointment_id,
      nq.template_type,
      nq.recipient_phone,
      nq.recipient_name,
      nq.message,
      wi.instance_name,
      t.name as tenant_name
    FROM triagem_notification_queue nq
    LEFT JOIN triagem_whatsapp_instances wi ON nq.tenant_id = wi.tenant_id
    LEFT JOIN triagem_tenants t ON nq.tenant_id = t.id
    WHERE nq.status = 'pending'
      AND nq.scheduled_for <= NOW()
    ORDER BY nq.scheduled_for ASC
    LIMIT 50 -- Processar no máximo 50 por vez
  LOOP
    processed := processed + 1;

    BEGIN
      -- Verificar se tem tenant_id
      IF notification_record.tenant_id IS NULL THEN
        UPDATE triagem_notification_queue
        SET 
          status = 'failed',
          error_message = 'Tenant ID não encontrado',
          sent_at = NOW()
        WHERE id = notification_record.id;
        
        errors := errors + 1;
        CONTINUE;
      END IF;

      -- Verificar se tem instância WhatsApp
      IF notification_record.instance_name IS NULL THEN
        UPDATE triagem_notification_queue
        SET 
          status = 'failed',
          error_message = format('WhatsApp não configurado para tenant "%s"', notification_record.tenant_name),
          sent_at = NOW()
        WHERE id = notification_record.id;
        
        errors := errors + 1;
        CONTINUE;
      END IF;

      -- Limpar telefone (remover caracteres não numéricos)
      phone_cleaned := regexp_replace(notification_record.recipient_phone, '[^0-9]', '', 'g');

      -- Verificar se telefone tem pelo menos 10 dígitos
      IF length(phone_cleaned) < 10 THEN
        UPDATE triagem_notification_queue
        SET 
          status = 'failed',
          error_message = format('Telefone inválido: %s', notification_record.recipient_phone),
          sent_at = NOW()
        WHERE id = notification_record.id;
        
        errors := errors + 1;
        CONTINUE;
      END IF;

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

      RAISE NOTICE 'Notificação enviada: % para % (tenant: %)', 
        notification_record.template_type, 
        notification_record.recipient_name,
        notification_record.tenant_name;

    EXCEPTION WHEN OTHERS THEN
      -- Em caso de erro, marcar como failed
      UPDATE triagem_notification_queue
      SET 
        status = 'failed',
        error_message = SQLERRM,
        sent_at = NOW()
      WHERE id = notification_record.id;

      errors := errors + 1;
      
      RAISE NOTICE 'Erro ao enviar notificação: %', SQLERRM;
    END;
  END LOOP;

  -- Registrar log de execução
  IF processed > 0 THEN
    INSERT INTO triagem_cron_logs (job_name, status, message, notifications_processed)
    VALUES (
      'process_pending_notifications',
      'completed',
      format('Processadas: %s | Sucesso: %s | Erros: %s', processed, success, errors),
      processed
    );
  END IF;

  RETURN QUERY SELECT processed, success, errors;
END;
$$;
