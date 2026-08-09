-- A2: get_gestor_questoes ganha p_semestre + imagens da questão; nova RPC
-- get_gestor_questao_respondentes. SQL exato aplicado em produção
-- (gvqvrmkizemwsasmupmo) em 09/08.
--
-- ============================================================================
-- PARTE 1: get_gestor_questoes -- filtro de semestre + imagens
-- ============================================================================
--
-- Patch textual sobre a definição VIVA (mesmo motivo documentado em
-- 20260807194927_...sql: Lovable empurra código pra produção várias vezes ao
-- dia, "a base certa" é alvo movel). Cada trecho é conferido por
-- position()/contagem antes de aplicar -- aborta se o alvo não aparecer
-- exatamente uma vez. O trecho do bloco final (chaves imagemEnunciado*) usa
-- regexp_replace porque a linha-alvo tem espaçamento de alinhamento (colunas
-- do jsonb_build_object) que não vale a pena reproduzir byte a byte.
DO $patch$
DECLARE
  v_oid    oid;
  v_qtd    int;
  v_def    text;
  v_o1     text;
  v_n1     text;
  v_o2     text;
  v_n2     text;
  v_o3     text;
  v_n3     text;
  v_o4     text;
  v_n4     text;
  v_o5     text;
  v_n5     text;
  v_pat6   text;
  v_rep6   text;
BEGIN
  SELECT count(*), min(p.oid) INTO v_qtd, v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_gestor_questoes';

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'get_gestor_questoes_ausente';
  END IF;
  IF v_qtd > 1 THEN
    RAISE EXCEPTION 'get_gestor_questoes_sobrecarregada: % assinaturas', v_qtd;
  END IF;

  v_def := pg_get_functiondef(v_oid);

  -- 1) assinatura: novo parâmetro ao final, com DEFAULT NULL.
  v_o1 := $o1$CREATE OR REPLACE FUNCTION public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page integer, p_page_size integer, p_sort text, p_area text)
 RETURNS jsonb$o1$;
  v_n1 := $n1$CREATE OR REPLACE FUNCTION public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page integer, p_page_size integer, p_sort text, p_area text, p_semestre text DEFAULT NULL)
 RETURNS jsonb$n1$;

  -- 2) DECLARE: nova variável v_sems.
  v_o2 := $o2$  v_aberta boolean;
  v_result jsonb;$o2$;
  v_n2 := $n2$  v_aberta boolean;
  v_sems   int[];
  v_result jsonb;$n2$;

  -- 3) resolução de v_sems a partir de p_semestre, mesmo padrão de
  --    get_gestor_alunos/get_gestor_diagnostico, logo após a autorização de IES.
  v_o3 := $o3$  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;$o3$;
  v_n3 := $n3$  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL;
  ELSIF p_semestre = '6ano' THEN
    v_sems := ARRAY[11,12];
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int];
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;$n3$;

  -- 4) filtra a população de alunos (a mesma usada para acertoPct/amostra
  --    de cada questão) pelo recorte de semestre.
  v_o4 := $o4$  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),$o4$;
  v_n4 := $n4$  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),$n4$;

  -- 5) traz as 3 colunas de imagem pra dentro de q_base (o resto do SELECT
  --    list de q_base fica intocado -- ancorando em q.alternativa_e evita
  --    depender de espaçamento de alinhamento das colunas anteriores).
  v_o5 := $o5$q.alternativa_e
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)$o5$;
  v_n5 := $n5$q.alternativa_e,
           q.imagem AS imagem_enunciado, q.imagem_2 AS imagem_enunciado_2, q.imagem_comentario
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)$n5$;

  IF position(v_o1 IN v_def) = 0 THEN RAISE EXCEPTION 'alvo_nao_encontrado: 1 (assinatura)'; END IF;
  IF (length(v_def) - length(replace(v_def, v_o1, ''))) / length(v_o1) <> 1 THEN RAISE EXCEPTION 'alvo_ambiguo: 1'; END IF;
  v_def := replace(v_def, v_o1, v_n1);

  IF position(v_o2 IN v_def) = 0 THEN RAISE EXCEPTION 'alvo_nao_encontrado: 2 (declare)'; END IF;
  IF (length(v_def) - length(replace(v_def, v_o2, ''))) / length(v_o2) <> 1 THEN RAISE EXCEPTION 'alvo_ambiguo: 2'; END IF;
  v_def := replace(v_def, v_o2, v_n2);

  IF position(v_o3 IN v_def) = 0 THEN RAISE EXCEPTION 'alvo_nao_encontrado: 3 (resolucao semestre)'; END IF;
  IF (length(v_def) - length(replace(v_def, v_o3, ''))) / length(v_o3) <> 1 THEN RAISE EXCEPTION 'alvo_ambiguo: 3'; END IF;
  v_def := replace(v_def, v_o3, v_n3);

  IF position(v_o4 IN v_def) = 0 THEN RAISE EXCEPTION 'alvo_nao_encontrado: 4 (alunos cte)'; END IF;
  IF (length(v_def) - length(replace(v_def, v_o4, ''))) / length(v_o4) <> 1 THEN RAISE EXCEPTION 'alvo_ambiguo: 4'; END IF;
  v_def := replace(v_def, v_o4, v_n4);

  IF position(v_o5 IN v_def) = 0 THEN RAISE EXCEPTION 'alvo_nao_encontrado: 5 (q_base imagens)'; END IF;
  IF (length(v_def) - length(replace(v_def, v_o5, ''))) / length(v_o5) <> 1 THEN RAISE EXCEPTION 'alvo_ambiguo: 5'; END IF;
  v_def := replace(v_def, v_o5, v_n5);

  -- 6) expõe imagemEnunciado/imagemEnunciado2/imagemComentario no JSON de
  --    cada questão. imagemComentario segue o mesmo tratamento de
  --    correta/distratorDominante: null enquanto o simulado está aberto
  --    (não expõe imagem de gabarito antes do encerramento). Via regex
  --    porque a linha-alvo tem espaçamento de alinhamento das chaves do
  --    jsonb_build_object.
  v_pat6 := $pat6$('enunciado',\s*o\.enunciado,\n)$pat6$;
  v_rep6 := $rep6$\1                 'imagemEnunciado',    o.imagem_enunciado,
                 'imagemEnunciado2',   o.imagem_enunciado_2,
                 'imagemComentario',   CASE WHEN v_aberta THEN NULL ELSE o.imagem_comentario END,
$rep6$;

  IF (SELECT count(*) FROM regexp_matches(v_def, v_pat6, 'g')) <> 1 THEN
    RAISE EXCEPTION 'alvo_ambiguo_ou_ausente: 6 (jsonb imagens)';
  END IF;
  v_def := regexp_replace(v_def, v_pat6, v_rep6);

  EXECUTE v_def;
  RAISE NOTICE 'get_gestor_questoes: filtro de semestre + imagens aplicados';
END
$patch$;

-- CREATE OR REPLACE FUNCTION não substitui quando a lista de parâmetros muda
-- (mesmo com o novo parâmetro tendo DEFAULT): Postgres identifica a função
-- pela lista de TIPOS dos argumentos, então acrescentar p_semestre criou um
-- SEGUNDO overload (6 args) em vez de substituir o original -- o patch acima
-- deixou os dois convivendo. Como o overload novo (7 args) tem DEFAULT NULL
-- em p_semestre, toda chamada existente com os 6 args originais já resolve
-- para ele, então o overload antigo (sem filtro de semestre, sem imagens)
-- fica órfão e precisa sair -- senão o Postgres/PostgREST tem 2 candidatos
-- pra escolher.
DROP FUNCTION IF EXISTS public.get_gestor_questoes(uuid, uuid, integer, integer, text, text);

-- O overload novo nasceu com a ACL default do schema public (PUBLIC + anon
-- com EXECUTE), porque CREATE OR REPLACE não herda grants explícitos quando
-- a assinatura muda -- ele cria um objeto novo. As demais RPCs do módulo
-- gestor só concedem EXECUTE a authenticated/service_role, sem PUBLIC/anon
-- (a função falha fechado internamente pra anon via
-- has_role(auth.uid(),...), mas o convite de acesso não deveria nem chegar
-- lá). Restaura essa convenção.
REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_questoes(uuid, uuid, integer, integer, text, text, text) TO authenticated, service_role;

-- ============================================================================
-- PARTE 2: nova RPC get_gestor_questao_respondentes
-- ============================================================================
--
-- Lista de alunos que marcaram uma alternativa específica de uma questão.
-- Mesmo preâmbulo canônico do módulo (papel admin/gestor/gestor_grupo ->
-- resolve v_ies -> gestor_pode_acessar_ies(v_ies)).
--
-- answer_progress não tem coluna de IES/college_id (só user_id, simulado,
-- question_id, resposta_usuario, correct) -- confirmado via
-- information_schema.columns em 09/08. A restrição por IES é feita via JOIN
-- em public.users (u.id_ies = v_ies), igual ao padrão que as outras RPCs do
-- módulo usam pra popular a CTE "alunos". DISTINCT no aluno porque
-- answer_progress não tem unicidade garantida por (user_id, question_id) --
-- PK é answer_id -- um aluno que refez a mesma questão não pode aparecer
-- duplicado na lista.
CREATE FUNCTION public.get_gestor_questao_respondentes(
  p_ies_id uuid,
  p_question_id uuid,
  p_alternativa text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_alt    text;
  v_result jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_question_id IS NULL THEN
    RAISE EXCEPTION 'question_id_obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_alt := upper(btrim(COALESCE(p_alternativa, '')));
  IF v_alt NOT IN ('A','B','C','D','E') THEN
    RAISE EXCEPTION 'alternativa_invalida' USING ERRCODE = '22023';
  END IF;

  IF p_ies_id IS NOT NULL THEN
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

  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  WITH respondentes AS (
    SELECT DISTINCT u.id, u.nome
    FROM public.answer_progress ap
    JOIN public.users u ON u.id = ap.user_id
    WHERE ap.question_id = p_question_id
      AND upper(ap.resposta_usuario) = v_alt
      AND u.id_ies = v_ies
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('alunoId', r.id, 'nome', r.nome) ORDER BY r.nome)
      FROM respondentes r), '[]'::jsonb),
    'meta', jsonb_build_object(
      'fonte',        'answer_progress · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Convenção do módulo: só authenticated/service_role têm EXECUTE (sem
-- PUBLIC/anon) -- igual ao ACL final de get_gestor_questoes/get_gestor_alunos.
REVOKE ALL ON FUNCTION public.get_gestor_questao_respondentes(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_questao_respondentes(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_questao_respondentes(uuid, uuid, text) TO authenticated, service_role;
