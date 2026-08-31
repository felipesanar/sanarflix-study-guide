-- Restringe a experiência de gestão a simulados com type = 'simulado_enamed'.
-- Reescreve cada RPC de gestão substituindo a referência à tabela
-- public.simulados_admin por uma subquery já filtrada, preservando alias,
-- assinatura, SECURITY DEFINER, search_path e ACLs (CREATE OR REPLACE).
DO $mig$
DECLARE
  r record;
  def text;
  novo text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_gestor_visao_geral',
        'get_gestor_detalhamento',
        'get_gestor_detalhamento_temas',
        'get_gestor_diagnostico',
        'get_gestor_diagnostico_temas',
        'get_gestor_alunos',
        'get_gestor_aluno',
        'get_gestor_aluno_desempenho_por_area',
        'get_gestor_questoes',
        'get_gestor_cronograma',
        'get_institutional_simulados',
        'get_institutional_performance',
        'get_institutional_evolution',
        'get_institutional_evolution_tri',
        'get_institutional_student_scores'
      ])
  LOOP
    def := pg_get_functiondef(r.oid);

    novo := regexp_replace(
      def,
      '(public\.)?simulados_admin[ \t]+(sa_ord|sa|s)\M',
      '(SELECT * FROM public.simulados_admin WHERE type = ''simulado_enamed'') \2',
      'g'
    );

    IF novo = def THEN
      RAISE EXCEPTION 'Nenhuma referência a simulados_admin encontrada em %', r.proname;
    END IF;

    EXECUTE novo;
    RAISE NOTICE 'Filtro ENAMED aplicado em %', r.proname;
  END LOOP;
END
$mig$;