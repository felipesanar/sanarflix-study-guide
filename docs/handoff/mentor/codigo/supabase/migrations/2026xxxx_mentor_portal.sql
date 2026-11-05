-- Tabelas do ACADEMY para o Portal do Mentor.
--
-- Depois do contrato de 29/10 (docs/07), mentores, tribos, alocação, canais,
-- mural, sessões, gravações e convites ficam no FLIX e NÃO são criados aqui.
-- Aqui só o que é da ferramenta de trabalho do mentor: kanban, histórico,
-- log do aluno, rotina do grupo (B2B) e sinalizações à IES (B2B).
-- IDs de tribo, aluno, sessão e publicação são os UUIDs do Flix (sem FK).

create type mentor_tipo_intervencao as enum ('individual', 'coletiva', 'mensagem');
create type mentor_status_intervencao as enum ('afazer', 'andamento', 'feito');
create type mentor_origem_intervencao as enum ('manual', 'agenda_liberada', 'tema_critico', 'questao', 'mural', 'sessao_criada');

create table mentor_intervencao (
  id uuid primary key default gen_random_uuid(),
  tribo_id uuid not null,                   -- Flix
  mentor_user_id uuid not null references auth.users(id),
  tipo mentor_tipo_intervencao not null,
  titulo text not null check (length(trim(titulo)) > 0),
  nota text,
  aluno_ids uuid[],                         -- Flix
  grupo text,                               -- "Regrediram · 6", "Quem marcou C na Q12"
  turma_toda boolean not null default false,
  perfil text check (perfil in ('virada', 'muito_baixo', 'muito_bom')),
  status mentor_status_intervencao not null default 'afazer',
  origem mentor_origem_intervencao not null,
  referencia_id text,                       -- id da sessão/publicação no Flix ou do tema nas DAGs
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index on mentor_intervencao (tribo_id, status);
create index on mentor_intervencao (referencia_id);

create table mentor_intervencao_historico (
  id bigserial primary key,
  intervencao_id uuid not null references mentor_intervencao(id) on delete cascade,
  em timestamptz not null default now(),
  texto text not null                       -- "Status → Feito", "Comentário: …"
);

create table mentor_log_aluno (              -- "Log de interações" do drawer
  id bigserial primary key,
  tribo_id uuid not null,
  aluno_id uuid not null,
  tipo text not null check (tipo in ('whatsapp', 'mural', 'intervencao', 'agenda')),
  texto text not null,
  referencia_id text,
  em timestamptz not null default now()
);
create index on mentor_log_aluno (tribo_id, aluno_id, em desc);

create table mentor_rotina_envio (            -- B2B: grupo de WhatsApp da turma
  tribo_id uuid not null,
  semana date not null,                        -- segunda-feira da semana
  dia text not null check (dia in ('ter', 'qui', 'sex')),
  enviado_em timestamptz not null default now(),
  mentor_user_id uuid not null references auth.users(id),
  primary key (tribo_id, semana, dia)
);

create table mentor_sinalizacao_ies (          -- B2B: comitê pedagógico
  id uuid primary key default gen_random_uuid(),
  tribo_id uuid not null,
  aluno_id uuid not null,
  motivo text not null,
  comite_em date,
  em timestamptz not null default now(),
  unique (tribo_id, aluno_id, comite_em)
);

-- RLS: o mentor só acessa linhas de tribos em que é mentor. Como a fonte do
-- vínculo é o Flix, a Edge Function/RPC valida o acesso via `GET /me` (cache
-- curto em mentor_acesso_cache) antes de ler ou escrever.
create table mentor_acesso_cache (
  mentor_user_id uuid not null references auth.users(id),
  tribo_id uuid not null,
  modalidade text not null check (modalidade in ('b2c', 'b2b')),
  atualizado_em timestamptz not null default now(),
  primary key (mentor_user_id, tribo_id)
);

alter table mentor_intervencao enable row level security;
alter table mentor_intervencao_historico enable row level security;
alter table mentor_log_aluno enable row level security;
alter table mentor_rotina_envio enable row level security;
alter table mentor_sinalizacao_ies enable row level security;

create policy mentor_intervencao_rw on mentor_intervencao
  using (exists (select 1 from mentor_acesso_cache c where c.mentor_user_id = auth.uid() and c.tribo_id = mentor_intervencao.tribo_id))
  with check (exists (select 1 from mentor_acesso_cache c where c.mentor_user_id = auth.uid() and c.tribo_id = mentor_intervencao.tribo_id));
-- Repetir o mesmo padrão nas demais tabelas (pelo tribo_id).

-- registrar_evento_mentor(p_tribo_id uuid, p_evento jsonb): aplica numa
-- transação os efeitos de codigo/src/features/mentor/lib/eventosIntervencao.ts
-- (criar card, mover card ligado por referencia_id, gravar histórico e log).
