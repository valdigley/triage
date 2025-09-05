/*
  # Adicionar configurações de logo e marca d'água

  1. Alterações na tabela settings
    - `studio_logo_url` (text) - URL da logo do estúdio
    - `watermark_enabled` (boolean) - Se marca d'água está ativa
    - `watermark_text` (text) - Texto da marca d'água
    - `watermark_opacity` (numeric) - Opacidade da marca d'água (0.1 a 1.0)
    - `watermark_position` (text) - Posição da marca d'água
    - `watermark_size` (text) - Tamanho da marca d'água

  2. Valores padrão
    - Marca d'água habilitada por padrão
    - Texto padrão "Preview"
    - Opacidade 0.7
    - Posição central
*/

-- Adicionar colunas para logo e marca d'água
DO $$
BEGIN
  -- Logo do estúdio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'studio_logo_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN studio_logo_url text;
  END IF;

  -- Configurações de marca d'água
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_enabled'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_text'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_text text DEFAULT 'Preview';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_opacity'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_opacity numeric(3,2) DEFAULT 0.70;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_position'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_position text DEFAULT 'center';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'watermark_size'
  ) THEN
    ALTER TABLE settings ADD COLUMN watermark_size text DEFAULT 'medium';
  END IF;
END $$;