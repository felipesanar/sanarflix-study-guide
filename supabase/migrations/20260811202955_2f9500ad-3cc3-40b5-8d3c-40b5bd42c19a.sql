INSERT INTO public.feature_catalog (key, experience, label, description, sort_order, is_master, active) VALUES
  ('gestao.visao_institucional', 'gestao', 'Visão Institucional', 'Módulo de visão institucional do painel de desempenho.', 110, false, true),
  ('gestao.diagnostico_curricular', 'gestao', 'Diagnóstico Curricular', 'Módulo de diagnóstico curricular por área, especialidade e tema.', 120, false, true),
  ('gestao.alunos', 'gestao', 'Visão de Alunos', 'Módulo de visão individual e comparativa de alunos.', 130, false, true),
  ('gestao.insights_pedagogicos', 'gestao', 'Insights Pedagógicos', 'Módulo de insights pedagógicos do painel de desempenho.', 140, false, true),
  ('gestao.inteligencia_decisoria', 'gestao', 'Inteligência Decisória', 'Módulo de inteligência decisória do painel de desempenho.', 150, false, true)
ON CONFLICT (key) DO UPDATE SET active = true;

INSERT INTO public.ies_features (ies_id, feature_key, enabled)
SELECT i.id, k.key, true
FROM public.ies i
CROSS JOIN (VALUES
  ('gestao.visao_institucional'),
  ('gestao.diagnostico_curricular'),
  ('gestao.alunos'),
  ('gestao.insights_pedagogicos'),
  ('gestao.inteligencia_decisoria')
) AS k(key)
ON CONFLICT (ies_id, feature_key) DO NOTHING;