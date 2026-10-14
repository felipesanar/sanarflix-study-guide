DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.get_gestor_cronograma(uuid)'::regprocedure);
  n := replace(d, 'OR (COALESCE(p.n, 0) > 0 AND EXISTS (SELECT 1 FROM public.simulados_admin so WHERE so.id = s.id AND so.prova_oficial)))',
                  'OR COALESCE(p.n, 0) > 0)');
  n := replace(n, 'realizado = encerrado E tem linha em resultados_ies_tri; processing = encerrado sem TRI ainda;',
                  'realizado = encerrado E (tem linha em resultados_ies_tri OU tem participação de aluno); processing = encerrado sem TRI e sem participação;');
  IF n = d THEN RAISE EXCEPTION 'cronograma: padrão não encontrado'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
  n := replace(d, 'SELECT * FROM metricas WHERE n_tri > 0', 'SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0');
  n := replace(n, '  areas_sim AS (', '  regua_tri AS (
    SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k
    FROM realizados r WHERE r.n_tri > 0
  ),
  pontos_tri AS (
    SELECT g.*,
           CASE WHEN g.i = g.k     THEN ''atual''
                WHEN g.i = g.k - 1 THEN ''anterior''
                WHEN g.i = 1       THEN ''primeiro'' END AS rotulo
    FROM regua_tri g
    WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1
  ),
  areas_sim AS (');
  n := replace(n, 'SELECT p.concept FROM pontos p', 'SELECT p.concept FROM pontos_tri p');
  n := replace(n, 'SELECT p.concept_oficial FROM pontos p', 'SELECT p.concept_oficial FROM pontos_tri p');
  n := replace(n, 'SELECT p.prof_pct FROM pontos p', 'SELECT p.prof_pct FROM pontos_tri p');
  IF position('pontos_tri p' in n) = 0 OR position('n_resp > 0 OR n_tri > 0' in n) = 0 THEN RAISE EXCEPTION 'visao_geral: padrão não encontrado'; END IF;
  EXECUTE n;
END $mig$;