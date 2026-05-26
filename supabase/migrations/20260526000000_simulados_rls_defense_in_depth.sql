-- =====================================================================
-- Fase 1/2 do plano de remediação — defesa em profundidade RLS
-- Garante que, mesmo se uma edge function falhar em validar user_id,
-- o banco recuse a escrita em nome de outro usuário.
-- =====================================================================
-- Tabelas alvo: simulados_iniciados, respostas_alunos, resultados_alunos_*
-- (ajustar nomes se diferentes no projeto; o script é idempotente).

-- Política: usuários só podem escrever em rows com seu próprio user_id.
-- Não toca em policies de SELECT existentes (não regressivo).

-- ---------------------------------------------------------------------
-- simulados_iniciados
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'simulados_iniciados'
  ) THEN
    EXECUTE 'ALTER TABLE public.simulados_iniciados ENABLE ROW LEVEL SECURITY';

    -- Remove possíveis policies de escrita antigas e abertas
    EXECUTE 'DROP POLICY IF EXISTS simulados_iniciados_insert_self ON public.simulados_iniciados';
    EXECUTE 'DROP POLICY IF EXISTS simulados_iniciados_update_self ON public.simulados_iniciados';

    EXECUTE $POL$
      CREATE POLICY simulados_iniciados_insert_self
        ON public.simulados_iniciados
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid())
    $POL$;

    EXECUTE $POL$
      CREATE POLICY simulados_iniciados_update_self
        ON public.simulados_iniciados
        FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $POL$;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- respostas_alunos (escrita por aluno autenticado)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'respostas_alunos'
  ) THEN
    EXECUTE 'ALTER TABLE public.respostas_alunos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS respostas_alunos_insert_self ON public.respostas_alunos';
    EXECUTE 'DROP POLICY IF EXISTS respostas_alunos_update_self ON public.respostas_alunos';

    EXECUTE $POL$
      CREATE POLICY respostas_alunos_insert_self
        ON public.respostas_alunos
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid())
    $POL$;

    EXECUTE $POL$
      CREATE POLICY respostas_alunos_update_self
        ON public.respostas_alunos
        FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $POL$;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Notas:
-- - As tabelas TRI (resultados_alunos_tri, resultados_ies_tri) NÃO são
--   alteradas aqui — elas são escritas pelo pipeline server-side com
--   service role e estão listadas no roadmap TRI próprio.
-- - O service role bypassa RLS por design, então as edge functions que
--   usam service role continuam funcionando.
-- - Se alguma policy custom já existir com nome diferente, ela é
--   preservada (não dropamos por padrão).
-- =====================================================================
