CREATE INDEX IF NOT EXISTS eng_questoes_aluno_dia_no_cover_idx
  ON public.eng_questoes_aluno_dia_no (sanarflix_user_id, dia)
  INCLUDE (esp_id, folha_id, ciclo, n1_id, n2_id, n3_id, questoes, acertos, erros);

CREATE INDEX IF NOT EXISTS eng_consumo_aluno_dia_conteudo_cover_idx
  ON public.eng_consumo_aluno_dia_conteudo (sanarflix_user_id, dia)
  INCLUDE (content_id, content_type, especialidade, modulo, aberturas);

ANALYZE public.eng_questoes_aluno_dia_no;
ANALYZE public.eng_consumo_aluno_dia_conteudo;