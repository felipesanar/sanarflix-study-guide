-- Cria o bucket `imagensSimulado` usado pela edge function admin-upload-simulado-images.
-- Idempotente: se já existir (criado manualmente no dashboard), apenas reforça o config
-- e garante as políticas de RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imagensSimulado',
  'imagensSimulado',
  true,
  10485760, -- 10MB por arquivo (imagens de questões são pequenas; compressBase64Image já reduz)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Upload/delete: apenas admins (a edge function usa service role e bypassa RLS, mas
-- mantemos a política para defesa em profundidade caso alguém chame storage direto).
DROP POLICY IF EXISTS "Admins podem fazer upload de imagens de simulado" ON storage.objects;
CREATE POLICY "Admins podem fazer upload de imagens de simulado"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'imagensSimulado' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins podem atualizar imagens de simulado" ON storage.objects;
CREATE POLICY "Admins podem atualizar imagens de simulado"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'imagensSimulado' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins podem deletar imagens de simulado" ON storage.objects;
CREATE POLICY "Admins podem deletar imagens de simulado"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'imagensSimulado' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

-- Leitura pública: bucket é `public = true`, então qualquer visitante acessa via URL.
-- Mesmo assim declaramos a política para deixar explícito o contrato.
DROP POLICY IF EXISTS "Imagens de simulado são públicas" ON storage.objects;
CREATE POLICY "Imagens de simulado são públicas"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'imagensSimulado');
