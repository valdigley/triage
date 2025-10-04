/*
  # Adicionar tenant_id à fila de notificações

  1. Mudanças
    - Adiciona coluna `tenant_id` em `triagem_notification_queue`
    - Preenche tenant_id existentes baseado no appointment
    - Adiciona constraint de foreign key
    - Atualiza índices para incluir tenant_id

  2. Segurança
    - Mantém isolamento por tenant
    - Garante que notificações sejam enviadas pela instância correta
*/

-- Adicionar coluna tenant_id
ALTER TABLE triagem_notification_queue 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES triagem_tenants(id);

-- Preencher tenant_id para notificações existentes baseado no appointment
UPDATE triagem_notification_queue nq
SET tenant_id = a.tenant_id
FROM triagem_appointments a
WHERE nq.appointment_id = a.id
  AND nq.tenant_id IS NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant_id 
ON triagem_notification_queue(tenant_id);

-- Criar índice composto para queries do cron
CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant_status_scheduled 
ON triagem_notification_queue(tenant_id, status, scheduled_for);
