-- Onda 3 da Página do Mentor: espelho diário dos simulados B2C.
-- Estas tabelas são uma cópia diária do projeto de simulados (enamed-arena),
-- alimentada pela edge de sincronização com service role (escrita).
-- RLS ligada e SEM policy de propósito: ninguém lê direto via PostgREST;
-- a leitura acontece somente por RPCs SECURITY DEFINER.

create table public.b2c_simulados (
  id uuid primary key,
  sequence_number int not null,
  titulo text not null,
  questoes int,
  janela_inicio timestamptz,
  janela_fim timestamptz,
  status text,
  sincronizado_em timestamptz not null default now()
);

create table public.b2c_questoes (
  id uuid primary key,
  simulado_id uuid not null references public.b2c_simulados(id) on delete cascade,
  numero int not null,
  grande_area text,
  tema text,
  correta_label text
);

create table public.b2c_alunos (
  email text primary key check (email = lower(email)),
  nome text,
  segment text,
  especialidade_id uuid,
  especialidade_nome text,
  alvos jsonb not null default '[]'::jsonb,  -- [{institution_id, nome, corte_geral, corte_cota}]
  corte_mais_dificil numeric,                -- max(corte_geral) entre alvos
  sincronizado_em timestamptz not null default now()
);

create table public.b2c_tentativas (
  id uuid primary key,
  email text not null references public.b2c_alunos(email) on delete cascade,
  simulado_id uuid not null references public.b2c_simulados(id) on delete cascade,
  finalizada_em timestamptz not null,
  acerto_pct numeric not null,
  acertos int,
  respondidas int,
  modalidade text
);

create index b2c_tentativas_email on public.b2c_tentativas (email, finalizada_em desc);

create table public.b2c_respostas (
  tentativa_id uuid not null references public.b2c_tentativas(id) on delete cascade,
  questao_id uuid not null references public.b2c_questoes(id) on delete cascade,
  marcada_label text,
  correta boolean not null,
  respondida boolean not null,
  primary key (tentativa_id, questao_id)
);

create table public.b2c_sync_execucoes (
  id bigserial primary key,
  iniciado_em timestamptz not null default now(),
  terminado_em timestamptz,
  alunos int,
  tentativas int,
  respostas int,
  erro text
);

alter table public.b2c_simulados enable row level security;
alter table public.b2c_questoes enable row level security;
alter table public.b2c_alunos enable row level security;
alter table public.b2c_tentativas enable row level security;
alter table public.b2c_respostas enable row level security;
alter table public.b2c_sync_execucoes enable row level security;
