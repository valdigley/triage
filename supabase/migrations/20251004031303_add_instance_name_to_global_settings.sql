/*
  # Adicionar instance_name à tabela global_settings

  1. Alterações
    - Adicionar coluna instance_name à tabela global_settings
    - Essa é a configuração Evolution do admin que será usada para enviar notificações aos tenants
*/

-- Adicionar coluna instance_name se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'global_settings' AND column_name = 'instance_name'
  ) THEN
    ALTER TABLE global_settings ADD COLUMN instance_name text;
  END IF;
END $$;

-- Comentário
COMMENT ON COLUMN global_settings.instance_name IS 'Nome da instância Evolution API do admin para enviar notificações aos tenants';
