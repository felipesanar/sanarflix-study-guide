-- Refino de 07/08 (item 1 da rodada do Joao): o filtro de semestre do Portal do
-- Gestor passa a RECORTAR de verdade, e o conceito da IES em "Geral" passa a vir
-- do resultado institucional consolidado.
--
-- O QUE ESTAVA ERRADO
-- -------------------
-- O segmento "6º ano (Padrão)" nunca filtrou nada. Nas CINCO RPCs que recebem
-- p_semestre o ramo era literalmente:
--
--     ELSIF p_semestre = '6ano' THEN
--       v_sems := NULL; ... 'todos os semestres, 11º e 12º em evidência'
--
-- v_sems := NULL significa "sem recorte de semestre" -- o 11º/12º entrava so
-- como EVIDENCIA visual no grafico (v_evid), sem tocar em nenhuma conta. Efeito
-- pratico: "6º ano (Padrão)" e "Geral" devolviam numeros IDENTICOS, e o rotulo
-- do segmento afirmava um recorte que nao existia.
--
-- Medido na FUNEPE (3e51663e-8766-4881-bfd1-0921678ed014), simulado de 27/07:
--   todos os semestres -> 89 alunos com TRI, 37% proficientes -> conceito 1
--   somente 11º e 12º  -> 52 alunos com TRI, 50% proficientes -> conceito 2
-- Ou seja: a tela mostrava conceito 1 para uma instituicao cujo 6º ano projeta 2.
--
-- REGRA ACORDADA (Joao, 07/08)
-- ----------------------------
--   1. '6ano'   -> percentual de proficientes SO do 6º ano (11º e 12º semestres),
--                  e o conceito 1-5 derivado desse percentual pelas faixas.
--   2. 'geral'  -> o conceito vem DIRETO de public.resultados_ies_tri.concept
--                  (resultado institucional consolidado), nao recalculado.
--   3. '1'..'12'-> mesmo comportamento do caso 1, restrito aquele semestre.
--                  (Ja era assim; nada muda neste ramo.)
--
-- Sobre o caso 2: conferido que resultados_ies_tri BATE com o calculo sobre todos
-- os semestres (FUNEPE 27/07: pcp 37,08 / concept 1, contra 37% / 1 calculado),
-- entao a mudanca nao mexe no numero exibido hoje em "Geral" -- ela troca a FONTE
-- por aquela que a Sanar publica como oficial, e passa a ser ela que manda se as
-- duas divergirem. Somente o Conceito ENAMED muda de fonte: proficientes, % de
-- acerto, diagnostico, distribuicao, dispersao e graficos seguem calculados a
-- partir de resultados_alunos_tri, porque resultados_ies_tri nao tem % de acerto
-- nem quebra por grande area.
--
-- POR QUE AS CINCO RPCs, E NAO SO A get_gestor_visao_geral
-- -------------------------------------------------------
-- O Diagnostico Curricular tem os tres cartoes de nivel vindos de
-- get_gestor_visao_geral e a cascata AO LADO vinda de get_gestor_diagnostico --
-- o mesmo bloco, na mesma tela. Corrigir so a primeira faria o cartao dizer
-- "7 areas medianas" (recorte do 6º ano) e a lista aberta pela seta mostrar as
-- areas de TODOS os semestres. Mesma contradicao entre a Visao de Alunos e a
-- tabela nominal (get_gestor_alunos), e entre a Visao Geral e o Detalhamento
-- (get_gestor_detalhamento). O recorte e GLOBAL da pagina (spec §4.5): ou vale
-- em todas as consultas da tela, ou nao vale em nenhuma.
--
-- POR QUE A PARTE A E UM PATCH TEXTUAL, E NAO CREATE OR REPLACE
-- ------------------------------------------------------------
-- As outras quatro RPCs mudam UMA linha cada. Recolar o corpo inteiro das quatro
-- aqui e exatamente o acidente que o cabecalho de
-- 20260807040000_get_gestor_visao_geral_criterio_negocio.sql documenta: uma
-- migration nascida de uma base desatualizada reverte, em silencio, o que outra
-- migration tinha mudado no meio. O Lovable empurra codigo para producao varias
-- vezes por dia, entao "a base certa" e um alvo movel.
--
-- O DO abaixo le a definicao VIVA (pg_get_functiondef), troca a linha exata e
-- reexecuta -- o resto do corpo continua byte a byte o que ja estava em
-- producao, seja la de quem for. E ABORTA se a linha alvo nao aparecer
-- exatamente uma vez, para nunca aplicar um patch parcial ou silencioso.
--
-- Idempotencia: rodar de novo aborta com 'recorte_6ano_alvo_nao_encontrado'
-- (a linha antiga ja nao existe). Isso e proposital -- e um sinal, nao um erro
-- a ser engolido. Reaplicar exige revisar o que mudou por baixo.

-- ---------------------------------------------------------------------------
-- PARTE A -- '6ano' passa a recortar 11º e 12º nas quatro RPCs secundarias.
-- ---------------------------------------------------------------------------
DO $patch$
DECLARE
  v_fn      text;
  v_oid     oid;
  v_qtd     int;
  v_def     text;
  v_novo    text;
  v_alvo    text;
  v_troca   text;
  v_alvos   text[] := ARRAY[
    'get_gestor_alunos',
    'get_gestor_diagnostico',
    'get_gestor_diagnostico_temas',
    'get_gestor_detalhamento'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_alvos LOOP
    -- Nenhuma das quatro tem sobrecarga hoje (conferido em 07/08), mas o
    -- SELECT INTO pegaria UMA delas em silencio se alguem criasse outra
    -- assinatura -- e o patch cairia na função errada. Conta antes.
    SELECT count(*), min(p.oid) INTO v_qtd, v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;

    IF v_qtd = 0 THEN
      RAISE EXCEPTION 'recorte_6ano_funcao_ausente: %', v_fn;
    END IF;
    IF v_qtd > 1 THEN
      RAISE EXCEPTION 'recorte_6ano_funcao_sobrecarregada: % (% assinaturas)', v_fn, v_qtd;
    END IF;

    v_def := pg_get_functiondef(v_oid);

    -- Duas formas convivem em producao: get_gestor_detalhamento tambem grava
    -- v_evid no mesmo ramo, as outras tres nao. Trocamos so o 'v_sems := NULL'
    -- daquele ramo e o texto do recorte; v_evid (evidencia visual no grafico)
    -- continua exatamente como esta.
    v_alvo := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
              '    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := ''todos os semestres, 11º e 12º em evidência'';';
    v_troca := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
               '    v_sems := ARRAY[11,12]; v_evid := ARRAY[11,12]; v_recorte := ''somente o 6º ano (11º e 12º semestres)'';';

    IF position(v_alvo IN v_def) = 0 THEN
      v_alvo := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
                '    v_sems := NULL; v_recorte := ''todos os semestres, 11º e 12º em evidência'';';
      v_troca := 'ELSIF p_semestre = ''6ano'' THEN' || E'\n' ||
                 '    v_sems := ARRAY[11,12]; v_recorte := ''somente o 6º ano (11º e 12º semestres)'';';
    END IF;

    -- Exatamente UMA ocorrencia. Zero = a base mudou por baixo (nao aplicar as
    -- cegas). Duas ou mais = o ramo aparece em dois lugares e trocar os dois
    -- sem ler seria um chute.
    IF position(v_alvo IN v_def) = 0 THEN
      RAISE EXCEPTION 'recorte_6ano_alvo_nao_encontrado: %', v_fn;
    END IF;
    IF (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 THEN
      RAISE EXCEPTION 'recorte_6ano_alvo_ambiguo: %', v_fn;
    END IF;

    v_novo := replace(v_def, v_alvo, v_troca);
    IF v_novo = v_def THEN
      RAISE EXCEPTION 'recorte_6ano_patch_sem_efeito: %', v_fn;
    END IF;

    EXECUTE v_novo;
    RAISE NOTICE 'recorte 6ano corrigido em %', v_fn;
  END LOOP;
END
$patch$;

-- ---------------------------------------------------------------------------
-- PARTE B -- get_gestor_visao_geral.
--
-- Esta ganha corpo inteiro porque a mudanca NAO e de uma linha: alem do recorte
-- do 6º ano, o conceito passa a ter duas fontes (v_geral) e o payload ganha
-- 'semestresComResultado'. A base usada e a definicao VIVA de producao lida em
-- 07/08 (pg_get_functiondef, md5 c44d1b8af2e6e0c9eb8c6b1743672b16), conferida
-- identica a 20260807040000_get_gestor_visao_geral_criterio_negocio.sql --
-- inclusive SEM o guard de feature mestre, que o PR 1 removeu de proposito e
-- que esta migration nao pode reintroduzir.
--
-- 'semestresComResultado' existe por causa de um efeito colateral do proprio
-- recorte: o dropdown "Por semestre" da UI era montado a partir de `dispersao`,
-- que agora vem filtrada. Sem este campo, quem estivesse em "6º ano" e clicasse
-- em "Por semestre" so veria 11º e 12º no dropdown -- as outras dez opcoes
-- sumiriam justamente porque o recorte passou a funcionar. O campo lista os
-- semestres com resultado da IES INTEIRA, sem recorte nenhum, e e sobre ele que
-- o dropdown se monta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_evid     int[];
  v_recorte  text;
  v_criterio text;
  -- TRUE somente no recorte 'Geral' (inclui p_semestre NULL). E ele que decide a
  -- FONTE do Conceito ENAMED: consolidado institucional em 'Geral', derivado do
  -- % de proficientes do recorte nos demais.
  v_geral    boolean := false;
  v_conceito_criterio text;
  v_result   jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- resolucao de v_ies (ainda NAO autoriza -- ver o IF de gestor_pode_acessar_ies abaixo)
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

  -- achado 15 / card 119: autorizacao da IES RESOLVIDA, por papel, via
  -- gestor_pode_acessar_ies -- SUBSTITUI a checagem antiga (função de autorização por IES da
  -- rodada de 04/08), que autorizava 'gestor' puro para IES de fora do proprio cadastro
  -- quando havia linha orfa em user_groups (residuo de downgrade gestor_grupo -> gestor).
  -- Ver 20260804160000_gestor_pode_acessar_ies.sql para a prova completa do gap, a regra
  -- por papel e por que o guard fica DEPOIS da resolucao de v_ies (cobre os dois ramos --
  -- p_ies_id explicito E o fallback via get_accessible_ies -- com um unico IF). NAO manter
  -- as duas chamadas: o conjunto autorizado por gestor_pode_acessar_ies e subconjunto do
  -- autorizado pela checagem antiga em todo papel, entao a troca so NEGA casos, nunca
  -- libera um caso hoje negado.
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  -- recorte de semestre (refino 07/08): '6ano' => SOMENTE 11º e 12º (antes era
  -- "todos, com 11/12 em evidencia" -- ou seja, nao filtrava nada); 'geral' =>
  -- todos; '1'..'12' => so aquele. v_evid segue marcando 11/12 no grafico.
  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_geral := true;
    v_sems := NULL; v_evid := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := ARRAY[11,12]; v_evid := ARRAY[11,12];
    v_recorte := 'somente o 6º ano (11º e 12º semestres)';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_evid := v_sems;
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  -- A frase do conceito entra como ARGUMENTO de format(), nao no molde: assim o
  -- '%' literal de "% de proficientes" nao precisa de escape duplo e as duas
  -- versoes ficam lado a lado, legiveis.
  v_conceito_criterio := CASE WHEN v_geral
    THEN 'Conceito ENAMED 1–5 do resultado institucional consolidado de cada simulado, nunca média.'
    ELSE 'Conceito ENAMED 1–5 derivado do % de proficientes do recorte (>=90:5, >=75:4, >=60:3, >=40:2, senão 1), por simulado, nunca média.'
  END;

  v_criterio := format(
    'Proficiência: nota de 0 a 100; considerado proficiente quem atinge 60 pontos ou mais. Desempenho por grande área em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80). Última tentativa por aluno; questão anulada é ignorada; considera somente alunos, fora do universo de usuários com outro papel na plataforma. %s Recorte: %s.',
    v_conceito_criterio, v_recorte);

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
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
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  -- Conceito institucional CONSOLIDADO, por simulado-pai. Fonte do Conceito
  -- ENAMED quando v_geral. max() agrega os simulados-irmaos sob o mesmo pai pelo
  -- mesmo motivo que a CTE `tri` deduplica por (student_id, pai_id): um pai pode
  -- ter 2+ filhos e a tabela e (college_id, simulado_id). Na pratica a IES tem
  -- uma linha por pai; o max() e defesa em profundidade, para a agregacao nunca
  -- devolver duas linhas para o mesmo ponto da regua.
  ies_tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, max(r.concept) AS concept
    FROM public.resultados_ies_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
    GROUP BY 1
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  -- Mesma populacao de `alunos`, SEM o recorte de semestre. Serve so a
  -- `sems_com_resultado` (o dropdown "Por semestre"), que precisa enxergar
  -- alem do recorte vigente -- ver o cabecalho desta migration.
  alunos_todos AS (
    SELECT u.id, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  sems_com_resultado AS (
    SELECT DISTINCT a.semestre
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos_todos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
      AND a.semestre IS NOT NULL
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
  respostas AS (
    SELECT t.pai_id, t.user_id, ap.correct, q.grande_area
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  tri_raw AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  -- gap 112: UMA linha por (student_id, pai_id) ANTES de qualquer contagem/média/dispersão.
  -- resultados_alunos_tri é (student_id, simulado_id); um "pai" pode ter 2+ "filhos"
  -- (simulados-irmãos, mesmo simulado_pai_id), e o MESMO aluno pode ter uma linha de TRI
  -- para CADA filho. Sem esta dedup, count(DISTINCT student_id) já neutralizava a
  -- duplicata na CONTAGEM (achado 8 da rodada anterior), mas avg(score_proprio)
  -- (prof_media, usada na tabela de evolução) somava as linhas duplicadas do mesmo aluno,
  -- e a escolha de linha em `dispersao` (DISTINCT ON student_id ORDER BY m.ord DESC)
  -- ficava arbitrária quando o "ord" mais recente do aluno caía num pai_id com 2+ linhas —
  -- resultado: o MESMO aluno no MESMO simulado saía com um valor na tabela (avg) e outro
  -- no drawer (max).
  --
  -- CRITÉRIO DE DESEMPATE — REFERÊNCIA CANÔNICA (get_gestor_detalhamento e
  -- get_gestor_alunos/get_gestor_aluno DEVEM adotar o MESMO, não inventar outro): MAIOR
  -- score_proprio (melhor tentativa) por (student_id, pai_id). Não é critério novo — é
  -- exatamente o que get_gestor_aluno (o "drawer": migrations 20260729210700,
  -- 20260803150000, 20260804130100) já usa via
  -- `max(tr.score_proprio) ... WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id`.
  -- Unificar aqui elimina a divergência pela raiz, numa fonte única: tudo que lê `tri` a
  -- partir daqui (contagens, avg, dispersão) vê exatamente uma linha por (student_id,
  -- pai_id), com o mesmo valor que o drawer já mostra. DISTINCT ON com
  -- ORDER BY score_proprio DESC é equivalente a max() aqui porque a única coluna que varia
  -- entre as linhas duplicadas é score_proprio (semestre vem da tabela `alunos`, igual em
  -- todas as duplicatas do mesmo aluno).
  tri AS (
    SELECT DISTINCT ON (tr.student_id, tr.pai_id)
           tr.pai_id, tr.student_id, tr.semestre, tr.score_proprio
    FROM tri_raw tr
    ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC
  ),
  por_sim AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id)              AS n_tri,
           (SELECT avg(t.score_proprio)         FROM tri t WHERE t.pai_id = s.id)              AS prof_media,
           -- achado 8 (preservado): distinto por aluno, igual ao denominador n_tri. Agora
           -- opera sobre `tri` já deduplicada (gap 112) — count(DISTINCT) aqui é defesa em
           -- profundidade, não a correção em si.
           (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT count(DISTINCT r.user_id)    FROM respostas r WHERE r.pai_id = s.id)        AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id)   AS acertos,
           (SELECT count(*)                     FROM respostas r WHERE r.pai_id = s.id)        AS total
    FROM sims_ord s
  ),
  metricas AS (
    SELECT p.*,
           CASE WHEN p.n_tri > 0 THEN round(100.0 * p.n_prof / p.n_tri, 0) END AS prof_pct,
           CASE WHEN p.total > 0 THEN round(100.0 * p.acertos / p.total, 0) END AS acerto_pct,
           -- Refino 07/08 -- DUAS fontes de conceito:
           --   v_geral  -> resultados_ies_tri.concept, o consolidado institucional que a
           --               Sanar publica. NULL quando a tabela nao tem linha para aquele
           --               simulado: ausencia continua sendo ausencia, nunca 1 (§4.10).
           --   demais   -> derivado do % de proficientes DO RECORTE, que agora e de fato
           --               um recorte (11º/12º no '6ano', o semestre escolhido nos demais).
           CASE WHEN v_geral
                  THEN (SELECT it.concept FROM ies_tri it WHERE it.pai_id = p.id)
                WHEN p.n_tri = 0 THEN NULL
                WHEN 100.0 * p.n_prof / p.n_tri >= 90 THEN 5
                WHEN 100.0 * p.n_prof / p.n_tri >= 75 THEN 4
                WHEN 100.0 * p.n_prof / p.n_tri >= 60 THEN 3
                WHEN 100.0 * p.n_prof / p.n_tri >= 40 THEN 2
                ELSE 1 END AS concept
    FROM por_sim p
  ),
  realizados AS (
    SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0
  ),
  regua AS (
    SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k
    FROM realizados r
  ),
  pontos AS (
    SELECT g.*,
           CASE WHEN g.i = g.k     THEN 'atual'
                WHEN g.i = g.k - 1 THEN 'anterior'
                WHEN g.i = 1       THEN 'primeiro' END AS rotulo
    FROM regua g
    WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1
  ),
  areas_sim AS (
    SELECT r.grande_area AS area, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE r.grande_area IS NOT NULL
    GROUP BY 1, 2
  ),
  areas_tot AS (
    SELECT a.area, sum(a.total) AS total, sum(a.acertos) AS acertos,
           (SELECT count(DISTINCT r2.user_id) FROM respostas r2 WHERE r2.grande_area = a.area) AS amostra
    FROM areas_sim a GROUP BY a.area
  ),
  -- gap 117: `nivel` (abaixo) e `evolucaoPorArea.critica` classificavam sobre o percentual
  -- BRUTO (100.0 * acertos / total), enquanto o `acertoPct` exibido na UI já saía
  -- arredondado (round(...,0)) — um caso com bruto 29.6% arredondava para 30% na tela mas
  -- classificava 'critico' (corte < 30 sobre o bruto): o payload se contradizia. Esta CTE
  -- intermediária calcula o arredondamento UMA vez, e as duas leituras da mesma pergunta
  -- ("essa área é crítica?") — areas_nivel.nivel e evolucaoPorArea.critica, mais abaixo —
  -- passam a classificar sobre este MESMO valor. Consistente com
  -- src/features/gestor/lib/regras.ts:nivelDesempenho, que recebe o acertoPct já
  -- arredondado que a API devolve.
  areas_pct AS (
    SELECT t.area, t.amostra, t.total,
           round(100.0 * t.acertos / NULLIF(t.total,0), 0) AS acerto_pct
    FROM areas_tot t
  ),
  areas_nivel AS (
    SELECT p.area, p.amostra, p.acerto_pct,
           CASE WHEN p.total = 0        THEN NULL
                WHEN p.acerto_pct <  30 THEN 'critico'
                WHEN p.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS nivel
    FROM areas_pct p
  ),
  aluno_prof AS (
    SELECT t.student_id,
           count(DISTINCT t.pai_id) AS n_sim,
           count(DISTINCT t.pai_id) FILTER (WHERE t.score_proprio >= 60) AS n_prof
    FROM tri t GROUP BY t.student_id
  ),
  aluno_grupo AS (
    SELECT ap.student_id,
           CASE WHEN ap.n_prof = ap.n_sim THEN 'consistentemente_proficiente'
                WHEN ap.n_prof = 0        THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM aluno_prof ap
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t
    JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  ),
  -- achado 5 (rodada anterior, preservado): KPI "x de y" IES-wide, alinhado ao critério de
  -- "realizado" de get_gestor_cronograma -- NÃO filtrado por v_sems (assim como o
  -- cronograma também não recebe p_semestre). Numerador = slots do(s) contrato(s)
  -- vigente(s) com simulado vinculado e "realizado"; denominador = simulados_contratados
  -- desse(s) mesmo(s) contrato(s).
  --
  -- gap 109: o LIMIT 1 escolhia só o "melhor" contrato (vigente hoje, ou o mais recente se
  -- nenhum vigente) e usava SÓ o simulados_contratados dele como denominador. O cronograma
  -- (fonte da verdade deste número, migration 20260804140100) lista os slots de TODOS os
  -- contratos da IES sem escolher um só -- uma IES com 2 contratos vigentes simultâneos
  -- (ex.: 4+3 slots) tinha 7 linhas no cronograma mas o KPI usava denominador 4 OU 3 (o de
  -- um dos dois), divergindo do mesmo produto na mesma tela. Correção: soma os slots de
  -- TODOS os contratos VIGENTES hoje. Sem NENHUM contrato vigente, cai no comportamento
  -- anterior (contrato mais recentemente encerrado), para não regressar o caso já coberto
  -- de IES sem contrato ativo.
  kpi_contratos_vigentes AS (
    SELECT c.id AS contrato_id, c.simulados_contratados
    FROM public.ies_contrato_simulados c
    WHERE c.ies_id = v_ies
      AND current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim
  ),
  kpi_contrato_fallback AS (
    SELECT c.id AS contrato_id, c.simulados_contratados
    FROM public.ies_contrato_simulados c
    WHERE c.ies_id = v_ies
      AND NOT EXISTS (SELECT 1 FROM kpi_contratos_vigentes)
    ORDER BY c.vigencia_fim DESC
    LIMIT 1
  ),
  kpi_contrato AS (
    SELECT * FROM kpi_contratos_vigentes
    UNION ALL
    SELECT * FROM kpi_contrato_fallback
  ),
  kpi_slots AS (
    SELECT sp.simulado_id AS pai_id
    FROM public.ies_simulado_previsto sp
    JOIN kpi_contrato kc ON kc.contrato_id = sp.contrato_id
    WHERE sp.ies_id = v_ies
      AND sp.simulado_id IS NOT NULL
  ),
  kpi_alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  kpi_grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT pai_id FROM kpi_slots)
  ),
  -- participação = simulados_finalizados UNION answer_progress, igual ao cronograma (o
  -- fallback não é redundância: simulados_finalizados não cobre todas as IES/simulados --
  -- ver comentário equivalente em 20260729210100_get_gestor_cronograma.sql).
  kpi_participacao AS (
    SELECT p.pai_id, count(DISTINCT p.user_id) AS n
    FROM (
      SELECT g.pai_id, sf.user_id
      FROM public.simulados_finalizados sf
      JOIN kpi_grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM kpi_alunos)
      UNION
      SELECT g.pai_id, ap.user_id
      FROM public.answer_progress ap
      JOIN kpi_grupo g ON g.simulado_id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM kpi_alunos)
    ) p
    GROUP BY p.pai_id
  ),
  kpi_com_tri AS (
    SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.resultados_ies_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
  ),
  kpi_realizados AS (
    SELECT ks.pai_id
    FROM kpi_slots ks
    JOIN public.simulados_admin sa
      ON sa.id = ks.pai_id
     AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado')
    LEFT JOIN kpi_participacao p ON p.pai_id = ks.pai_id
    WHERE (
            COALESCE(p.n,0) > 0
            OR lower(sa.status) = 'encerrado'
            OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento < now())
          )
      AND EXISTS (SELECT 1 FROM kpi_com_tri c WHERE c.pai_id = ks.pai_id)
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object(
        'enamedProjetado', jsonb_build_object(
          'valor', (SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.concept FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.concept) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', CASE WHEN v_geral
            THEN 'Conceito 1–5 do simulado atual, como consolidado no resultado institucional da instituição. Nunca é média entre simulados.'
            ELSE 'Conceito 1–5 do simulado atual, derivado do % de alunos proficientes no recorte selecionado. Nunca é média entre simulados.'
          END
        ),
        'proficientesPct', jsonb_build_object(
          'valor', (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.prof_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Alunos com proficiência acima de 60 sobre o total de alunos com resultado no simulado.'
        ),
        'acertoPct', jsonb_build_object(
          'valor', (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.acerto_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Respostas corretas sobre respostas válidas (questão anulada fora), na última tentativa de cada aluno.'
        ),
        'simulados', jsonb_build_object(
          'realizados',  COALESCE((SELECT count(*) FROM kpi_realizados), 0),
          -- gap 109: soma simulados_contratados de TODOS os contratos vigentes (ou do
          -- fallback), não só de um. sum() sobre kpi_contrato vazio (IES sem contrato
          -- nenhum) devolve NULL, igual ao comportamento anterior do subselect direto --
          -- "sem contrato" continua sendo ausência de dado, nunca 0 (§4.10).
          'contratados', (SELECT sum(kc.simulados_contratados) FROM kpi_contrato kc)
        )
      ),
      -- Semestres com resultado na IES INTEIRA, independentes do recorte vigente.
      -- Alimenta o dropdown "Por semestre" -- ver o cabecalho desta migration.
      'semestresComResultado', COALESCE((
        SELECT jsonb_agg(s.semestre ORDER BY s.semestre) FROM sems_com_resultado s), '[]'::jsonb),
      'evolucao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',   m.id,
                 'nome',         m.nome,
                 'data',         to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'valor',        CASE WHEN m.prof_media IS NULL THEN NULL ELSE round(m.prof_media::numeric, 1) END,
                 'participantes', GREATEST(m.n_tri, m.n_resp)
               ) ORDER BY m.ord)
        FROM realizados m), '[]'::jsonb),
      'evolucaoPorArea', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'area',    t.area,
                 'pontos',  COALESCE((
                              SELECT jsonb_agg(jsonb_build_object(
                                       'rotulo', m.nome,
                                       'valor',  round(100.0 * a.acertos / NULLIF(a.total,0), 0)
                                     ) ORDER BY m.ord)
                              FROM areas_sim a JOIN metricas m ON m.id = a.pai_id
                              WHERE a.area = t.area), '[]'::jsonb),
                 -- gap 117: classifica sobre o MESMO acerto_pct já arredondado de
                 -- areas_pct, igual a areas_nivel.nivel — antes comparava o percentual
                 -- bruto (100.0 * t.acertos / NULLIF(t.total,0)) < 30, que podia divergir
                 -- do que a UI mostra arredondado.
                 'critica', COALESCE(t.acerto_pct < 30, false)
               ) ORDER BY t.area)
        FROM areas_pct t), '[]'::jsonb),
      'diagnosticoResumo', (
        SELECT jsonb_agg(jsonb_build_object(
                 'nivel', n.nivel,
                 'areas', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object('id', an.area, 'nome', an.area, 'acertoPct', an.acerto_pct)
                                             ORDER BY an.acerto_pct, an.area)
                            FROM areas_nivel an WHERE an.nivel = n.nivel), '[]'::jsonb)
               ) ORDER BY n.pos)
        FROM (VALUES ('critico',1),('mediano',2),('excelente',3)) AS n(nivel,pos)),
      'distribuicaoAlunos', (
        SELECT jsonb_agg(jsonb_build_object(
                 'grupo',      g.grupo,
                 'quantidade', COALESCE(c.q, 0),
                 'percentual', CASE WHEN (SELECT count(*) FROM aluno_grupo) > 0
                                    THEN round(100.0 * COALESCE(c.q,0) / (SELECT count(*) FROM aluno_grupo), 0)
                               END
               ) ORDER BY g.pos)
        FROM (VALUES ('consistentemente_proficiente',1),
                     ('em_variacao',2),
                     ('consistentemente_nao_proficiente',3)) AS g(grupo,pos)
        LEFT JOIN (SELECT grupo, count(*) AS q FROM aluno_grupo GROUP BY grupo) c ON c.grupo = g.grupo),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'insights', jsonb_build_array(
        jsonb_build_object('escopo','area','texto', COALESCE((
          SELECT format('%s é a grande área com o menor desempenho da instituição: %s%% de acerto no recorte analisado.',
                        an.area, an.acerto_pct)
          FROM areas_nivel an WHERE an.acerto_pct IS NOT NULL ORDER BY an.acerto_pct, an.area LIMIT 1),
          'Ainda não há respostas suficientes para gerar um insight por grande área.')),
        jsonb_build_object('escopo','aluno','texto', COALESCE((
          SELECT format('%s de %s alunos com resultado estão consistentemente abaixo do limiar de proficiência (60).',
                        x.nao_prof, x.tot)
          FROM (SELECT count(*) FILTER (WHERE grupo = 'consistentemente_nao_proficiente') AS nao_prof,
                       count(*) AS tot
                FROM aluno_grupo) x
          WHERE x.tot > 0),
          'Ainda não há resultado de proficiência para gerar um insight por aluno.'))
      )
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM realizados m), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · resultados_ies_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users · ies_contrato_simulados · ies_simulado_previsto',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     v_criterio,
      'partial',      (SELECT count(*) FROM realizados WHERE n_tri = 0) > 0,
      -- achado 9 (rodada anterior, preservado): olha SÓ o ponto "atual" (a mesma régua dos
      -- KPIs), não o max() entre todos os simulados do recorte.
      'lowSample',    COALESCE((SELECT GREATEST(p.n_tri, p.n_resp) FROM pontos p WHERE p.rotulo = 'atual'), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
