## Causa raiz

Na página "Desempenho Institucional → Visão de Alunos", o percentual de acertos por aluno é calculado pela RPC `get_institutional_student_scores`, que **exclui questões anuladas** (`COALESCE(q.anulada, false) = false`) em todos os agregados — tanto no `score_total` quanto no `total_questions`.

Verificação no banco:

| Simulado | Total questões | `anulada = true` |
|---|---|---|
| Paracatu (`71982237…`) | 100 | **0** |
| Sete Lagoas (`4dc199a6…`) | 100 | **100** |
| Passos (`a0d7fb6c…`) | 100 | **100** |
| Sorriso (`b6df9cdc…`) | 100 | **100** |

As 300 questões dos simulados de Sete Lagoas, Passos e Sorriso foram inseridas ontem com `anulada = true`. Como toda questão é considerada anulada, o RPC retorna `score_total = 0` e `total_questions = 0` para cada aluno → percentual exibido = 0%.

Os dados em `answer_progress` estão corretos (12 475/17 700 corretas em Sete Lagoas, 14 558/22 000 em Passos, 3 141/4 500 em Sorriso) e os `question_id` casam 1:1 com `questoes_simulado.id`. O problema é exclusivamente a flag `anulada`.

Provável origem: o XLSX dos 3 novos arquivos tinha uma coluna `anulada` que, ao ser convertida para booleano no script de import (executado ontem), foi tratada como sempre-verdadeira (ex.: a célula trazia texto `"Não"`/`"Sim"` mas o cast caiu em `Boolean("Não") = true`, ou o valor default ficou `true`). O import anterior do Paracatu não tinha essa coluna e por isso ficou com o default `false` da tabela.

## Plano de ação

1. **Confirmar com o usuário** se nos 3 XLSX originais (Sete Lagoas, Passos, Sorriso) alguma questão é de fato anulada. Hipóteses:
   - (a) Nenhuma questão é anulada → setar todas para `false`.
   - (b) Algumas são anuladas → reimportar a coluna `anulada` a partir dos XLSX, fazendo o parsing correto (`"Sim"`/`true`/`1` → true; demais → false).
2. **Aplicar a correção via migration** (UPDATE), restrita aos 3 simulados afetados:
   ```sql
   UPDATE public.questoes_simulado
   SET anulada = false
   WHERE simulado_id IN (
     '4dc199a6-dbd8-4d2f-b471-2e6caa26b37e',
     'a0d7fb6c-7782-4090-a490-e91a7cbe8dd8',
     'b6df9cdc-84cb-49ef-9f4e-02445819f13a'
   );
   ```
   (ou um UPDATE seletivo por `numero_questao` no caso (b)).
3. **Validar**: re-conferir contagem `anulada` por simulado e amostrar `get_institutional_student_scores` para Sete Lagoas — esperar `score_total`/`total_questions` > 0 e percentuais entre ~50–80%.
4. **Recalcular TRI** (opcional, mas recomendado): `resultados_alunos_tri` / `resultados_ies_tri` não têm linhas para esses 4 simulados, então o "Score TRI" continuará caindo no fallback de percentual (esperado). Se desejado, rodar o pipeline TRI depois.
5. **Hardening do importador** (preventivo): no próximo import via XLSX, normalizar `anulada` explicitamente — `["sim","true","1","x"].includes(String(v).trim().toLowerCase()) ? true : false` — para não repetir o erro.

## Pergunta para o usuário antes de aplicar

Os 3 XLSX (Sete Lagoas, Passos, Sorriso) tinham **alguma** questão realmente anulada, ou todas devem ficar `anulada = false`? Se houver anuladas reais, me reenvia os XLSX para eu reaplicar o parsing correto.
