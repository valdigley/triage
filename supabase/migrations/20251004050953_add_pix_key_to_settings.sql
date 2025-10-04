/*
  # Adicionar chave PIX manual às configurações

  1. Alterações
    - Adiciona coluna `pix_key` na tabela `triagem_settings`
    - Permite que tenants configurem uma chave PIX manual
    - Será usada como fallback quando Mercado Pago não estiver configurado

  2. Notas
    - Campo opcional (pode ser NULL)
    - Usado para envio via WhatsApp quando não há integração automática
    - Suporta qualquer tipo de chave PIX (CPF, CNPJ, email, telefone, chave aleatória)
*/

-- Adicionar coluna pix_key à tabela triagem_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'triagem_settings' AND column_name = 'pix_key'
  ) THEN
    ALTER TABLE triagem_settings ADD COLUMN pix_key text;
    
    COMMENT ON COLUMN triagem_settings.pix_key IS 'Chave PIX manual para recebimento de pagamentos (fallback quando Mercado Pago não configurado)';
  END IF;
END $$;