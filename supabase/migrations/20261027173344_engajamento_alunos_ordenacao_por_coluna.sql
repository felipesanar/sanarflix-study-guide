-- get_gestor_engajamento_alunos / _export_alunos: ordenação por qualquer coluna da tabela "Por aluno"
-- A aba (Questões | Vídeos | Documentos) deixou de ordenar a tabela: ela só realça colunas.
-- A ordem passa a vir do clique no cabeçalho, então as duas RPCs ganham `p_direcao` e `p_ordem`
-- aceita todas as colunas. Mudar a assinatura cria outra função (overload) e o PostgREST não
-- escolhe entre as duas — por isso o DROP das antigas antes do CREATE.
--
-- p_ordem:   nome | semestre | questoes | acerto | videos | documentos | ultima_atividade
-- p_direcao: asc | desc. Em 'ultima_atividade', desc = mais recente primeiro.
-- Valor nulo (acerto sem questão, aluno que nunca acessou) vai sempre para o fim.

DROP FUNCTION IF EXISTS public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean);

-- ============================================================
-- §8.2 get_gestor_engajamento_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false,
  p_page               integer  DEFAULT 1,
  p_page_size          integer  DEFAULT 20,
  p_direcao            text     DEFAULT 'desc'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_busca     text;
  v_desc      boolean := p_direcao = 'desc';
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('nome', 'semestre', 'questoes', 'acerto', 'videos', 'documentos', 'ultima_atividade') THEN
    RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_direcao IS NULL OR p_direcao NOT IN ('asc', 'desc') THEN RAISE EXCEPTION 'direcao_invalida' USING ERRCODE = '22023'; END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           -- chave numérica já com o sinal da direção (desc = negativo); nome usa as duas colunas de texto
           CASE WHEN p_ordem = 'nome' THEN NULL ELSE
             (CASE WHEN v_desc THEN -1 ELSE 1 END) * CASE p_ordem
               WHEN 'semestre'         THEN x.semestre::numeric
               WHEN 'questoes'         THEN x.questoes::numeric
               WHEN 'acerto'           THEN public.eng_pct(x.acertos, x.acertos + x.erros)::numeric
               WHEN 'videos'           THEN x.videos::numeric
               WHEN 'documentos'       THEN x.documentos::numeric
               ELSE -x.dias_sem_atividade::numeric   -- ultima_atividade: mais recente = menos dias
             END
           END AS chave_num,
           CASE WHEN p_ordem = 'nome' AND NOT v_desc THEN x.nome END AS chave_asc,
           CASE WHEN p_ordem = 'nome' AND v_desc THEN x.nome END AS chave_desc
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (
    SELECT r.*, row_number() OVER (ORDER BY r.chave_num NULLS LAST, r.chave_asc, r.chave_desc DESC, r.nome, r.sanarflix_user_id) AS rn
    FROM r
    ORDER BY rn
    OFFSET (p_page - 1) * p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'questoes', pg.questoes, 'acertoPct', public.eng_pct(pg.acertos, pg.acertos + pg.erros),
          'videos', pg.videos, 'documentos', pg.documentos,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade)
        ORDER BY pg.rn) FROM pg), '[]'::jsonb),
      'page', p_page,
      'pageSize', p_page_size,
      'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_alunos(uuid, date, date, smallint, text, text, boolean, integer, integer, text) TO authenticated;

-- ============================================================
-- §8.9 get_gestor_engajamento_export_alunos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_export_alunos(
  p_ies_id             uuid,
  p_inicio             date,
  p_fim                date,
  p_semestre           smallint DEFAULT NULL,
  p_ordem              text     DEFAULT 'questoes',
  p_busca              text     DEFAULT NULL,
  p_sem_atividade_14d  boolean  DEFAULT false,
  p_direcao            text     DEFAULT 'desc'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_busca     text;
  v_desc      boolean := p_direcao = 'desc';
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ordem NOT IN ('nome', 'semestre', 'questoes', 'acerto', 'videos', 'documentos', 'ultima_atividade') THEN
    RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_direcao IS NULL OR p_direcao NOT IN ('asc', 'desc') THEN RAISE EXCEPTION 'direcao_invalida' USING ERRCODE = '22023'; END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS (
    SELECT x.*,
           CASE WHEN p_ordem = 'nome' THEN NULL ELSE
             (CASE WHEN v_desc THEN -1 ELSE 1 END) * CASE p_ordem
               WHEN 'semestre'         THEN x.semestre::numeric
               WHEN 'questoes'         THEN x.questoes::numeric
               WHEN 'acerto'           THEN public.eng_pct(x.acertos, x.acertos + x.erros)::numeric
               WHEN 'videos'           THEN x.videos::numeric
               WHEN 'documentos'       THEN x.documentos::numeric
               ELSE -x.dias_sem_atividade::numeric
             END
           END AS chave_num,
           CASE WHEN p_ordem = 'nome' AND NOT v_desc THEN x.nome END AS chave_asc,
           CASE WHEN p_ordem = 'nome' AND v_desc THEN x.nome END AS chave_desc
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'nome', r.nome, 'email', r.email, 'semestre', r.semestre,
          'questoes', r.questoes, 'acertoPct', public.eng_pct(r.acertos, r.acertos + r.erros),
          'videos', r.videos, 'documentos', r.documentos,
          'ultimaAtividade', r.ultima_atividade, 'diasSemAtividade', r.dias_sem_atividade)
        ORDER BY r.chave_num NULLS LAST, r.chave_asc, r.chave_desc DESC, r.nome, r.sanarflix_user_id) FROM r), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_export_alunos(uuid, date, date, smallint, text, text, boolean, text) TO authenticated;
