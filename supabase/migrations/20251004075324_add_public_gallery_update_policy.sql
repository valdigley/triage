/*
  # Permitir atualização de galerias públicas

  1. Security Changes
    - Adiciona policy para permitir que usuários anônimos atualizem galerias públicas
    - Permite UPDATE de campos de seleção (photos_selected, status, selection_submitted_at)
    - Restrição: apenas para galerias com is_public = true
*/

-- Drop policy se já existir
DROP POLICY IF EXISTS "Anyone can update public galleries selection" ON triagem_galleries;

-- Permitir que qualquer pessoa atualize seleção em galerias públicas
CREATE POLICY "Anyone can update public galleries selection"
  ON triagem_galleries
  FOR UPDATE
  TO anon, authenticated
  USING (is_public = true)
  WITH CHECK (is_public = true);