-- Portal do Gestor v2 — modalidade e datas de cronograma em simulados_admin (spec §6.2, §6.4)
-- Aditivo, nullable, sem default. Nenhum registro existente muda de significado.
-- Semântica (24/07): 'online' usa data_liberacao (quando aparece pro aluno) +
-- data_liberacao_desempenho (liberação do resultado); 'presencial' usa
-- data_realizacao (data única de aplicação).
-- data_agendada_original guarda a 1ª data marcada e permite derivar 'reagendado':
-- status 'reagendado' = data futura E data_agendada_original <> data atual (§6.4).
--
-- NÃO faz CREATE OR REPLACE FUNCTION em nenhuma das 19 RPCs com guard de feature
-- injetado direto em produção (§7.1) — recriá-las por migration versionada apagaria
-- o guard silenciosamente. Esta migration só toca simulados_admin com ALTER TABLE.

alter table public.simulados_admin
  add column if not exists modalidade             text,
  add column if not exists data_realizacao        timestamptz,
  add column if not exists data_agendada_original timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulados_admin'::regclass
      and conname  = 'simulados_admin_modalidade_check'
  ) then
    alter table public.simulados_admin
      add constraint simulados_admin_modalidade_check
      check (modalidade is null or modalidade in ('online','presencial'));
  end if;
end $$;

comment on column public.simulados_admin.modalidade is
  'online | presencial | null (não classificado). Decide qual conjunto de datas vale (spec §6.4).';
comment on column public.simulados_admin.data_realizacao is
  'Presencial: data única de aplicação. Nulo para online.';
comment on column public.simulados_admin.data_agendada_original is
  'Primeira data agendada. Permite derivar o status reagendado. Atualizada junto quando a data vira definitiva — a tag "Reagendado" some sozinha (spec §6.4).';
