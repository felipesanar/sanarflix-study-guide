-- Portal do Gestor v2 — público-alvo dos avisos (spec §6.1, §6.2)
-- announcements segmenta por IES e por semestre, mas não por papel.
-- Backfill explícito para '{aluno}': sem ele, todo aviso existente apareceria
-- no portal do gestor (vazamento de comunicação de aluno).
--
-- A ordem importa: coluna nullable -> backfill -> NOT NULL -> CHECK. Invertida,
-- a migration falha sozinha, e isso é o comportamento certo — a correção é
-- completar o backfill, nunca relaxar o CHECK.
--
-- NÃO faz CREATE OR REPLACE FUNCTION em nenhuma das 19 RPCs com guard de feature
-- injetado em produção (§7.1). announcements é lida por várias delas; recriar
-- qualquer uma a partir do .sql versionado removeria o guard silenciosamente.

-- 1) coluna nullable, sem default ainda, para o backfill ser mensurável
alter table public.announcements
  add column if not exists publico_alvo text[];

-- 2) backfill de TODAS as linhas existentes
update public.announcements
set publico_alvo = array['aluno']::text[]
where publico_alvo is null;

-- 3) agora fixa default e NOT NULL
alter table public.announcements
  alter column publico_alvo set default array['aluno']::text[];

alter table public.announcements
  alter column publico_alvo set not null;

-- 4) CHECK de vocabulário: array não vazio e só valores conhecidos
--
-- Usa cardinality(), não array_length(): para um array vazio, array_length(a, 1)
-- devolve NULL (não 0), logo `NULL >= 1` é NULL, a expressão inteira vira NULL e
-- um CHECK PASSA quando avalia NULL — só false rejeita. Com array_length o CHECK
-- aceitaria publico_alvo = '{}', um aviso sem público nenhum, invisível a todos.
-- cardinality('{}') = 0, então 0 >= 1 é false e a rejeição acontece de verdade.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname  = 'announcements_publico_alvo_check'
  ) then
    alter table public.announcements
      add constraint announcements_publico_alvo_check
      check (
        cardinality(publico_alvo) >= 1
        and publico_alvo <@ array['aluno','gestor','professor']::text[]
      );
  end if;
end $$;

-- 5) índice GIN: o filtro do gestor é 'gestor' = any(publico_alvo)
create index if not exists announcements_publico_alvo_gin
  on public.announcements using gin (publico_alvo);

comment on column public.announcements.publico_alvo is
  'Personas que veem o aviso: aluno | gestor | professor. Default {aluno}. Backfill de 28/07/2026 marcou todo o histórico como {aluno} (spec §6.2).';
