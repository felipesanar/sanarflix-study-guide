-- Leitura de cartões: limpeza do Storage.
--
-- O PDF e as imagens da revisão só servem até a importação. Depois dela, o front apaga os arquivos da
-- leitura (`<leitura>/...` no bucket `cartoes-leitura`) e marca `arquivos_apagados_em`; a linha da leitura e as
-- páginas ficam como histórico. O admin também pode excluir uma leitura inteira (PDF enviado por engano,
-- leitura abandonada), menos enquanto o worker está lendo.
--
-- As imagens de página inteira passam a ser JPEG (cerca de 5x menores que PNG).

ALTER TABLE public.cartao_leituras ADD COLUMN IF NOT EXISTS arquivos_apagados_em timestamptz;

-- excluir leitura (as páginas vão junto pelo ON DELETE CASCADE)
GRANT DELETE ON public.cartao_leituras TO authenticated;

DROP POLICY IF EXISTS "Admins excluem leituras de cartões" ON public.cartao_leituras;
CREATE POLICY "Admins excluem leituras de cartões" ON public.cartao_leituras
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND status <> 'processando');

-- apagar arquivos do bucket
DROP POLICY IF EXISTS "Admins apagam scans de cartões" ON storage.objects;
CREATE POLICY "Admins apagam scans de cartões" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cartoes-leitura' AND public.has_role(auth.uid(), 'admin'::app_role));

UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg']
  WHERE id = 'cartoes-leitura';
