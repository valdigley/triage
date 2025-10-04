/*
  # Adicionar campos WhatsApp/Evolution para tenants

  1. Alterações na tabela triagem_tenants
    - whatsapp_number: número de WhatsApp para enviar notificações
  
  2. Alterações na tabela triagem_settings
    - evolution_instance_name: nome da instância criada no Evolution
    - evolution_instance_apikey: API key da instância específica do tenant
    - whatsapp_connected: status da conexão WhatsApp
    - whatsapp_qrcode: QR code para conexão (se disponível)
*/

-- Adicionar whatsapp_number aos tenants
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_tenants' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE triagem_tenants ADD COLUMN whatsapp_number text;
    
    -- Copiar phone para whatsapp_number
    UPDATE triagem_tenants 
    SET whatsapp_number = phone 
    WHERE whatsapp_number IS NULL AND phone IS NOT NULL;
  END IF;
END $$;

-- Adicionar campos Evolution às configurações do tenant
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_settings' AND column_name = 'evolution_instance_name'
  ) THEN
    ALTER TABLE triagem_settings ADD COLUMN evolution_instance_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_settings' AND column_name = 'evolution_instance_apikey'
  ) THEN
    ALTER TABLE triagem_settings ADD COLUMN evolution_instance_apikey text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_settings' AND column_name = 'whatsapp_connected'
  ) THEN
    ALTER TABLE triagem_settings ADD COLUMN whatsapp_connected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'triagem_settings' AND column_name = 'whatsapp_qrcode'
  ) THEN
    ALTER TABLE triagem_settings ADD COLUMN whatsapp_qrcode text;
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN triagem_tenants.whatsapp_number IS 'Número WhatsApp para enviar notificações ao tenant';
COMMENT ON COLUMN triagem_settings.evolution_instance_name IS 'Nome da instância Evolution criada para este tenant';
COMMENT ON COLUMN triagem_settings.evolution_instance_apikey IS 'API Key da instância Evolution específica do tenant';
COMMENT ON COLUMN triagem_settings.whatsapp_connected IS 'Status de conexão WhatsApp da instância';
COMMENT ON COLUMN triagem_settings.whatsapp_qrcode IS 'QR code para conectar WhatsApp';
