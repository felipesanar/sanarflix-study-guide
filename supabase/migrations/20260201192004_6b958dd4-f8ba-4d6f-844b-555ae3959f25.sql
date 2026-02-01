-- Configurar features básicas para IES faltantes
-- Barão de Mauá
INSERT INTO ies_features (ies_id, feature_key, enabled) VALUES 
  ('d4cce20f-84fa-41f2-935f-d2d7c2284632', 'simulados', true),
  ('d4cce20f-84fa-41f2-935f-d2d7c2284632', 'SimuladoDesempenho', true)
ON CONFLICT (ies_id, feature_key) DO NOTHING;

-- Claretiano
INSERT INTO ies_features (ies_id, feature_key, enabled) VALUES 
  ('6029b69d-a2ef-4de5-b907-91f88122bb4e', 'simulados', true),
  ('6029b69d-a2ef-4de5-b907-91f88122bb4e', 'SimuladoDesempenho', true)
ON CONFLICT (ies_id, feature_key) DO NOTHING;

-- Integrado
INSERT INTO ies_features (ies_id, feature_key, enabled) VALUES 
  ('72b19e77-c569-4bf7-a433-44563df1015f', 'simulados', true),
  ('72b19e77-c569-4bf7-a433-44563df1015f', 'SimuladoDesempenho', true)
ON CONFLICT (ies_id, feature_key) DO NOTHING;