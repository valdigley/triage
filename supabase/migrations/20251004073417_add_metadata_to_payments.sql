/*
  # Adicionar coluna metadata à tabela de pagamentos

  1. Alterações
    - Adiciona coluna `metadata` (jsonb) à tabela `triagem_payments`
    - Permite armazenar dados adicionais do pagamento (fotos selecionadas, evento, etc)
*/

-- Adicionar coluna metadata se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_payments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE triagem_payments ADD COLUMN metadata jsonb;
  END IF;
END $$;
