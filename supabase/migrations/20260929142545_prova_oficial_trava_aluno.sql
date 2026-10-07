-- ATENCAO: reescrita server-side sobre o corpo VIVO em prod (ancoras exatas). Nao e
-- reexecutavel num banco novo; as definicoes anteriores ficam em public.function_def_backups.
-- Fix round 1 (revisao do task 1a): trava o caminho EXPLICITO (p_simulado_id
-- informado) para a prova oficial ENAMED (simulados_admin.prova_oficial = true,
-- 97d67578-4204-4009-8056-fd0df28aa30d) ate a liberacao especifica do aluno
-- (simulados_admin.prova_oficial_liberada_aluno), e bloqueia o TRI da prova
-- oficial permanentemente via RLS, mesmo apos a liberacao.
--
-- Funcoes afetadas (rewrite server-side, a partir do pg_get_functiondef live,
-- com backup previo em public.function_def_backups):
--   1) get_user_performance_aggregates: o ramo p_simulado_id IS NOT NULL
--      pulava o gate de liberacao de desempenho. Agora, quando o simulado
--      pedido explicitamente e prova_oficial E ainda nao prova_oficial_liberada_aluno,
--      o gate NAO e pulado (cai nos demais OR, que nao se aplicam a essa
--      prova hoje) -> retorna o "shape" de simulado sem dados. Nenhum outro
--      simulado muda de comportamento.
--   2) get_user_rankings: mesmo ajuste no ramo explicito -- ao pedir ranking
--      de um p_simulado_id que seja prova_oficial ainda nao liberada, a CTE
--      "rankings" fica vazia para esse simulado (para todos os usuarios), e a
--      funcao retorna rankingIES/rankingSemester = null, como se ninguem
--      tivesse respondido.
--
-- RLS (public.resultados_alunos_tri):
--   3) A policy "Students view their own TRI results" (USING student_id =
--      auth.uid()) passa a excluir tambem linhas de simulados prova_oficial,
--      SEMPRE (independente de prova_oficial_liberada_aluno) -- o aluno nunca
--      ve o TRI da prova oficial pelo Academy. A checagem usa uma funcao
--      SECURITY DEFINER nova (public.is_simulado_prova_oficial) em vez de um
--      subselect direto em simulados_admin: um NOT EXISTS direto naquela
--      tabela, dentro da propria policy, roda com o role do aluno e e
--      filtrado pelas RLS policies de simulados_admin (que escondem a prova,
--      status = 'encerrado', de um aluno comum) -- isso faria o NOT EXISTS
--      dar sempre verdadeiro e a exclusao virar no-op. A funcao SECURITY
--      DEFINER contorna esse problema (verificado em dry-run: sem ela, o
--      aluno ainda enxergava a linha de TRI da prova).

CREATE TABLE IF NOT EXISTS public.function_def_backups (
  id bigserial PRIMARY KEY,
  fn_oid oid,
  fn_signature text NOT NULL,
  reason text NOT NULL,
  def text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.function_def_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.function_def_backups FROM PUBLIC, anon, authenticated;

-- 1) e 2): funcoes
DO $mig$
DECLARE
  rec record;
  v_old text;
  v_new text;
  v_occ int;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public.get_user_performance_aggregates'::regproc,
       $a$AND (
        p_simulado_id IS NOT NULL
        OR sa.liberacao_desempenho = 'imediato'$a$,
       $a$AND (
        (p_simulado_id IS NOT NULL AND NOT (sa.prova_oficial AND NOT sa.prova_oficial_liberada_aluno))
        OR sa.liberacao_desempenho = 'imediato'$a$,
       1),
      ('public.get_user_rankings'::regproc,
       $a$AND ((p_simulado_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa WHERE sa.id = ap.simulado AND sa.prova_oficial)) OR ap.simulado = p_simulado_id)$a$,
       $a$AND ((p_simulado_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa WHERE sa.id = ap.simulado AND sa.prova_oficial)) OR (ap.simulado = p_simulado_id AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa2 WHERE sa2.id = p_simulado_id AND sa2.prova_oficial AND NOT sa2.prova_oficial_liberada_aluno)))$a$,
       1)
    ) AS t(fn_oid, anchor, replacement, expected_occ)
  LOOP
    v_old := pg_get_functiondef(rec.fn_oid);

    -- idempotente: se o replacement ja esta presente, pula esta funcao
    IF position(rec.replacement in v_old) > 0 THEN
      CONTINUE;
    END IF;

    v_occ := (length(v_old) - length(replace(v_old, rec.anchor, ''))) / length(rec.anchor);
    IF v_occ <> rec.expected_occ THEN
      RAISE EXCEPTION 'prova_oficial_trava_aluno: contagem de ancora inesperada para %: esperado % obteve %',
        rec.fn_oid::oid::regprocedure, rec.expected_occ, v_occ;
    END IF;

    INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def)
    VALUES (rec.fn_oid, (rec.fn_oid::oid)::regprocedure::text, 'prova_oficial_trava_aluno', v_old);

    v_new := replace(v_old, rec.anchor, rec.replacement);
    EXECUTE v_new;
  END LOOP;
END;
$mig$;

-- Helper SECURITY DEFINER usado pela policy do TRI (ver nota acima sobre por
-- que um NOT EXISTS direto na policy nao funciona).
CREATE OR REPLACE FUNCTION public.is_simulado_prova_oficial(p_simulado_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE((SELECT prova_oficial FROM public.simulados_admin WHERE id = p_simulado_id), false);
$fn$;

-- 3): RLS de resultados_alunos_tri
DO $pol$
DECLARE
  v_qual text;
  v_roles text;
  v_cmd text;
  v_permissive text;
BEGIN
  SELECT qual, array_to_string(roles, ','), cmd, permissive
    INTO v_qual, v_roles, v_cmd, v_permissive
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'resultados_alunos_tri'
    AND policyname = 'Students view their own TRI results';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'prova_oficial_trava_aluno: policy nao encontrada';
  END IF;

  -- idempotente
  IF v_qual LIKE '%prova_oficial%' THEN
    RETURN;
  END IF;

  IF v_roles <> 'authenticated' OR v_cmd <> 'SELECT' OR v_permissive <> 'PERMISSIVE' THEN
    RAISE EXCEPTION 'prova_oficial_trava_aluno: formato de policy inesperado roles=% cmd=% permissive=%',
      v_roles, v_cmd, v_permissive;
  END IF;

  INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def)
  VALUES (
    'public.resultados_alunos_tri'::regclass::oid,
    'policy:resultados_alunos_tri:Students view their own TRI results',
    'prova_oficial_trava_aluno',
    format('CREATE POLICY %L ON public.resultados_alunos_tri AS %s FOR %s TO %s USING (%s);',
           'Students view their own TRI results', v_permissive, v_cmd, v_roles, v_qual)
  );

  DROP POLICY "Students view their own TRI results" ON public.resultados_alunos_tri;
  CREATE POLICY "Students view their own TRI results" ON public.resultados_alunos_tri
    FOR SELECT TO authenticated
    USING (student_id = auth.uid() AND NOT public.is_simulado_prova_oficial(simulado_id));
END;
$pol$;
