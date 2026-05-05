
# Questões Anuladas: Excluir do Total (não contar como acerto)

## Situação Atual
Questões anuladas são tratadas como **acerto automático** em todo o sistema:
- Edge function `corrigir-simulado`: salva `correct = true` para anuladas
- Páginas de correção e desempenho: `acertou = true` para anuladas
- Ranking RPC (`get_user_rankings`): conta anuladas como acerto no ranking
- Home (`useSimuladoPerformance`): inclui anuladas no cálculo de nota

## Nova Regra
Questões anuladas devem ser **completamente ignoradas** nos cálculos. Se um simulado tem 100 questões e 7 anuladas, o total passa a ser 93.

## Alterações Necessárias

### 1. Edge Function `corrigir-simulado`
- Marcar questões anuladas com `correct = null` (ou manter o valor real) em vez de `correct = true`
- No cálculo de acertos/total retornado, excluir anuladas do count

### 2. Página `SimuladoCorrecao.tsx`
- Na merge de questões: setar `acertou = null` para anuladas (em vez de `true`)
- No cálculo de `stats`: filtrar questões anuladas do total, acertos e percentual
- Manter badge visual "ANULADA" e não mostrar "Você errou" para anuladas

### 3. Página `SimuladoDesempenho.tsx`
- No cálculo de questões revisadas: `acertou = null` para anuladas
- Nos totais de acertos/erros/percentual: excluir anuladas
- No cálculo por área: excluir anuladas do total de cada área
- No PDF de prova revisada: ajustar totais

### 4. Hook `useSimuladoPerformance.ts` (Home)
- Buscar questões do simulado para identificar anuladas
- Subtrair anuladas do total ao calcular nota

### 5. RPC `get_user_rankings`
- Excluir respostas de questões anuladas do count de acertos
- JOIN com `questoes_simulado` para filtrar `anulada = false`

### 6. Hook `useSimuladosAnalytics.ts` (Admin)
- Já exclui anuladas do `totalQuestoes` (linha 614) - OK
- Verificar se `acuracia_media` (linha 654) exclui respostas de anuladas dos counts

### 7. Componente `QuestionNavigationRail.tsx`
- Manter visual distinto (purple) para anuladas - sem mudança

### 8. PDF `pdfProvaRevisada.ts`
- Ajustar totais no cabeçalho do PDF para excluir anuladas

## Detalhes Técnicos

### Migração SQL (RPC ranking)
```sql
CREATE OR REPLACE FUNCTION public.get_user_rankings(p_simulado_id uuid DEFAULT NULL)
  -- Adicionar JOIN com questoes_simulado para filtrar anuladas
  -- WHERE qs.anulada = false no cálculo de acertos
```

### Edge Function
```typescript
// Ao invés de: correct: isAnulada ? true : ...
// Usar: correct: isAnulada ? false : ... (ou null se possível)
// E no count final: excluir anuladas
```

### Frontend (padrão em todas as telas)
```typescript
// Filtrar anuladas do cálculo
const questoesValidas = questions.filter(q => !q.anulada);
const total = questoesValidas.length;
const acertos = questoesValidas.filter(q => q.acertou === true).length;
```
