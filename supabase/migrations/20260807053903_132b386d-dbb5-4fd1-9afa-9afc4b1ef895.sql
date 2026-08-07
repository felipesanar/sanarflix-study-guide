-- Task 6 do PR 1 de simplificacao de acesso (07/08): a RLS de
-- public.announcements passa a filtrar por persona.
--
-- Furo confirmado em producao em 07/08: a policy de SELECT
-- "Users can view their IES announcements" nunca considerou a coluna
-- publico_alvo (acrescentada depois, fora de uma migration deste repo --
-- nao ha arquivo de ALTER TABLE aqui; confirmado via
-- src/integrations/supabase/types.ts e leitura direta em producao). O
-- filtro por persona hoje existe SO dentro da RPC get_gestor_avisos
-- (ver 20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql:366-380).
-- Um aluno autenticado le aviso destinado a gestor direto por
-- GET /rest/v1/announcements, contornando a RPC.
--
-- Estado dos dados, confirmado em producao em 07/08: 3 avisos no total,
-- todos com publico_alvo = {aluno}; zero nulos, zero vazios, zero com
-- 'gestor'. A coluna e NOT NULL, tipo text[], default ARRAY['aluno'].
-- Nao ha linha legada em risco de ficar invisivel com este filtro.
--
-- Regra de persona escolhida (mesma particao ja usada por
-- get_gestor_avisos): o papel do LEITOR, nunca parametro. Quem tem
-- admin, gestor ou gestor_grupo -- exatamente o conjunto que guarda as
-- 11 RPCs get_gestor_* -- so ve avisos com 'gestor' em publico_alvo;
-- todo o resto (aluno, professor, atendimento, sem papel algum, etc.) so
-- ve avisos com 'aluno'. E uma particao binaria, nao uniao por papel:
-- um usuario com dois papeis (ex.: professor que tambem e gestor) cai no
-- ramo gestor e nao ve avisos de aluno por esta policy -- mesmo
-- comportamento que get_gestor_avisos ja impoe hoje para quem acessa o
-- portal do gestor. Nao ha caso real disso hoje (0 avisos com 'gestor').
--
-- Admin continua vendo TUDO independente desta mudanca: a policy
-- "Admins can manage announcements" (FOR ALL, USING has_role(admin)) e
-- permissiva e separada; postgres combina policies permissivas da mesma
-- tabela/comando com OR, entao o SELECT de um admin passa por aquela
-- policy sem depender desta. Esta migration NAO toca "Admins can manage
-- announcements".
--
-- O USING desta policy e recriado por inteiro (DROP + CREATE, RLS nao
-- tem ALTER POLICY USING) preservando as quatro condicoes que ja
-- existiam -- ativo, data_expiracao, e os tres ramos de visibilidade
-- (todas/seletivo/exceto) -- e acrescentando o quinto AND, de persona.
--
-- NAO FOI APLICADA em producao (07/08/2026).

DROP POLICY IF EXISTS "Users can view their IES announcements" ON public.announcements;

CREATE POLICY "Users can view their IES announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (data_expiracao IS NULL OR data_expiracao > now())
  AND (
    visibilidade = 'todas'
    OR (visibilidade = 'seletivo' AND get_current_user_ies_id() = ANY(ies_selecionadas))
    OR (visibilidade = 'exceto' AND NOT (get_current_user_ies_id() = ANY(ies_excluidas)))
  )
  AND (
    CASE
      WHEN has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gestor'::app_role)
        OR has_role(auth.uid(), 'gestor_grupo'::app_role)
      THEN 'gestor' = ANY(COALESCE(publico_alvo, ARRAY['aluno']::text[]))
      ELSE 'aluno' = ANY(COALESCE(publico_alvo, ARRAY['aluno']::text[]))
    END
  )
);