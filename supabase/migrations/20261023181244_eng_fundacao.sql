-- eng_fundacao: funções auxiliares puras + tabelas de taxonomia, classificação, de-para e log
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§5.1–§5.3, §5.5, §5.6)

-- ============================================================
-- 1. Funções auxiliares (§5.6)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_hoje() RETURNS date
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- rótulo de especialidade para COMPARAÇÃO: sem sufixo final "(…)", espaços normalizados, minúsculo
CREATE OR REPLACE FUNCTION public.eng_norm_rotulo(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(lower(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s*\([^)]*\)\s*$', ''), '\s+', ' ', 'g'))), '') $$;

-- texto genérico para COMPARAÇÃO: espaços normalizados, minúsculo
CREATE OR REPLACE FUNCTION public.eng_norm_texto(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))), '') $$;

-- rótulo de curso para EXIBIÇÃO (D6): sem sufixo final "(…)", espaços normalizados, caixa original
CREATE OR REPLACE FUNCTION public.eng_rotulo_curso(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s*\([^)]*\)\s*$', ''), '\s+', ' ', 'g')), '') $$;

-- busca sem acento e sem caixa (não há a extensão unaccent no projeto)
CREATE OR REPLACE FUNCTION public.eng_norm_busca(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT lower(translate(coalesce(p, ''),
  'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
  'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy')) $$;

-- percentual com 1 casa; NULL quando o denominador é 0
CREATE OR REPLACE FUNCTION public.eng_pct(n numeric, d numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT CASE WHEN d > 0 THEN round(100.0 * n / d, 1) END $$;

-- razão com 1 casa; NULL quando o denominador é 0
CREATE OR REPLACE FUNCTION public.eng_razao(n numeric, d numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT CASE WHEN d > 0 THEN round(n / d, 1) END $$;

CREATE OR REPLACE FUNCTION public.eng_validar_periodo(p_inicio date, p_fim date) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio > p_fim
     OR p_inicio < DATE '2025-01-01' OR p_fim > public.eng_hoje() OR p_fim - p_inicio > 730 THEN
    RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
  END IF;
END $$;

-- ============================================================
-- 2. Tabelas
-- ============================================================

-- 5.1 nós da árvore de questões
CREATE TABLE public.eng_no_taxonomia (
  no_id         text PRIMARY KEY,
  nivel         smallint NOT NULL CHECK (nivel IN (1, 2, 3)),
  ciclo         text NOT NULL CHECK (ciclo IN ('clinico', 'basico')),
  nome          text NOT NULL CHECK (btrim(nome) <> ''),
  pai_id        text REFERENCES public.eng_no_taxonomia (no_id),
  sintetico     boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eng_no_taxonomia_pai_ck CHECK ((nivel = 1) = (pai_id IS NULL)),
  CONSTRAINT eng_no_taxonomia_nivel_ciclo_ck CHECK (ciclo = 'clinico' OR nivel IN (1, 2))
);
CREATE INDEX eng_no_taxonomia_pai_idx ON public.eng_no_taxonomia (pai_id);

-- 5.2 classificação principal (1 linha por questão classificada)
CREATE TABLE public.eng_questao_classificacao (
  question_id        text PRIMARY KEY,
  ciclo              text NOT NULL CHECK (ciclo IN ('clinico', 'basico')),
  n1_id              text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  n2_id              text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  n3_id              text REFERENCES public.eng_no_taxonomia (no_id),
  folha_id           text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  esp_id             text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  origem             text NOT NULL CHECK (origem IN ('taxonomia', 'depara')),
  motivo             text NOT NULL CHECK (motivo IN ('unica', 'completa', 'quiz', 'primeira', 'depara')),
  n_candidatas       smallint NOT NULL,
  posicao_escolhida  smallint,
  classificado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eng_qc_n3_ck     CHECK ((ciclo = 'clinico') = (n3_id IS NOT NULL)),
  CONSTRAINT eng_qc_folha_ck  CHECK (folha_id = COALESCE(n3_id, n2_id)),
  CONSTRAINT eng_qc_esp_ck    CHECK (esp_id = CASE WHEN ciclo = 'clinico' THEN n2_id ELSE n1_id END),
  CONSTRAINT eng_qc_origem_ck CHECK ((origem = 'depara') = (motivo = 'depara')),
  CONSTRAINT eng_qc_pos_ck    CHECK ((origem = 'taxonomia') = (posicao_escolhida IS NOT NULL))
);
CREATE INDEX eng_questao_classificacao_folha_idx ON public.eng_questao_classificacao (folha_id);

-- 5.3 de-para curado (nasce vazio)
CREATE TABLE public.eng_depara_quiz_no (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_especialidade_norm  text NOT NULL CHECK (quiz_especialidade_norm = public.eng_norm_rotulo(quiz_especialidade_norm)),
  conteudo_caminho_norm    text CHECK (conteudo_caminho_norm IS NULL OR conteudo_caminho_norm = public.eng_norm_texto(conteudo_caminho_norm)),
  folha_id                 text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  observacao               text,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  criado_por               text NOT NULL,
  CONSTRAINT eng_depara_chave_uk UNIQUE NULLS NOT DISTINCT (quiz_especialidade_norm, conteudo_caminho_norm)
);

-- 5.5 controle do pipeline
CREATE TABLE public.eng_refresh_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iniciado_em   timestamptz NOT NULL DEFAULT clock_timestamp(),
  terminado_em  timestamptz,
  status        text NOT NULL CHECK (status IN ('rodando', 'ok', 'erro')),
  disparo       text NOT NULL CHECK (disparo IN ('cron', 'manual')),
  contagens     jsonb,
  erro          text
);
CREATE INDEX eng_refresh_log_ok_idx ON public.eng_refresh_log (terminado_em DESC) WHERE status = 'ok';

-- ============================================================
-- 3. Função que depende de eng_refresh_log (§5.6)
-- ============================================================
-- última atualização com sucesso (D16); NULL se o pipeline nunca rodou
CREATE OR REPLACE FUNCTION public.eng_atualizado_em() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT max(terminado_em) FROM public.eng_refresh_log WHERE status = 'ok' $$;

-- ============================================================
-- 4. Grants das tabelas: RLS sem policy + revoke total (o default ACL do Supabase dá tudo a anon/authenticated)
-- ============================================================
ALTER TABLE public.eng_no_taxonomia          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eng_questao_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eng_depara_quiz_no        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eng_refresh_log           ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eng_no_taxonomia          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eng_questao_classificacao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eng_depara_quiz_no        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eng_refresh_log           FROM PUBLIC, anon, authenticated;

REVOKE ALL ON SEQUENCE public.eng_depara_quiz_no_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.eng_refresh_log_id_seq    FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 5. Grants das funções internas
-- ============================================================
REVOKE ALL ON FUNCTION public.eng_hoje()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_norm_rotulo(text)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_norm_texto(text)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_rotulo_curso(text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_norm_busca(text)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_pct(numeric, numeric)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_razao(numeric, numeric)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_validar_periodo(date, date)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_atualizado_em()                 FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 6. Comentários
-- ============================================================
COMMENT ON TABLE public.eng_no_taxonomia          IS 'Engajamento SanarFlix (spec 2026-10-22 §5.1): nós da árvore de questões (derivada; upsert pelo eng_refresh_classificacao).';
COMMENT ON TABLE public.eng_questao_classificacao IS 'Engajamento SanarFlix (spec 2026-10-22 §5.2): classificação principal por questão (derivada; reconstruída a cada refresh).';
COMMENT ON TABLE public.eng_depara_quiz_no        IS 'Engajamento SanarFlix (spec 2026-10-22 §5.3): de-para curado quiz_especialidade -> nó-folha; nasce vazio, preenchido fora do escopo da entrega.';
COMMENT ON TABLE public.eng_refresh_log           IS 'Engajamento SanarFlix (spec 2026-10-22 §5.5): log de execuções do pipeline eng_refresh.';
