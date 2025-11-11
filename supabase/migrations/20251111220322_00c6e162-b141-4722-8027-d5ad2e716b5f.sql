-- Criar bucket para arquivos do SanarClass
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sanarclass-files',
  'sanarclass-files',
  true,
  52428800, -- 50MB limite
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint']
);

-- Política para permitir que admins façam upload
CREATE POLICY "Admins can upload SanarClass files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sanarclass-files' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

-- Política para permitir que admins deletem arquivos
CREATE POLICY "Admins can delete SanarClass files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sanarclass-files' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

-- Política para permitir leitura pública dos arquivos
CREATE POLICY "Public can view SanarClass files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'sanarclass-files');