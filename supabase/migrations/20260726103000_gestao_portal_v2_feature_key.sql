-- Portal do Gestor v2 — chave de feature (spec §9)
-- Aditivo. Sob o master 'gestao.enabled' já existente: public.user_has_feature
-- exige o master ligado para qualquer chave 'gestao.%' diferente de 'gestao.enabled'
-- (migration 20260709171344), portanto nenhuma função precisa ser recriada aqui.
-- NÃO tocar em nenhuma das 19 funções com guard injetado (§7.1).
--
-- sort_order = 180, não 160 como previa o plano: o Step 1 da Task 4 mandou
-- confirmar o slot livre e ele não estava. A migration 20260709154234 já semeou
-- 'gestao.exportar' em 160 e 'gestao.ia' em 170, então 180 é o próximo livre.
-- sort_order não tem unique constraint (a PK é só `key`), então 160 não daria
-- erro — apenas empataria com 'gestao.exportar' e deixaria a ordem do board de
-- features do admin indefinida.

insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values (
  'gestao.portal_v2',
  'gestao',
  'Portal do Gestor v2',
  'Nova experiência do gestor: Início, Visão Geral e Detalhamento por Simulados. Com a chave desligada, a IES continua nas 5 telas antigas.',
  180,
  false,
  true
)
on conflict (key) do update
  set experience  = excluded.experience,
      label       = excluded.label,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_master   = excluded.is_master,
      active      = excluded.active;
