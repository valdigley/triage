/*
  # Auto-preencher client_id nos pagamentos

  ## Descrição
  Cria triggers para preencher automaticamente o client_id nos pagamentos
  quando o pagamento é criado via appointment_id ou gallery_id.

  ## Mudanças

  1. **Função para preencher client_id automaticamente**
     - Se o pagamento tem appointment_id, busca o client_id do appointment
     - Se o pagamento tem gallery_id, busca o client_id da gallery
     - Preenche o client_id automaticamente antes de inserir/atualizar

  2. **Trigger BEFORE INSERT**
     - Preenche client_id antes de inserir um novo pagamento

  3. **Trigger BEFORE UPDATE**
     - Preenche client_id se appointment_id ou gallery_id mudarem

  4. **Script de correção**
     - Preenche client_id em todos os pagamentos existentes que não têm
*/

-- Função para preencher client_id automaticamente
CREATE OR REPLACE FUNCTION auto_populate_payment_client_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se já tem client_id, não faz nada
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta pegar do appointment_id
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT client_id INTO NEW.client_id
    FROM triagem_appointments
    WHERE id = NEW.appointment_id;
    
    IF NEW.client_id IS NOT NULL THEN
      RAISE NOTICE 'Client_id % preenchido via appointment_id', NEW.client_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Tenta pegar do gallery_id
  IF NEW.gallery_id IS NOT NULL THEN
    SELECT client_id INTO NEW.client_id
    FROM triagem_galleries
    WHERE id = NEW.gallery_id;
    
    IF NEW.client_id IS NOT NULL THEN
      RAISE NOTICE 'Client_id % preenchido via gallery_id', NEW.client_id;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS payments_auto_populate_client_id ON triagem_payments;

-- Cria trigger BEFORE INSERT e UPDATE
CREATE TRIGGER payments_auto_populate_client_id
  BEFORE INSERT OR UPDATE ON triagem_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_payment_client_id();

-- Corrige pagamentos existentes sem client_id
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Corrigindo pagamentos sem client_id...';

  -- Preencher via appointment_id
  UPDATE triagem_payments p
  SET client_id = a.client_id
  FROM triagem_appointments a
  WHERE p.appointment_id = a.id
    AND p.client_id IS NULL
    AND a.client_id IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % pagamentos atualizados via appointment_id', updated_count;

  -- Preencher via gallery_id
  UPDATE triagem_payments p
  SET client_id = g.client_id
  FROM triagem_galleries g
  WHERE p.gallery_id = g.id
    AND p.client_id IS NULL
    AND g.client_id IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % pagamentos atualizados via gallery_id', updated_count;
END $$;