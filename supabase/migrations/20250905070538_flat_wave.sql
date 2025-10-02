/*
  # Criar bucket de storage para fotos

  1. Storage
    - Criar bucket 'photos' para armazenar fotos das galerias
    - Configurar políticas de acesso público para visualização
    - Permitir upload apenas para usuários autenticados

  2. Políticas
    - Leitura pública para todas as fotos
    - Upload apenas para usuários autenticados
    - Exclusão apenas para usuários autenticados
*/

-- Criar bucket para fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Política para permitir leitura pública
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Política para permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir exclusão por usuários autenticados
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir atualização por usuários autenticados
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);