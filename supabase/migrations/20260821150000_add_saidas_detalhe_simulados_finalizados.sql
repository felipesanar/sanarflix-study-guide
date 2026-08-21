-- Detalhe das saídas de página no modo prova: [{saiu_em, voltou_em|null}, ...].
-- Dá base ao gestor/CX para julgar um bloqueio (blip de 2s vs ausência de 5min)
-- antes de decidir "liberar novamente". null = finalização sem detalhe (legado).
alter table public.simulados_finalizados
  add column if not exists saidas_detalhe jsonb;

comment on column public.simulados_finalizados.saidas_detalhe is
  'Array [{saiu_em, voltou_em|null}] com cada saída da página durante a prova; voltou_em null = não retornou (fechou/foi bloqueado fora). Preenchido a partir de 21/08/2026.';
