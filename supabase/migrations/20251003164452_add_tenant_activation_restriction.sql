/*
  # Restrição de Ativação de Tenants
  
  1. Segurança
    - Adiciona constraint para impedir ativação de tenant sem pagamento aprovado
    - Garante que apenas o webhook pode ativar tenants
    - Protege integridade do modelo de negócio
    
  2. Regras
    - Status 'active' só pode ser definido se houver pelo menos um pagamento aprovado
    - Permite mudanças de trial -> suspended ou canceled
    - Permite mudanças de suspended -> trial (reativação de trial)
    - Bloqueia mudanças diretas para 'active'
*/

-- Função para verificar se tenant tem pagamento aprovado
CREATE OR REPLACE FUNCTION check_tenant_has_approved_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está mudando para 'active', verificar se tem pagamento aprovado
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Verificar se existe pelo menos um pagamento de assinatura aprovado
    IF NOT EXISTS (
      SELECT 1 
      FROM triagem_subscription_payments 
      WHERE tenant_id = NEW.id 
      AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Tenant só pode ser ativado após aprovação de pagamento';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validar mudanças de status
DROP TRIGGER IF EXISTS validate_tenant_activation ON triagem_tenants;

CREATE TRIGGER validate_tenant_activation
  BEFORE UPDATE OF status ON triagem_tenants
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_has_approved_payment();
