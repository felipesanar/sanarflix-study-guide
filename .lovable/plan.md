# Plano: Simular execução de 2 simulados para [fauditore2912@gmail.com](mailto:fauditore2912@gmail.com)

## Contexto

- **Usuário alvo:** Felipe Souza (`fauditore2912@gmail.com`) — id `a2b29342-5c5b-4557-a018-81ef7ffca5f0`, IES `3e51663e-8766-4881-bfd1-0921678ed014`, semestre 8.
- **Simulados:** ambos com 100 questões e status `encerrado`.
  - `7abd436c-4ff3-44d1-b2ca-d4952ccd0ad7` — Simulado FUNEPE 24/03/2026
  - `9e0216dc-550f-490e-ab73-1b133671d1c7` — Simulado FUNEPE 14/04/2026
- **Estado atual:** o usuário não possui nenhum registro em `answer_progress` nem em `simulados_finalizados` para esses simulados.

## Estratégia das respostas

Para cada simulado, gerar 100 respostas com:

- **Distribuição de acertos:** 70% corretas, ~30% incorretas, ~0% em branco (`resposta_usuario = NULL`, `respondida? = false`). Isso gera resultado realista (70% de acerto).
- **Determinismo por questão:** seleção pseudoaleatória usando `md5(question_id || simulado_id)` para garantir consistência e evitar o mesmo padrão entre os dois simulados.
- **Questões anuladas (`anulada = true`):** sempre `correct = true` (regra já usada pelo `corrigir-simulado`).
- **Erros:** quando "errar", escolher uma alternativa diferente da `correta` (entre A–D, respeitando alternativas existentes).

## Passos de implementação (modo default)

1. **Migração SQL idempotente** (additiva, sem DELETE) que executa, para cada simulado:
  - `INSERT INTO simulados_iniciados` (started_at retroativo: finalização menos duração simulada).
  - `INSERT INTO answer_progress` com 100 linhas geradas via CTE a partir de `questoes_simulado`, com `answer_id = gen_random_uuid()`, `resposta_usuario`, `correct`, `respondida?` conforme estratégia acima.
  - `INSERT INTO simulados_finalizados` com `tentativa_numero = 1`, `liberado_novamente = false`, `tempo_total_segundos` realista (≈ 70% da `duracao_minutos * 60`), `saidas_de_aba = 0`, `saidas_de_fullscreen = 0`, `finalizado_em = now()`.
  - Guardas `WHERE NOT EXISTS` para não duplicar caso o script seja reaplicado.
2. **Validação pós-inserção** via `supabase--read_query`:
  - Conferir 100 linhas em `answer_progress` por simulado.
  - Conferir % de acertos próximo de 70%.
  - Conferir 1 linha em `simulados_finalizados` por simulado.

## Detalhes técnicos da geração

```sql
WITH base AS (
  SELECT
    q.id AS question_id,
    q.simulado_id,
    q.correta,
    q.anulada,
    -- bucket determinístico 0..99
    ('x' || substr(md5(q.id::text || q.simulado_id::text), 1, 8))::bit(32)::int % 100 AS bucket
  FROM questoes_simulado q
  WHERE q.simulado_id = $SIM
)
INSERT INTO answer_progress (answer_id, user_id, simulado, question_id, resposta_usuario, correct, "respondida?")
SELECT
  gen_random_uuid(),
  $USER,
  simulado_id,
  question_id,
  CASE
    WHEN bucket < 5  THEN NULL                              -- 5% em branco
    WHEN bucket < 75 THEN correta                            -- 70% corretas
    ELSE                                                     -- 25% erradas: pega 1ª letra != correta
      (ARRAY['A','B','C','D'] - ARRAY[correta])[1 + (bucket % 3)]
  END,
  CASE
    WHEN anulada THEN true
    WHEN bucket < 5 THEN false
    WHEN bucket < 75 THEN true
    ELSE false
  END,
  CASE WHEN bucket < 5 THEN false ELSE true END
FROM base;
```

(Detalhe do array-diff em Postgres: usar `unnest`+`EXCEPT` ou função auxiliar; ajustarei na migração final para garantir compatibilidade.)

## Riscos / observações

- Migração é puramente **additiva** (somente INSERTs com guarda `NOT EXISTS`), respeitando a regra do projeto.
- Se desejar, posso ajustar a taxa-alvo de acertos (ex.: 60% / 80%) — basta avisar antes da execução.

Aprove para eu aplicar a migração e validar os dados.