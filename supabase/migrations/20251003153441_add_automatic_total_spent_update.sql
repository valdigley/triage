/*
  # Atualização Automática de Dados Financeiros

  ## Descrição
  Cria triggers e funções para atualizar automaticamente o total_spent dos clientes
  sempre que houver mudanças nos pagamentos, independente da origem dos dados
  (webhook MercadoPago, n8n, inserções manuais, etc).

  ## Mudanças

  1. **Função para recalcular total_spent**
     - Calcula o total de todos os pagamentos aprovados de um cliente
     - Atualiza o campo total_spent do cliente

  2. **Trigger para INSERT em pagamentos**
     - Quando um novo pagamento aprovado é inserido, atualiza o total do cliente

  3. **Trigger para UPDATE em pagamentos**
     - Quando um pagamento muda de status para aprovado, atualiza o total do cliente
     - Quando um pagamento aprovado é modificado, recalcula o total

  4. **Trigger para DELETE em pagamentos**
     - Quando um pagamento é deletado, recalcula o total do cliente

  5. **Script de migração**
     - Recalcula o total_spent de todos os clientes existentes baseado nos pagamentos atuais

  ## Importante
  - Os triggers funcionam para qualquer origem de dados (webhook, n8n, API, manual)
  - O total_spent sempre reflete a soma de TODOS os pagamentos com status 'approved'
  - A migração corrige todos os dados históricos
*/

-- Função para recalcular o total_spent de um cliente
CREATE OR REPLACE FUNCTION recalculate_client_total_spent(client_uuid UUID)
RETURNS VOID AS $$
DECLARE
  new_total DECIMAL(10, 2);
BEGIN
  -- Calcula o total de todos os pagamentos aprovados do cliente
  SELECT COALESCE(SUM(amount), 0)
  INTO new_total
  FROM triagem_payments
  WHERE client_id = client_uuid
    AND status = 'approved';

  -- Atualiza o total_spent do cliente
  UPDATE triagem_clients
  SET 
    total_spent = new_total,
    updated_at = NOW()
  WHERE id = client_uuid;

  RAISE NOTICE 'Cliente % - Total recalculado: %', client_uuid, new_total;
END;
$$ LANGUAGE plpgsql;

-- Função trigger para INSERT
CREATE OR REPLACE FUNCTION trigger_update_total_spent_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pagamento é aprovado e tem um client_id, recalcula
  IF NEW.status = 'approved' AND NEW.client_id IS NOT NULL THEN
    PERFORM recalculate_client_total_spent(NEW.client_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função trigger para UPDATE
CREATE OR REPLACE FUNCTION trigger_update_total_spent_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para approved ou o valor foi alterado
  IF NEW.client_id IS NOT NULL AND (
    (OLD.status != 'approved' AND NEW.status = 'approved') OR
    (NEW.status = 'approved' AND OLD.amount != NEW.amount)
  ) THEN
    PERFORM recalculate_client_total_spent(NEW.client_id);
  END IF;

  -- Se o client_id mudou e ambos existem, recalcula para ambos
  IF OLD.client_id IS NOT NULL AND NEW.client_id IS NOT NULL AND OLD.client_id != NEW.client_id THEN
    PERFORM recalculate_client_total_spent(OLD.client_id);
    PERFORM recalculate_client_total_spent(NEW.client_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função trigger para DELETE
CREATE OR REPLACE FUNCTION trigger_update_total_spent_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pagamento deletado estava aprovado, recalcula
  IF OLD.status = 'approved' AND OLD.client_id IS NOT NULL THEN
    PERFORM recalculate_client_total_spent(OLD.client_id);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Remove triggers antigos se existirem
DROP TRIGGER IF EXISTS payments_insert_update_total_spent ON triagem_payments;
DROP TRIGGER IF EXISTS payments_update_update_total_spent ON triagem_payments;
DROP TRIGGER IF EXISTS payments_delete_update_total_spent ON triagem_payments;

-- Cria triggers
CREATE TRIGGER payments_insert_update_total_spent
  AFTER INSERT ON triagem_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_total_spent_on_insert();

CREATE TRIGGER payments_update_update_total_spent
  AFTER UPDATE ON triagem_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_total_spent_on_update();

CREATE TRIGGER payments_delete_update_total_spent
  AFTER DELETE ON triagem_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_total_spent_on_delete();

-- Migração: Recalcula o total_spent de todos os clientes existentes
DO $$
DECLARE
  client_record RECORD;
  total_clients INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Iniciando recalculo de total_spent para todos os clientes...';

  FOR client_record IN 
    SELECT DISTINCT id FROM triagem_clients
  LOOP
    PERFORM recalculate_client_total_spent(client_record.id);
    total_clients := total_clients + 1;
  END LOOP;

  RAISE NOTICE '✅ Recalculo completo! % clientes atualizados', total_clients;
END $$;