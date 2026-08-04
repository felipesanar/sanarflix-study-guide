-- 20260804132000_get_gestor_diagnostico_temas_escopo_grande_area.sql
--
-- Corrige, em public.get_gestor_diagnostico_temas, os achados 2 e 11 da
-- revisão adversarial de 03/08.
--
-- ACHADO 2 (card Ordem 101): a checagem de feature usava
-- public.user_has_feature('gestao.portal_v2'), que resolve por bool_or sobre
-- TODAS as IES acessíveis ao usuário (get_accessible_ies) quando
-- users.id_ies é null -- o caso normal de gestor_grupo. Isso libera o drawer
-- de temas do portal v2 para uma IES do grupo com a flag desligada,
-- contanto que outra IES irmã a tenha ligada.
--
-- ACHADO 11 (card 115): a cascata do Diagnóstico Curricular identifica nó
-- por NOME, e get_gestor_diagnostico escopa a especialidade pela sua
-- grande_area de origem corretamente (ver `base` naquela função: filtra por
-- `r.grande_area = p_node`). Este drawer, porém, recebia só
-- `p_especialidade` e filtrava `q.especialidade = p_especialidade` sem
-- nenhum filtro de grande área. Se a mesma string de especialidade existe em
-- duas grandes áreas (nomenclatura de especialidade não é garantida única
-- entre grandes áreas), os temas somados vêm das DUAS e o percentual dos
-- temas deixa de bater com o percentual da especialidade mostrado um nível
-- acima na cascata.
--
-- CORREÇÃO: novo parâmetro `p_grande_area text DEFAULT NULL`, ADITIVO
-- (default NULL preserva a assinatura para quem já chama com 3 argumentos
-- nomeados via PostgREST -- ver "PENDÊNCIA DE FRONT" abaixo). Quando
-- informado, a soma de temas fica restrita à combinação
-- (grande_area, especialidade) exata que originou o nó na cascata; quando
-- NULL, mantém o comportamento anterior (ambíguo entre grandes áreas) até o
-- front passar a enviar o parâmetro -- ver pendência.
--
-- Como CREATE OR REPLACE não permite adicionar parâmetro a uma função
-- existente (mudaria a assinatura), o overload antigo de 3 parâmetros é
-- derrubado explicitamente ANTES do CREATE, para não deixar duas funções
-- `get_gestor_diagnostico_temas` coexistindo (o que tornaria uma chamada
-- nomeada com 3 argumentos AMBÍGUA entre o overload antigo e o novo com
-- default -- erro "function is not unique" em toda chamada do front).
--
-- PARTIU de supabase/migrations/20260729210500_get_gestor_diagnostico_temas.sql
-- (única migration desta função no repo; nasceu com o guard escrito direto
-- no corpo, então não está sujeita ao risco de guard-apagado-por-CREATE-OR-
-- REPLACE que existe nas 19 RPCs institucionais antigas). NENHUMA outra
-- lógica foi alterada: mesmo SECURITY DEFINER, SET search_path, STABLE,
-- guard de papel, obrigatoriedade de p_especialidade, chamada a
-- user_can_access_ies, fallback de v_ies, parsing de p_semestre, ordenação
-- (pior tema primeiro) e grants.
--
-- PENDÊNCIA DE FRONT (registrada, NÃO aplicada aqui -- este agente não edita
-- src/features/gestor/api/queries.ts, que é de outra frente):
--   `useDiagnosticoTemas` em queries.ts hoje chama
--   get_gestor_diagnostico_temas só com { p_ies_id, p_semestre,
--   p_especialidade }. Para o achado 11 fechar de ponta a ponta, o chamador
--   do drawer (o componente/hook que abre o drawer de temas a partir de um
--   nó da cascata de get_gestor_diagnostico) precisa passar também
--   `p_grande_area` com a `grande_area` do NÓ PAI que originou o clique --
--   o mesmo dado que já é usado hoje para montar a chamada de
--   get_gestor_diagnostico com p_node. Até essa mudança de front entrar,
--   p_grande_area chega NULL em toda chamada real e o comportamento
--   permanece o mesmo de antes desta migration (ambíguo entre grandes áreas
--   com especialidade de nome repetido).
--
-- EXIGÊNCIA ANTES DE APLICAR EM PRODUÇÃO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_diagnostico_temas(uuid, text, text)'::regprocedure);
-- e comparar com o corpo de 20260729210500 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes
-- de rodar este arquivo -- não sobrescrever um corpo que não foi conferido.

DROP FUNCTION IF EXISTS public.get_gestor_diagnostico_temas(uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text, p_grande_area text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_result  jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_especialidade IS NULL OR btrim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'especialidade_obrigatoria' USING ERRCODE = '22023';
  END IF;

  -- string vazia equivale a "grande área não informada" -- não é erro, é o
  -- mesmo caso de p_grande_area NULL (ver PENDÊNCIA DE FRONT acima).
  IF p_grande_area IS NOT NULL AND btrim(p_grande_area) = '' THEN
    p_grande_area := NULL;
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  WITH sims AS (
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  temas AS (
    SELECT q.tema AS nome,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(DISTINCT t.user_id) AS amostra
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.especialidade = p_especialidade
      -- achado 11: sem grande_area, a mesma especialidade em duas grandes
      -- áreas somaria temas das duas. NULL preserva o comportamento antigo
      -- até o front enviar o parâmetro (ver PENDÊNCIA DE FRONT no topo).
      AND (p_grande_area IS NULL OR q.grande_area = p_grande_area)
      AND q.tema IS NOT NULL
    GROUP BY q.tema
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        t.nome,
               'nome',      t.nome,
               'acertoPct', round(100.0 * t.acertos / NULLIF(t.total,0), 0),
               'amostra',   t.amostra,
               'lowSample', (t.amostra < 10)
             ) ORDER BY round(100.0 * t.acertos / NULLIF(t.total,0), 0) NULLS LAST, t.nome)
      FROM temas t), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Tema em %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Proficiência não se aplica a tema. Especialidade: %s. Grande área de origem: %s. Recorte: %s.', p_especialidade, COALESCE(p_grande_area, 'não informada pelo chamador — pode somar mais de uma grande área com esta especialidade'), v_recorte),
      'partial',      false,
      'lowSample',    COALESCE((SELECT max(t.amostra) FROM temas t), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO (rodar manualmente em gvqv, autenticado como o usuário gestor
-- de teste -- não como service_role, senão auth.uid()/has_role não valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_diagnostico_temas(uuid, text, text, text)'::regprocedure);
--
-- 2) Achado 2, em transação revertida (:ies_b = IES do grupo do gestor com
--    'gestao.portal_v2' DESLIGADA; :ies_a = IES irmã com a flag LIGADA;
--    :esp = uma especialidade existente):
--
--    BEGIN;
--      SELECT public.get_gestor_diagnostico_temas(:ies_b::uuid, 'geral', :esp, NULL);  -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_diagnostico_temas(:ies_a::uuid, 'geral', :esp, NULL);  -- esperado: retorna jsonb normalmente
--    ROLLBACK;
--
-- 3) Achado 11, em transação revertida: escolha (ou monte) duas grandes
--    áreas com uma especialidade de mesmo nome cadastrada nas duas, cada
--    uma com temas distintos e respostas de alunos da IES. Confira que:
--      a) SEM p_grande_area, a soma de temas mistura as duas grandes áreas
--         (comportamento antigo, preservado por compatibilidade);
--      b) COM p_grande_area apontando para uma das duas, `data` só traz os
--         temas daquela grande área, e a soma dos totais bate com o total
--         de respostas usado por get_gestor_diagnostico para aquele nó de
--         especialidade (mesmo p_node/mesma grande_area).
--    Compare também que a chamada antiga com 3 argumentos nomeados
--    (sem p_grande_area) continua funcionando após o DROP do overload --
--    ela deve resolver para o default NULL do novo parâmetro, não estourar
--    "function is not unique" nem "function does not exist".
