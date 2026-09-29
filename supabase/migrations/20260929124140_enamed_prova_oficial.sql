-- ENAMED 2026 como prova oficial dentro de simulados_admin.
-- Adiciona: (1) flag prova_oficial em simulados_admin; (2) mapa de posições entre
-- os dois cadernos da prova (simulado_cadernos); (3) qual caderno cada aluno fez
-- (simulado_aluno_caderno). Tudo aditivo — nenhuma coluna/policy/função existente
-- é alterada.

-- =========================================================================
-- 1. Flag de prova oficial em simulados_admin
-- =========================================================================
ALTER TABLE public.simulados_admin
  ADD COLUMN IF NOT EXISTS prova_oficial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.simulados_admin.prova_oficial IS
  'Marca que este simulado é a carga de uma prova oficial (ex.: ENAMED) e não um simulado autoral. Não deve contar no contrato/recorte padrão e ganha bloco próprio no portal do gestor.';

-- =========================================================================
-- 2. Mapa de posições entre os cadernos da prova oficial
--    Cada linha diz: no caderno N, a posição P corresponde à questão X.
--    Serve pra reconciliar gabaritos quando a mesma prova circula em cadernos
--    com ordens de questão diferentes.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.simulado_cadernos (
  simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  caderno     smallint NOT NULL CHECK (caderno BETWEEN 1 AND 9),
  posicao     smallint NOT NULL CHECK (posicao > 0),
  question_id uuid NOT NULL REFERENCES public.questoes_simulado(id) ON DELETE CASCADE,
  PRIMARY KEY (simulado_id, caderno, posicao),
  UNIQUE (simulado_id, caderno, question_id)
);

COMMENT ON TABLE public.simulado_cadernos IS
  'Mapa de posições dos cadernos de uma prova oficial (ex.: ENAMED): para cada (simulado, caderno, posição) qual é a questão real em questoes_simulado. Permite que a mesma prova tenha cadernos com ordens diferentes das questões.';

-- =========================================================================
-- 3. Qual caderno cada aluno respondeu
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.simulado_aluno_caderno (
  simulado_id uuid NOT NULL REFERENCES public.simulados_admin(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caderno     smallint NOT NULL CHECK (caderno BETWEEN 1 AND 9),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (simulado_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_simulado_aluno_caderno_user_id
  ON public.simulado_aluno_caderno (user_id);

COMMENT ON TABLE public.simulado_aluno_caderno IS
  'Registra qual caderno (1..9) cada aluno respondeu em uma prova oficial (ex.: ENAMED), para reconciliar a resposta do aluno com o mapa de posições em simulado_cadernos.';

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE public.simulado_cadernos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_aluno_caderno ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'simulado_cadernos' AND policyname = 'Admins podem gerenciar simulado_cadernos'
  ) THEN
    CREATE POLICY "Admins podem gerenciar simulado_cadernos"
      ON public.simulado_cadernos
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'simulado_cadernos' AND policyname = 'Usuários podem ver simulado_cadernos'
  ) THEN
    CREATE POLICY "Usuários podem ver simulado_cadernos"
      ON public.simulado_cadernos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'simulado_aluno_caderno' AND policyname = 'Admins podem gerenciar simulado_aluno_caderno'
  ) THEN
    CREATE POLICY "Admins podem gerenciar simulado_aluno_caderno"
      ON public.simulado_aluno_caderno
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'simulado_aluno_caderno' AND policyname = 'Usuários podem ver seu próprio caderno'
  ) THEN
    CREATE POLICY "Usuários podem ver seu próprio caderno"
      ON public.simulado_aluno_caderno
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- =========================================================================
-- Grants
-- =========================================================================
REVOKE ALL ON public.simulado_cadernos FROM anon, PUBLIC;
REVOKE ALL ON public.simulado_aluno_caderno FROM anon, PUBLIC;

GRANT SELECT ON public.simulado_cadernos TO authenticated;
GRANT SELECT ON public.simulado_aluno_caderno TO authenticated;

GRANT ALL ON public.simulado_cadernos TO service_role;
GRANT ALL ON public.simulado_aluno_caderno TO service_role;
