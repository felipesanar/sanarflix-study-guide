## Problema

No modo **"Por semestre"** da aba Visão Institucional, dois bugs aparecem assim que o modo é selecionado (antes de escolher qualquer semestre):

1. **Falta o seletor de semestres.** O `MultiSelectFilter` em `GlobalFilterBar` recebe `availableSemestres` derivado de `data.allStudents` (via `extractSemestresFromData` em `DesempenhoInstitucionalV2.tsx`). Como o hook hoje retorna `data = null` quando o modo é `semestres` sem seleção, a lista de opções fica vazia e o componente faz `return null` (`if (options.length === 0) return null`). Resultado: nenhum chip de semestres aparece.
2. **Empty state errado.** Com `data = null`, o `VisaoInstitucionalModule` cai no fallback genérico "Selecione um simulado · Escolha um simulado nos filtros acima para começar", mesmo havendo simulado selecionado.

Os modos "Padrão (6º ano)" e "Geral" continuam funcionando — o ajuste é estritamente isolado ao modo `semestres`.

## Mudanças

### 1. `src/pages/DesempenhoInstitucionalV2.tsx`
- Garantir que `availableSemestres` exista no modo "Por semestre" mesmo quando `data` ainda está `null`:
  - Manter um estado `lastSemestresOptions` que guarda o último resultado de `extractSemestresFromData(data)` não vazio.
  - Se `data` tiver alunos, atualizar `lastSemestresOptions`.
  - Se não, usar `lastSemestresOptions` (ou, como último recurso, uma lista padrão `1º…12º Semestre`) somente quando `filters.baseMode === 'semestres'`.
- Passar essa lista ao `GlobalFilterBar` via `availableSemestres`.
- Passar `filters.baseMode` ao `ModuleContentRenderer` (ou diretamente ao `VisaoInstitucionalModule`) para que o módulo possa distinguir o empty state.

Nota técnica: o `useInstitutionalPerformanceData` já busca `data` nos modos "Padrão" e "Geral" da mesma IES/simulado, então o `lastSemestresOptions` quase sempre estará populado quando o usuário trocar para "Por semestre" depois de ver os outros modos. O fallback estático cobre o caso de o usuário entrar direto no modo `semestres` via deep link.

### 2. `src/components/analytics/v2/shell/GlobalFilterBar.tsx`
- No modo `semestres`, **sempre renderizar** o `MultiSelectFilter` (mesmo com `options.length === 0`), exibindo o botão com label "Selecionar semestres". Hoje o `return null` interno do `MultiSelectFilter` esconde o controle. Solução: passar uma prop `alwaysShow` (ou inline um pequeno wrapper) que pula o early-return quando precisar mostrar mesmo vazio. Como fallback adicional, o item 1 garante que opções estarão presentes.

### 3. `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- Aceitar uma nova prop opcional `baseMode?: 'sixth-year' | 'general' | 'semestres'`.
- Quando `!data && baseMode === 'semestres'`, mostrar empty state específico:
  - Título: "Selecione ao menos um semestre"
  - Descrição: "Escolha um ou mais semestres no filtro acima para visualizar os dados desta base."
- Caso contrário, manter o fallback atual de "Selecione um simulado".

### 4. `src/components/analytics/v2/shell/ModuleContentRenderer.tsx`
- Encaminhar `baseMode` ao `VisaoInstitucionalModule` (única aba afetada).

## Fora de escopo
- Lógica das RPCs, demais abas (Diagnóstico/Visão de Alunos/etc.), KPIs, fetch de TRI/adesão. Os modos "Padrão" e "Geral" não são tocados.
