-- Mapeamento supabase -> metabase para o usuário de teste João Vitor Nader
INSERT INTO supabase_to_metabase (id, user_id_metabase)
VALUES ('c88037c4-a0e4-4501-afca-e5e40390e0d6', 'TESTE_joaonader_mock')
ON CONFLICT (id) DO NOTHING;

-- Dados de consumo mockados
INSERT INTO consumo_metabase (id, videos_assistidos, questoes_respondidas, documentos_lidos)
VALUES ('TESTE_joaonader_mock', 45, 150, 10)
ON CONFLICT (id) DO UPDATE SET
  videos_assistidos = EXCLUDED.videos_assistidos,
  questoes_respondidas = EXCLUDED.questoes_respondidas,
  documentos_lidos = EXCLUDED.documentos_lidos;