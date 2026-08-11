-- supabase/migrations/20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql
--
-- Reintroduz o gate de rollout faseado por IES no Portal do Gestor.
-- Contexto: docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md
--
-- PARTE 1: restaura as 3 chaves de MÓDULO CONTRATADO que a migration
-- 20260807031000 apagou (gestao.enabled/exportar/ia). São pré-condição para
-- as RPCs get_institutional_* (console antigo) pararem de levantar
-- 'feature_not_enabled' -- o corpo delas NÃO é tocado aqui, só os dados de
-- configuração que elas leem via user_has_feature('gestao.enabled').
--
-- Decisão explícita (Felipe, 11/08): as 24 IES -- não só as 14 que já tinham
-- a linha antes -- recebem enabled=true nas 3 chaves, inclusive as 10 que
-- nunca tiveram linha (estado ambíguo "não contratou" vs "esqueceram").
insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values
  ('gestao.enabled',  'gestao', 'Portal do Gestor',    'Master: liga/desliga o portal do gestor inteiro para a IES', 100, true,  true),
  ('gestao.exportar', 'gestao', 'Exportar Relatórios', 'Exportação de relatórios institucionais',                    160, false, true),
  ('gestao.ia',       'gestao', 'Assistente IA',       'Assistente de IA do gestor (protótipo)',                     170, false, true)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;

insert into public.ies_features (ies_id, feature_key, enabled)
select i.id, k.feature_key, true
from public.ies i
cross join (values ('gestao.enabled'), ('gestao.exportar'), ('gestao.ia')) as k(feature_key)
on conflict (ies_id, feature_key) do update set
  enabled    = true,
  updated_at = now();

-- PARTE 2: chave NOVA, com semântica diferente da antiga -- não é mais
-- "módulo contratado" (isso agora é gestao.enabled, acima). É o toggle do
-- rollout faseado: ligada = portal novo (Início/Visão Geral/Detalhamento);
-- desligada OU SEM LINHA = console antigo (5 telas). Nasce SEM nenhuma linha
-- em ies_features -- toda IES começa no console antigo. Ativação por IES é
-- uma INSERT manual em ies_features, feita depois do vídeo tutorial + OK da
-- faculdade (inserir linha com ies_id, 'gestao.portal_v2', enabled=true).
insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values (
  'gestao.portal_v2',
  'gestao',
  'Portal do Gestor v2 (rollout)',
  'Toggle de migração faseada por IES: ligado = portal novo; desligado = console antigo. Ativado manualmente por IES após vídeo tutorial + OK da faculdade.',
  180,
  false,
  true
)
on conflict (key) do update set
  experience  = excluded.experience,
  label       = excluded.label,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_master   = excluded.is_master,
  active      = excluded.active;
