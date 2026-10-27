-- get_gestor_engajamento_lista: categorias das faixas de "Do acesso ao hábito"
-- (habito_baixo | habito_medio | habito_alto | habito_altissimo) e 'diasAtivosMes' em cada linha.
-- Mesma assinatura da função anterior (CREATE OR REPLACE basta). Os cortes de dias ativos no mês de
-- referência são os mesmos de get_gestor_engajamento_visao_geral (1–3, 4–7, 8–14, 15+), então a lista
-- de cada faixa tem exatamente o total que a barra mostra.

CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_lista(
  p_ies_id     uuid,
  p_inicio     date,
  p_fim        date,
  p_semestre   smallint DEFAULT NULL,
  p_aluno      text     DEFAULT NULL,
  p_categoria  text     DEFAULT 'sumidos30mais',
  p_busca      text     DEFAULT NULL,
  p_page       integer  DEFAULT 1,
  p_page_size  integer  DEFAULT 20
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
  v_desc      boolean;
  v_hab       boolean;
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
  IF p_semestre IS NOT NULL AND p_aluno IS NOT NULL THEN
    RAISE EXCEPTION 'filtro_conflitante' USING ERRCODE = '22023';
  END IF;
  IF p_aluno IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno) THEN
    RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023';
  END IF;

  IF p_categoria NOT IN ('frequente','esporadico','parou','nunca','ativos30','sumidos30a59','sumidos60','nunca_acessou','sumidos30mais',
                         'habito_baixo','habito_medio','habito_alto','habito_altissimo') THEN
    RAISE EXCEPTION 'categoria_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');
  v_desc  := p_categoria IN ('ativos30', 'sumidos30a59', 'sumidos60', 'sumidos30mais');
  v_hab   := p_categoria LIKE 'habito\_%';

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE WHEN v_hab  THEN -coalesce(x.dias_ativos_mes_ref, 0)          -- hábito: mais dias ativos no mês primeiro
                WHEN v_desc THEN -coalesce(x.dias_sem_atividade, -1)          -- desc, nulos por último
                ELSE coalesce(x.dias_sem_atividade, 2147483647) END AS chave  -- asc, nulos por último
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (p_aluno IS NULL OR x.sanarflix_user_id = p_aluno)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND CASE p_categoria
            WHEN 'sumidos30mais' THEN x.faixa_recencia IN ('sumidos30a59', 'sumidos60')
            WHEN 'ativos30'      THEN x.faixa_recencia = 'ativos30'
            WHEN 'sumidos30a59'  THEN x.faixa_recencia = 'sumidos30a59'
            WHEN 'sumidos60'     THEN x.faixa_recencia = 'sumidos60'
            WHEN 'nunca_acessou' THEN x.faixa_recencia = 'nunca_acessou'
            -- Faixas de "Do acesso ao hábito": mesmos cortes de get_gestor_engajamento_visao_geral (h1..h4)
            WHEN 'habito_baixo'     THEN x.dias_ativos_mes_ref BETWEEN 1 AND 3
            WHEN 'habito_medio'     THEN x.dias_ativos_mes_ref BETWEEN 4 AND 7
            WHEN 'habito_alto'      THEN x.dias_ativos_mes_ref BETWEEN 8 AND 14
            WHEN 'habito_altissimo' THEN x.dias_ativos_mes_ref >= 15
            ELSE x.nivel = p_categoria
          END
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (SELECT r.* FROM r ORDER BY r.chave, r.nome, r.sanarflix_user_id OFFSET (p_page - 1) * p_page_size LIMIT p_page_size)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'categoria', p_categoria,
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade,
          'diasAtivos30', pg.dias_ativos_30, 'diasAtivosMes', coalesce(pg.dias_ativos_mes_ref, 0),
          'melhorMes', to_char(pg.melhor_mes, 'YYYY-MM'), 'melhorMesDias', pg.melhor_mes_dias,
          'detalhe', public.eng_detalhe_atividade(pg.sanarflix_user_id, pg.ultima_atividade))
        ORDER BY pg.chave, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page, 'pageSize', p_page_size, 'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_lista(uuid, date, date, smallint, text, text, text, integer, integer) TO authenticated;
