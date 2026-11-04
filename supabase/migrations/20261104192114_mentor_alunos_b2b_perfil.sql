-- Corrige o perfil (virada/baixo/bom) de public.mentor_alunos_b2b, criada em 20261104185935 (mentor_b2b_v2).
-- O "atual" e o "anterior" eram os dois últimos simulados de sims_ord, que inclui simulado sem TRI e a prova
-- oficial ENAMED; numa IES cujo último simulado é a prova oficial, o perfil saía vazio para todos. Passam a ser os
-- dois últimos simulados COM TRI da turma (sims_com_tri, mesma janela e ordem). Validado em transação desfeita com
-- uma turma de 30 alunos reais (perfis antes vazios para os 30).
-- A função só existe para o portal do mentor v2 e não tem outro consumidor. CREATE OR REPLACE preserva os grants.
DO $fix$
DECLARE
  v_def  text;
  v_alvo constant text := 'FROM sims_ord ORDER BY ord DESC LIMIT 1';
  v_n    int;
BEGIN
  v_def := pg_get_functiondef('public.mentor_alunos_b2b(date,date)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo);
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'mentor_alunos_b2b_perfil: âncora encontrada % vezes (esperado 2)', v_n;
  END IF;
  EXECUTE replace(v_def, v_alvo, 'FROM sims_com_tri ORDER BY ord DESC LIMIT 1');
END
$fix$;
