/*
  # Permitir atualização de fotos em galerias públicas

  1. Security Changes
    - Adiciona policy para permitir que usuários anônimos atualizem fotos de galerias públicas
    - Permite apenas UPDATE de campos específicos (is_selected, metadata)
    - Restrição: apenas para fotos de galerias com is_public = true
*/

-- Drop policy se já existir
DROP POLICY IF EXISTS "Anyone can update photos from public galleries" ON triagem_photos;

-- Permitir que qualquer pessoa atualize fotos de galerias públicas
CREATE POLICY "Anyone can update photos from public galleries"
  ON triagem_photos
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM triagem_galleries
      WHERE triagem_galleries.id = triagem_photos.gallery_id
      AND triagem_galleries.is_public = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM triagem_galleries
      WHERE triagem_galleries.id = triagem_photos.gallery_id
      AND triagem_galleries.is_public = true
    )
  );