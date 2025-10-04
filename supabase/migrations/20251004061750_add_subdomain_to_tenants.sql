/*
  # Adicionar campo subdomain à tabela tenants

  1. Alterações
    - Adiciona coluna `subdomain` (text, unique) à tabela `triagem_tenants`
    - Gera subdomains automáticos baseados no nome do negócio para tenants existentes
    - Cria índice único para performance

  2. Notas
    - Subdomain será usado para URLs públicas de agendamento
    - Formato: nome-do-negocio-sem-espacos-lowercase
*/

-- Adicionar coluna subdomain
ALTER TABLE triagem_tenants 
ADD COLUMN IF NOT EXISTS subdomain text;

-- Gerar subdomains para tenants existentes (baseado no business_name)
DO $$
DECLARE
  tenant_record RECORD;
  generated_subdomain text;
  counter int;
BEGIN
  FOR tenant_record IN SELECT id, business_name, name FROM triagem_tenants WHERE subdomain IS NULL
  LOOP
    -- Gerar subdomain do business_name ou name
    generated_subdomain := lower(regexp_replace(
      COALESCE(tenant_record.business_name, tenant_record.name, 'studio'), 
      '[^a-zA-Z0-9]+', 
      '-', 
      'g'
    ));
    
    -- Remover hífens no início e fim
    generated_subdomain := trim(both '-' from generated_subdomain);
    
    -- Se já existe, adicionar sufixo numérico
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM triagem_tenants WHERE subdomain = generated_subdomain) LOOP
      generated_subdomain := lower(regexp_replace(
        COALESCE(tenant_record.business_name, tenant_record.name, 'studio'), 
        '[^a-zA-Z0-9]+', 
        '-', 
        'g'
      )) || '-' || counter;
      generated_subdomain := trim(both '-' from generated_subdomain);
      counter := counter + 1;
    END LOOP;
    
    -- Atualizar o tenant com o subdomain gerado
    UPDATE triagem_tenants 
    SET subdomain = generated_subdomain 
    WHERE id = tenant_record.id;
  END LOOP;
END $$;

-- Tornar subdomain obrigatório e único
ALTER TABLE triagem_tenants 
ALTER COLUMN subdomain SET NOT NULL;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS triagem_tenants_subdomain_key 
ON triagem_tenants(subdomain);
