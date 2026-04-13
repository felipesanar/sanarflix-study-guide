

# Inserir dados de teste para o usuário João Vitor Nader no ranking de consumo

## Contexto

O usuário `joaonader@ufba.br` (UUID `c88037c4-a0e4-4501-afca-e5e40390e0d6`) está na FAME, semestre 5, onde já existem 49 alunos com dados de questões respondidas. O problema é que esse usuário não tem registro nas tabelas `supabase_to_metabase` e `consumo_metabase`, então o RankingCard na Home não mostra dados de consumo para ele.

## Plano

Uma única migration SQL que insere:

1. **`supabase_to_metabase`** — mapeia o UUID do usuário para um ID fictício de metabase (`TESTE_joaonader_mock`)
2. **`consumo_metabase`** — insere um registro com `questoes_respondidas = 150` e `videos_assistidos = 45` para esse ID fictício

Isso fará com que a RPC `get_cohort_consumo_ranking` (que já funciona para a FAME) inclua esse usuário no ranking, e o RankingCard + RankingConsumoModal exibirão a posição e os dados corretamente.

## SQL da Migration

```sql
-- Mapeamento supabase -> metabase para o usuário de teste
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
```

## O que esperar ao testar

- Na Home, o card **Ranking > CONSUMO** deve mostrar a posição do usuário (ex: #X de 121)
- Ao clicar, o **RankingConsumoModal** mostrará "Questões Respondidas: 150" e "Vídeos Assistidos: 45" com posições relativas
- Nenhuma alteração de código é necessária — apenas dados no banco

## Nenhum arquivo modificado

Apenas uma migration de dados.

