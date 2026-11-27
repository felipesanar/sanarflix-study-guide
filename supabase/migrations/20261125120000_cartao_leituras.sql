-- Leitura de cartões-resposta pelo Academy.
--
-- Fluxo: o admin envia o PDF escaneado (bucket privado `cartoes-leitura`) e cria uma linha em
-- `cartao_leituras`; a edge function `cartao-leitura-iniciar` dispara o worker (GitHub Actions), que lê
-- o PDF com o pacote `services/cartao-omr` e devolve o resultado à edge function `cartao-leitura-worker`.
-- Essa grava uma linha por página em `cartao_leitura_paginas` (service role). Na tela de revisão, o admin
-- resolve as pendências (colunas *_manual, descartada) e importa pelo caminho de sempre
-- (`admin-import-simulado-responses`), guardando o lote em `import_batch_id`.
--
-- Acesso: só admin (has_role). O default ACL do projeto dá privilégio total a anon/authenticated em tabela
-- nova; por isso o REVOKE inclui `authenticated` e os GRANTs abaixo são explícitos.

CREATE TABLE IF NOT EXISTS public.cartao_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_bytes bigint,
  total_questoes integer NOT NULL CHECK (total_questoes BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado', 'processando', 'concluido', 'falhou', 'importado')),
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disparado_em timestamptz,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  github_run_url text,
  erro text,
  resumo jsonb,
  import_batch_id uuid REFERENCES public.admin_import_batches(id) ON DELETE SET NULL,
  importado_em timestamptz,
  CONSTRAINT cartao_leituras_arquivo_path_chk CHECK (arquivo_path = id::text || '/scan.pdf')
);

CREATE INDEX IF NOT EXISTS cartao_leituras_simulado_idx ON public.cartao_leituras(simulado_id);
CREATE INDEX IF NOT EXISTS cartao_leituras_created_at_idx ON public.cartao_leituras(created_at DESC);

CREATE TABLE IF NOT EXISTS public.cartao_leitura_paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leitura_id uuid NOT NULL REFERENCES public.cartao_leituras(id) ON DELETE CASCADE,
  pagina integer NOT NULL CHECK (pagina >= 1),
  destino text NOT NULL CHECK (destino IN ('respostas', 'nao_identificados', 'ignorada')),
  status text NOT NULL,
  layout text,
  identificacao text,
  via text,
  motivo text NOT NULL DEFAULT '',
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  duvidas jsonb NOT NULL DEFAULT '{}'::jsonb,
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  imagem text,
  -- revisão
  identificacao_manual text,
  respostas_manual jsonb NOT NULL DEFAULT '{}'::jsonb,
  descartada boolean NOT NULL DEFAULT false,
  revisado_por uuid,
  revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cartao_leitura_paginas_uniq UNIQUE (leitura_id, pagina)
);

-- updated_at
DROP TRIGGER IF EXISTS trg_cartao_leituras_updated_at ON public.cartao_leituras;
CREATE TRIGGER trg_cartao_leituras_updated_at
  BEFORE UPDATE ON public.cartao_leituras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------- privilégios e RLS
REVOKE ALL ON public.cartao_leituras FROM public, anon, authenticated;
REVOKE ALL ON public.cartao_leitura_paginas FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cartao_leituras TO authenticated;
GRANT SELECT ON public.cartao_leitura_paginas TO authenticated;
-- na página, o admin só mexe nos campos da revisão
GRANT UPDATE (identificacao_manual, respostas_manual, descartada, revisado_por, revisado_em)
  ON public.cartao_leitura_paginas TO authenticated;
GRANT ALL ON public.cartao_leituras, public.cartao_leitura_paginas TO service_role;

ALTER TABLE public.cartao_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartao_leitura_paginas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leem leituras de cartões" ON public.cartao_leituras;
CREATE POLICY "Admins leem leituras de cartões" ON public.cartao_leituras
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins criam leituras de cartões" ON public.cartao_leituras;
CREATE POLICY "Admins criam leituras de cartões" ON public.cartao_leituras
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND criado_por = auth.uid() AND status = 'enviado');

DROP POLICY IF EXISTS "Admins atualizam leituras de cartões" ON public.cartao_leituras;
CREATE POLICY "Admins atualizam leituras de cartões" ON public.cartao_leituras
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins leem páginas lidas" ON public.cartao_leitura_paginas;
CREATE POLICY "Admins leem páginas lidas" ON public.cartao_leitura_paginas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins revisam páginas lidas" ON public.cartao_leitura_paginas;
CREATE POLICY "Admins revisam páginas lidas" ON public.cartao_leitura_paginas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------- bucket privado
-- <leitura_id>/scan.pdf (enviado pelo admin) e <leitura_id>/recortes/*.png (enviados pelo worker via URL assinada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cartoes-leitura', 'cartoes-leitura', false, 209715200, ARRAY['application/pdf', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins enviam scans de cartões" ON storage.objects;
CREATE POLICY "Admins enviam scans de cartões" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cartoes-leitura' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins leem scans de cartões" ON storage.objects;
CREATE POLICY "Admins leem scans de cartões" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cartoes-leitura' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins substituem scans de cartões" ON storage.objects;
CREATE POLICY "Admins substituem scans de cartões" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cartoes-leitura' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'cartoes-leitura' AND public.has_role(auth.uid(), 'admin'::app_role));
