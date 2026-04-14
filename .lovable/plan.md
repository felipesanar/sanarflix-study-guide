

# Reverter RPC `get_cohort_consumo_ranking` para usar tabelas Metabase

## Resumo

Desfazer a última alteração na RPC e restaurar a lógica original que usa `consumo_metabase` e `supabase_to_metabase` para obter dados de consumo.

## Alteração

Uma migration SQL que recria `get_cohort_consumo_ranking()` com a seguinte lógica:

1. **Cohort**: busca users da mesma IES + semestre (via `get_current_user_ies_id()` e `get_current_user_semester()`)
2. **Mapeamento**: JOIN `supabase_to_metabase` para obter `user_id_metabase` de cada user do cohort
3. **Consumo**: JOIN `consumo_metabase` usando `supabase_to_metabase.user_id_metabase = consumo_metabase.id`
4. **Ranking**: RANK() sobre `videos_assistidos` e `questoes_respondidas` com tratamento de zeros

## Arquivo

- Nova migration SQL (substituindo a RPC atual)
- Nenhum arquivo frontend modificado (a interface da RPC permanece igual)

