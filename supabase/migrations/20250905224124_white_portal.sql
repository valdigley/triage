/*
  # Atualizar total gasto dos clientes

  1. Função para calcular total gasto
    - Cria função que calcula total baseado em pagamentos aprovados
    - Soma apenas appointments com payment_status = 'approved'
  
  2. Trigger para atualização automática
    - Atualiza total_spent quando payment_status muda
    - Mantém dados sempre sincronizados
  
  3. Atualização inicial
    - Recalcula total_spent para todos os clientes existentes
*/

-- Função para calcular total gasto de um cliente
CREATE OR REPLACE FUNCTION calculate_client_total_spent(client_uuid uuid)
RETURNS numeric AS $$
DECLARE
  total_amount numeric := 0;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total_amount
  FROM appointments
  WHERE client_id = client_uuid 
    AND payment_status = 'approved';
  
  RETURN total_amount;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar total_spent do cliente
CREATE OR REPLACE FUNCTION update_client_total_spent()
RETURNS trigger AS $$
BEGIN
  -- Atualizar o cliente quando payment_status de um appointment mudar
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    UPDATE clients 
    SET total_spent = calculate_client_total_spent(NEW.client_id),
        updated_at = now()
    WHERE id = NEW.client_id;
  END IF;
  
  -- Atualizar o cliente quando um novo appointment for criado
  IF TG_OP = 'INSERT' THEN
    UPDATE clients 
    SET total_spent = calculate_client_total_spent(NEW.client_id),
        updated_at = now()
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar automaticamente
DROP TRIGGER IF EXISTS update_client_total_spent_trigger ON appointments;
CREATE TRIGGER update_client_total_spent_trigger
  AFTER INSERT OR UPDATE OF payment_status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_total_spent();

-- Atualizar total_spent para todos os clientes existentes
UPDATE clients 
SET total_spent = calculate_client_total_spent(id),
    updated_at = now();