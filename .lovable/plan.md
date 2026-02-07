
# Correção: Métrica "Ñ Resp." Sempre Mostra Zero

## Problema Identificado

O sistema de correção de simulados insere **uma row para CADA questão** do simulado (100 rows), independente de ter sido respondida ou não. A coluna `"respondida?"` indica se foi efetivamente respondida:

| Coluna | Valor | Significado |
|--------|-------|-------------|
| `resposta_usuario` | `null` ou `''` | Não respondeu |
| `resposta_usuario` | `'A'`, `'B'`, etc. | Respondeu |
| `"respondida?"` | `true` | Foi respondida |
| `"respondida?"` | `false` | Não foi respondida |

### Dados Reais do Seu Simulado

```text
Simulado: [CLARETIANO] 1_Simulado_2026 (4)
Total de rows em answer_progress: 100
Questões com "respondida?" = true: 4
Questões com "respondida?" = false: 96
```

### Código Atual (Problemático)

O código conta **todas as rows** (question_ids únicos = 100):

```typescript
// answerCountsRaw conta TODOS os question_ids, sem filtrar por "respondida?"
const countMap = new Map<string, Set<string>>();
all.forEach(r => {
  countMap.get(key)!.add(r.question_id); // Adiciona TODAS (100)
});
return { count: questions.size }; // Retorna 100
```

Resultado:
- Total questões = 100
- Count (todas as rows) = 100
- Não respondidas = 100 - 100 = **0** ❌

### Código Corrigido

Filtrar apenas onde `"respondida?" = true`:

```typescript
// Buscar apenas questões efetivamente respondidas
const { data: page } = await supabase
  .from('answer_progress')
  .select('user_id, simulado, question_id')
  .in('user_id', finalizadosUserIds)
  .in('simulado', participantSimuladoIds)
  .eq('"respondida?"', true)  // <-- ADICIONAR ESTE FILTRO
  .order('answer_id', { ascending: true })
  .range(from, from + PAGE_SIZE - 1);
```

Resultado esperado:
- Total questões = 100
- Count (onde respondida=true) = 4
- Não respondidas = 100 - 4 = **96** ✓

---

## Detalhes Técnicos

### Arquivo a Modificar

**`src/hooks/useSimuladosAnalytics.ts`** (linhas 446-486)

### Mudanças Específicas

1. **Query de `answerCountsRaw`** (linha ~457-463):
   - Adicionar filtro `.eq('"respondida?"', true)` para contar apenas questões realmente respondidas

2. **Cálculo de `totalQuestoes`** (linha ~643):
   - Considerar apenas questões não-anuladas conforme resposta do usuário
   - Mudar de `simQuestoes.length` para `simQuestoes.filter(q => !q.anulada).length`

### Validação Esperada

Após a correção, o simulado `[CLARETIANO] 1_Simulado_2026 (4)` deve mostrar:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Ñ Resp. | 0.0 | 96.0 |

---

## Resumo das Mudanças

```text
┌────────────────────────────────────────────────────────────┐
│ ANTES (incorreto)                                         │
├────────────────────────────────────────────────────────────┤
│ Conta TODAS as rows em answer_progress por simulado       │
│ → 100 questões "respondidas" (na verdade, só existem rows)│
│ → 100 - 100 = 0 não respondidas                           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ DEPOIS (correto)                                          │
├────────────────────────────────────────────────────────────┤
│ Conta apenas rows onde "respondida?" = true               │
│ → 4 questões efetivamente respondidas                     │
│ → (100 - anuladas) - 4 = 96 não respondidas               │
└────────────────────────────────────────────────────────────┘
```
