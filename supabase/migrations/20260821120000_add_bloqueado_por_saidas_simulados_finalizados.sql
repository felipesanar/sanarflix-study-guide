-- Bloqueio anti-cola por saída de página (exclusivo p/ IES com regra estrita, hoje Claretiano).
-- Marca finalizações geradas por bloqueio automático (aluno saiu da página mais de 1x no modo prova).
alter table public.simulados_finalizados
  add column if not exists bloqueado_por_saidas boolean not null default false;

comment on column public.simulados_finalizados.bloqueado_por_saidas is
  'true quando a finalização foi forçada por excesso de saídas da página no modo prova (regra anti-cola por IES). Reversível via fluxo liberado_novamente.';
