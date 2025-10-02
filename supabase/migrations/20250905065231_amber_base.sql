/*
  # Trigger para criar galeria automaticamente

  1. Função
    - `create_gallery_for_confirmed_appointment()` - Cria galeria quando appointment é confirmado
  
  2. Trigger
    - Executa após UPDATE na tabela appointments
    - Verifica se status mudou para 'confirmed'
    - Cria galeria automaticamente se não existir
  
  3. Funcionalidades
    - Nome da galeria baseado no cliente e tipo de sessão
    - Token único gerado automaticamente
    - Data de expiração configurável (30 dias padrão)
    - Configurações de marca d'água padrão
*/

-- Função para criar galeria automaticamente
CREATE OR REPLACE FUNCTION create_gallery_for_confirmed_appointment()
RETURNS TRIGGER AS $$
DECLARE
  gallery_name TEXT;
  session_type_label TEXT;
  expiration_date TIMESTAMPTZ;
BEGIN
  -- Verifica se o status mudou para 'confirmed' e se não havia galeria antes
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Verifica se já existe uma galeria para este appointment
    IF NOT EXISTS (
      SELECT 1 FROM galleries_triage 
      WHERE appointment_id = NEW.id
    ) THEN
      
      -- Busca o nome do cliente
      SELECT c.name INTO gallery_name
      FROM clients c
      WHERE c.id = NEW.client_id;
      
      -- Busca o label do tipo de sessão
      SELECT st.label INTO session_type_label
      FROM session_types st
      WHERE st.name = NEW.session_type;
      
      -- Se não encontrou o label, usa o nome do tipo
      IF session_type_label IS NULL THEN
        session_type_label := NEW.session_type;
      END IF;
      
      -- Monta o nome da galeria
      gallery_name := COALESCE(gallery_name, 'Cliente') || ' - ' || session_type_label;
      
      -- Define data de expiração (30 dias a partir de agora)
      expiration_date := NOW() + INTERVAL '30 days';
      
      -- Cria a galeria
      INSERT INTO galleries_triage (
        appointment_id,
        name,
        gallery_token,
        status,
        photos_uploaded,
        photos_selected,
        selection_completed,
        link_expires_at,
        watermark_settings
      ) VALUES (
        NEW.id,
        gallery_name,
        encode(gen_random_bytes(16), 'hex'), -- Token único
        'pending',
        0,
        '{}',
        false,
        expiration_date,
        jsonb_build_object(
          'enabled', true,
          'text', 'Preview',
          'opacity', 0.7,
          'position', 'center'
        )
      );
      
      -- Log da criação (opcional)
      RAISE NOTICE 'Galeria criada automaticamente para appointment %: %', NEW.id, gallery_name;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger
DROP TRIGGER IF EXISTS auto_create_gallery_on_confirmation ON appointments;

CREATE TRIGGER auto_create_gallery_on_confirmation
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_gallery_for_confirmed_appointment();

-- Cria galerias para appointments já confirmados que não têm galeria
DO $$
DECLARE
  appointment_record RECORD;
  gallery_name TEXT;
  session_type_label TEXT;
  expiration_date TIMESTAMPTZ;
BEGIN
  -- Busca appointments confirmados sem galeria
  FOR appointment_record IN 
    SELECT a.*, c.name as client_name
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id
    LEFT JOIN galleries_triage gt ON gt.appointment_id = a.id
    WHERE a.status = 'confirmed' AND gt.id IS NULL
  LOOP
    
    -- Busca o label do tipo de sessão
    SELECT st.label INTO session_type_label
    FROM session_types st
    WHERE st.name = appointment_record.session_type;
    
    -- Se não encontrou o label, usa o nome do tipo
    IF session_type_label IS NULL THEN
      session_type_label := appointment_record.session_type;
    END IF;
    
    -- Monta o nome da galeria
    gallery_name := COALESCE(appointment_record.client_name, 'Cliente') || ' - ' || session_type_label;
    
    -- Define data de expiração (30 dias a partir de agora)
    expiration_date := NOW() + INTERVAL '30 days';
    
    -- Cria a galeria
    INSERT INTO galleries_triage (
      appointment_id,
      name,
      gallery_token,
      status,
      photos_uploaded,
      photos_selected,
      selection_completed,
      link_expires_at,
      watermark_settings
    ) VALUES (
      appointment_record.id,
      gallery_name,
      encode(gen_random_bytes(16), 'hex'),
      'pending',
      0,
      '{}',
      false,
      expiration_date,
      jsonb_build_object(
        'enabled', true,
        'text', 'Preview',
        'opacity', 0.7,
        'position', 'center'
      )
    );
    
    RAISE NOTICE 'Galeria criada retroativamente para appointment %: %', appointment_record.id, gallery_name;
    
  END LOOP;
END $$;