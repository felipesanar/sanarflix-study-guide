## Objetivo

Derivar a sanção regulatória **exclusivamente a partir do `concept`** (vindo de `resultados_ies_tri`), parando de usar as colunas `sanctions` e `is_restricted` do banco. Manter o `concept`, `pcp`, `mean_score` e `num_proficient` como única contribuição da tabela TRI.

## Escopo da mudança

Apenas frontend (mapeamento + tipos + UI que exibe a sanção). Nenhuma migração de banco, nenhuma alteração em RPCs, queries, cálculos TRI, simulador, autenticação ou layout.

## Arquivos afetados

1. `src/utils/mapInstitutionalData.ts` — origem da sanção
2. `src/services/institutional.ts` — tipagem do snapshot TRI
3. `src/types/desempenhoV2.ts` — checar se há tipo derivado
4. `src/utils/desempenhoV2Filters.ts` — recálculo de sanção pós-filtro
5. `src/components/analytics/v2/shell/InstitutionalAlertBanner.tsx` — apenas verificar consumo (já lê `sancao` do header)
6. `src/components/analytics/v2/MetaInstitucionalCard.tsx` — verificar consumo
7. `src/components/analytics/v2/shared/AiChatDrawer.tsx` — verificar consumo
8. `src/hooks/useInstitutionalPerformanceData.ts` — sem mudança lógica, só remoção de uso futuro de `is_restricted` se houver

## Nova regra de mapeamento (concept → sanção)

```text
concept = 1  → "Suspensão de novos ingressos"
concept = 2  → "Redução de vagas"
concept = 3  → "Proibição de aumento de vagas"
concept >= 4 → null (sem sanção)
concept null/ausente → fallback legado por % proficientes (getSancao atual)
```

Essa regra substitui a leitura direta de `triSanctions`. O fallback legado por % proficientes só é usado quando o `concept` não está disponível, garantindo retrocompatibilidade.

## Passos

### Passo 1 — Criar `getSancaoFromConcept(concept)` em `mapInstitutionalData.ts`
Função pura que recebe o `concept` numérico e devolve string ou `null` conforme a tabela acima.

### Passo 2 — Substituir uso de `triSanctions` no mapper
Em `mapInstitutionalRpcToViewModel`:
- Remover a leitura `const triSanctions = triSnapshot?.sanctions ?? null;`
- Remover a derivação atual:
  ```ts
  const sancao = hasTri
    ? (triSanctions && triSanctions.trim().length > 0 ? triSanctions : null)
    : getSancao(percentProficientes);
  ```
- Substituir por:
  ```ts
  const sancao = (hasTri && triConceptNota !== null)
    ? getSancaoFromConcept(triConceptNota)
    : getSancao(percentProficientes);
  ```
- Adicionar logs temporários conforme solicitado:
  ```ts
  console.log('[TRI] Concept loaded:', triConceptNota);
  console.log('[TRI] Regulatory status derived from concept:', sancao);
  ```

### Passo 3 — Limpar tipo (opcional, seguro)
Em `src/services/institutional.ts`:
- Manter os campos `sanctions` e `is_restricted` no tipo `InstitutionalTriSnapshot` (a RPC ainda retorna), mas **não consumi-los** em lugar nenhum. Isso preserva compatibilidade com o tipo do retorno da RPC sem tocar no banco.

### Passo 4 — Ajustar `desempenhoV2Filters.ts`
Verificar se há um recálculo paralelo de `sancao` ao aplicar filtros (memória do projeto indica que sim, via heurística por % proficientes). Substituir essa heurística para preservar o `sancao` derivado pelo `concept` quando o conceito estiver disponível no view-model original; caso contrário, manter o fallback por % proficientes existente.

### Passo 5 — Verificação de consumidores
- `InstitutionalAlertBanner` lê `sancao` do `headerSummary` → já compatível.
- `MetaInstitucionalCard` lê `sancaoRegulatoriaLabel` do `meta` → já compatível.
- `AiChatDrawer` lê `headerSummary.sancao` → já compatível.
Nenhum desses precisa de mudança funcional além do que vier naturalmente do mapper.

### Passo 6 — Validação
- Buscar com `rg` por usos remanescentes de `triSanctions`, `is_restricted` e `sanctions` em `src/` para garantir que nenhum consumidor depende deles.
- Conferir build TypeScript (sem editar `types.ts`).
- Validar visualmente no `/desempenho-institucional` que a faixa do banner muda conforme o `concept` (1→crítico, 4–5→sem sanção).

## Critérios de sucesso

- `triSnapshot.sanctions` e `triSnapshot.is_restricted` não são lidos em lugar nenhum do `src/`.
- A sanção exibida (banner, meta card, IA, export) vem 100% do `concept` quando ele existe.
- Fallback por % proficientes preservado quando `concept` é nulo.
- Nenhum visual, layout, cálculo TRI, RPC ou tabela alterado.
- Sem erros de TypeScript ou console.
