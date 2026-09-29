-- Exclui simulados com simulados_admin.prova_oficial = true (ENAMED oficial,
-- 97d67578-4204-4009-8056-fd0df28aa30d) das series do gestor e dos agregados
-- gerais do aluno. Nao altera o caminho por-simulado (p_simulado_id explicito).
--
-- Funcoes afetadas (via rewrite server-side, a partir do pg_get_functiondef
-- live, com backup previo em public.function_def_backups):
--   1) get_gestor_visao_geral: todas as 9 ocorrencias do subselect
--      simulados_admin WHERE type = 'simulado_enamed' ganham AND NOT prova_oficial
--   2) get_user_rankings: exclui prova_oficial apenas no caminho "todos os
--      simulados" (p_simulado_id IS NULL), via NOT EXISTS (nao ha join com
--      simulados_admin nessa funcao)
--   3) get_user_simulados: prova_oficial nunca aparece na listagem do aluno
--   4) get_user_performance_aggregates: exclui apenas no caminho agregado
--      (p_simulado_id IS NULL); chamada com p_simulado_id explicito continua
--      retornando os dados da prova normalmente
--   5) get_all_user_performance_by_area: exclui prova_oficial do breakdown
--      por area (funcao nao tem parametro p_simulado_id)

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

DO $mig$
DECLARE
  rec record;
  v_old text;
  v_new text;
  v_occ int;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public.get_gestor_visao_geral'::regproc,
       $a$(SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed')$a$,
       $a$(SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial)$a$,
       9),
      ('public.get_user_rankings'::regproc,
       $a$AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)$a$,
       $a$AND ((p_simulado_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.simulados_admin sa WHERE sa.id = ap.simulado AND sa.prova_oficial)) OR ap.simulado = p_simulado_id)$a$,
       1),
      ('public.get_user_simulados'::regproc,
       $a$WHERE ap.user_id = auth.uid()
    AND ($a$,
       $a$WHERE ap.user_id = auth.uid()
    AND NOT sa.prova_oficial
    AND ($a$,
       1),
      ('public.get_user_performance_aggregates'::regproc,
       $a$AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)$a$,
       $a$AND ((p_simulado_id IS NULL AND NOT sa.prova_oficial) OR ap.simulado = p_simulado_id)$a$,
       1),
      ('public.get_all_user_performance_by_area'::regproc,
       $a$WHERE ap.user_id = auth.uid()
    AND q."grande_area" IS NOT NULL$a$,
       $a$WHERE ap.user_id = auth.uid()
    AND NOT sa.prova_oficial
    AND q."grande_area" IS NOT NULL$a$,
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
      RAISE EXCEPTION 'prova_oficial_exclusoes: contagem de ancora inesperada para %: esperado % obteve %',
        rec.fn_oid::oid::regprocedure, rec.expected_occ, v_occ;
    END IF;

    INSERT INTO public.function_def_backups (fn_oid, fn_signature, reason, def)
    VALUES (rec.fn_oid, (rec.fn_oid::oid)::regprocedure::text, 'prova_oficial exclusion', v_old);

    v_new := replace(v_old, rec.anchor, rec.replacement);
    EXECUTE v_new;
  END LOOP;
END;
$mig$;
