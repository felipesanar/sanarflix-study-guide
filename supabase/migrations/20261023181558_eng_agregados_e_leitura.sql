-- eng_agregados_e_leitura: tabelas de agregados aluno×dia + funções internas de leitura
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§5.4, §5.6, §7.4)

-- ============================================================
-- 1. Tabelas de agregados (§5.4)
-- ============================================================

-- 1 linha por aluno × dia com QUALQUER atividade
CREATE TABLE public.eng_atividade_aluno_dia (
  sanarflix_user_id  text    NOT NULL,
  dia                date    NOT NULL,
  respostas_todas    integer NOT NULL DEFAULT 0,  -- todas as respostas do dia, com ou sem classificação (só para "dia ativo")
  questoes           integer NOT NULL DEFAULT 0,  -- respostas de questões COM classificação principal (D3)
  acertos            integer NOT NULL DEFAULT 0,
  erros              integer NOT NULL DEFAULT 0,
  videos             integer NOT NULL DEFAULT 0,  -- consumos de vídeo no dia (= linhas de eng_consumo_aluno_dia_conteudo)
  documentos         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (sanarflix_user_id, dia),
  CONSTRAINT eng_aad_coerencia_ck CHECK (respostas_todas >= questoes AND questoes >= acertos + erros),
  CONSTRAINT eng_aad_atividade_ck CHECK (respostas_todas + videos + documentos > 0)
);
CREATE INDEX eng_atividade_aluno_dia_dia_idx ON public.eng_atividade_aluno_dia (dia);

-- 1 linha por aluno × dia × nó-folha (só questões classificadas)
CREATE TABLE public.eng_questoes_aluno_dia_no (
  sanarflix_user_id  text     NOT NULL,
  dia                date     NOT NULL,
  folha_id           text     NOT NULL,
  ciclo              text     NOT NULL,
  n1_id              text     NOT NULL,
  n2_id              text     NOT NULL,
  n3_id              text,
  esp_id             text     NOT NULL,
  questoes           integer  NOT NULL CHECK (questoes > 0),
  acertos            integer  NOT NULL,
  erros              integer  NOT NULL,
  PRIMARY KEY (sanarflix_user_id, dia, folha_id)
);
CREATE INDEX eng_questoes_aluno_dia_no_folha_idx ON public.eng_questoes_aluno_dia_no (folha_id, dia);

-- 1 linha por aluno × dia × conteúdo (D5); curso e módulo do 1º evento do dia
CREATE TABLE public.eng_consumo_aluno_dia_conteudo (
  sanarflix_user_id  text      NOT NULL,
  dia                date      NOT NULL,
  content_id         text      NOT NULL,
  content_type       text      NOT NULL CHECK (content_type IN ('video', 'document')),
  content_name       text      NOT NULL,
  especialidade      text      NOT NULL,   -- eng_rotulo_curso(course_name) | 'Outros conteúdos'
  modulo             text      NOT NULL,   -- módulo normalizado | 'Materiais gerais'
  aberturas          integer   NOT NULL CHECK (aberturas >= 1),
  ultima_abertura    timestamp NOT NULL,   -- UTC, como event_timestamp
  PRIMARY KEY (sanarflix_user_id, dia, content_id)
);
CREATE INDEX eng_consumo_aluno_dia_conteudo_arvore_idx ON public.eng_consumo_aluno_dia_conteudo (especialidade, modulo, content_id);

ALTER TABLE public.eng_atividade_aluno_dia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eng_questoes_aluno_dia_no      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eng_consumo_aluno_dia_conteudo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eng_atividade_aluno_dia        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eng_questoes_aluno_dia_no      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eng_consumo_aluno_dia_conteudo FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.eng_atividade_aluno_dia        IS 'Engajamento SanarFlix (spec 2026-10-22 §5.4): 1 linha por aluno × dia com qualquer atividade (derivada; reconstruída a cada refresh).';
COMMENT ON TABLE public.eng_questoes_aluno_dia_no      IS 'Engajamento SanarFlix (spec 2026-10-22 §5.4): questões classificadas por aluno × dia × nó-folha (derivada; reconstruída a cada refresh).';
COMMENT ON TABLE public.eng_consumo_aluno_dia_conteudo IS 'Engajamento SanarFlix (spec 2026-10-22 §5.4): consumo por aluno × dia × conteúdo (derivada; reconstruída a cada refresh).';

-- ============================================================
-- 2. Funções internas de leitura (§5.6, §7.4)
-- ============================================================

-- a base ativa (§0.1). p_ies NULL = rede inteira (só o admin usa)
CREATE OR REPLACE FUNCTION public.eng_base_ativa(p_ies uuid)
RETURNS TABLE (sanarflix_user_id text, id_ies uuid, nome text, email text, semestre smallint)
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT d.sanarflix_user_id, d.id_ies, btrim(d.nome), d.email_normalizado, d.semestre_atual
  FROM public.dim_aluno_b2b d
  WHERE (p_ies IS NULL OR d.id_ies = p_ies)
    AND lower(btrim(d.perfil)) = 'aluno'
    AND d.status_atual = 'ativo'
    AND d.semestre_atual BETWEEN 1 AND 12
$$;

-- a única definição das métricas por aluno
CREATE OR REPLACE FUNCTION public.eng_alunos_recorte(
  p_ies uuid, p_inicio date, p_fim date)
RETURNS TABLE (
  sanarflix_user_id   text,
  id_ies              uuid,
  nome                text,
  email               text,
  semestre            smallint,
  ultima_atividade    date,      -- todo o histórico, até hoje (D7)
  dias_sem_atividade  integer,   -- hoje − ultima_atividade; NULL = nunca
  dias_ativos_periodo integer,
  dias_ativos_30      integer,   -- [hoje−29, hoje]
  dias_ativos_mes_ref integer,   -- mês de referência do hábito (P4)
  questoes integer, acertos integer, erros integer, videos integer, documentos integer,
  dias_ativos_ant integer, questoes_ant integer, acertos_ant integer, erros_ant integer,
  videos_ant integer, documentos_ant integer,
  melhor_mes          date,      -- 1º dia do melhor mês no período (P5); NULL se não houve dia ativo no período
  melhor_mes_dias     integer,
  nivel               text,      -- frequente | esporadico | parou | nunca (§4.4)
  faixa_recencia      text       -- ativos30 | sumidos30a59 | sumidos60 | nunca_acessou (§4.1)
)
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  WITH par AS (
    SELECT public.eng_hoje() AS hoje,
           (p_fim - p_inicio + 1) AS n,
           CASE WHEN p_fim = (date_trunc('month', p_fim) + interval '1 month - 1 day')::date
                THEN date_trunc('month', p_fim)::date
                ELSE (date_trunc('month', p_fim) - interval '1 month')::date END AS mes_ref
  ),
  b AS (SELECT * FROM public.eng_base_ativa(p_ies)),
  ag AS (
    SELECT b.sanarflix_user_id,
      max(a.dia) FILTER (WHERE a.dia <= par.hoje)                                    AS ultima,
      count(a.dia) FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim)                  AS dias_per,
      count(a.dia) FILTER (WHERE a.dia BETWEEN par.hoje - 29 AND par.hoje)          AS d30,
      count(a.dia) FILTER (WHERE a.dia >= par.mes_ref
                             AND a.dia < (par.mes_ref + interval '1 month')::date)   AS d_mes_ref,
      coalesce(sum(a.questoes)   FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS q,
      coalesce(sum(a.acertos)    FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS ac,
      coalesce(sum(a.erros)      FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS er,
      coalesce(sum(a.videos)     FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS vi,
      coalesce(sum(a.documentos) FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS dc,
      count(a.dia) FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1)                     AS dias_ant,
      coalesce(sum(a.questoes)   FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS q_ant,
      coalesce(sum(a.acertos)    FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS ac_ant,
      coalesce(sum(a.erros)      FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS er_ant,
      coalesce(sum(a.videos)     FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS vi_ant,
      coalesce(sum(a.documentos) FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS dc_ant
    FROM b
    CROSS JOIN par
    LEFT JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = b.sanarflix_user_id
    GROUP BY b.sanarflix_user_id
  ),
  mm AS (
    SELECT DISTINCT ON (x.sanarflix_user_id) x.sanarflix_user_id, x.mes, x.dias
    FROM (
      SELECT a.sanarflix_user_id, date_trunc('month', a.dia)::date AS mes, count(*)::int AS dias
      FROM b JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = b.sanarflix_user_id
      WHERE a.dia BETWEEN p_inicio AND p_fim
      GROUP BY 1, 2
    ) x
    ORDER BY x.sanarflix_user_id, x.dias DESC, x.mes DESC
  )
  SELECT b.sanarflix_user_id, b.id_ies, b.nome, b.email, b.semestre,
    ag.ultima,
    (par.hoje - ag.ultima)::int,
    ag.dias_per::int, ag.d30::int, ag.d_mes_ref::int,
    ag.q::int, ag.ac::int, ag.er::int, ag.vi::int, ag.dc::int,
    ag.dias_ant::int, ag.q_ant::int, ag.ac_ant::int, ag.er_ant::int, ag.vi_ant::int, ag.dc_ant::int,
    mm.mes, coalesce(mm.dias, 0),
    CASE
      WHEN ag.ultima IS NOT NULL AND par.hoje - ag.ultima <= 29 AND ag.d30 >= 15 THEN 'frequente'
      WHEN ag.ultima IS NOT NULL AND par.hoje - ag.ultima <= 29                  THEN 'esporadico'
      WHEN coalesce(mm.dias, 0) >= 15                                            THEN 'parou'
      ELSE 'nunca'
    END,
    CASE
      WHEN ag.ultima IS NULL                THEN 'nunca_acessou'
      WHEN par.hoje - ag.ultima <= 29       THEN 'ativos30'
      WHEN par.hoje - ag.ultima <= 59       THEN 'sumidos30a59'
      ELSE 'sumidos60'
    END
  FROM b
  CROSS JOIN par
  JOIN ag ON ag.sanarflix_user_id = b.sanarflix_user_id
  LEFT JOIN mm ON mm.sanarflix_user_id = b.sanarflix_user_id
$$;

-- o que o aluno fez num dia (coluna "Última atividade" das listas da Visão geral)
CREATE OR REPLACE FUNCTION public.eng_detalhe_atividade(p_user text, p_dia date)
RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_dia IS NULL                THEN NULL
    WHEN q.nome IS NOT NULL           THEN jsonb_build_object('dia', p_dia, 'tipo', 'questoes',  'especialidade', q.nome)
    WHEN a.respostas_todas > 0        THEN jsonb_build_object('dia', p_dia, 'tipo', 'questoes',  'especialidade', NULL)
    WHEN c.content_type = 'video'     THEN jsonb_build_object('dia', p_dia, 'tipo', 'video',     'especialidade', c.especialidade)
    WHEN c.content_type = 'document'  THEN jsonb_build_object('dia', p_dia, 'tipo', 'documento', 'especialidade', c.especialidade)
  END
  FROM (SELECT 1) AS um
  LEFT JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = p_user AND a.dia = p_dia
  LEFT JOIN LATERAL (
    SELECT n.nome
    FROM public.eng_questoes_aluno_dia_no x
    JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
    WHERE x.sanarflix_user_id = p_user AND x.dia = p_dia
    GROUP BY n.nome
    ORDER BY sum(x.questoes) DESC, n.nome
    LIMIT 1
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT k.content_type, k.especialidade
    FROM public.eng_consumo_aluno_dia_conteudo k
    WHERE k.sanarflix_user_id = p_user AND k.dia = p_dia
    ORDER BY k.ultima_abertura DESC, k.content_id
    LIMIT 1
  ) c ON true
$$;

-- meta do envelope das RPCs (§7.4)
CREATE OR REPLACE FUNCTION public.eng_meta(p_inicio date, p_fim date, p_low boolean, p_criterio text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'periodo',      to_char(p_inicio, 'DD/MM/YYYY') || ' a ' || to_char(p_fim, 'DD/MM/YYYY'),
    'fonte',        'SanarFlix: dim_aluno_b2b · fato_consumo_conteudo_b2b · fato_resolucao_questoes_b2b (camada eng_*)',
    'atualizadoEm', public.eng_atualizado_em(),        -- ISO 8601 ou null
    'criterio',     p_criterio,
    'partial',      p_fim = public.eng_hoje(),
    'lowSample',    p_low
  )
$$;

-- ============================================================
-- 3. Grants das funções internas
-- ============================================================
REVOKE ALL ON FUNCTION public.eng_base_ativa(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_alunos_recorte(uuid, date, date)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_detalhe_atividade(text, date)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eng_meta(date, date, boolean, text)       FROM PUBLIC, anon, authenticated;
