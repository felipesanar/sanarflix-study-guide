## Objetivo
Eliminar a poluição visual da "Visão Institucional" removendo o badge de base no canto superior direito de cada KPI card e os textos "Base: ..." repetidos no corpo dos cards, mantendo uma única indicação de base na barra de contexto acima dos cards.

## Mudanças

### 1. `src/components/analytics/v2/KpiCardsGrid.tsx`
- Remover o `<span>` de badge (linhas 62–66) e a variável `showBadge`.
- Remover a prop `showBaseBadge` da interface (não usada em outro lugar relevante após a limpeza).

### 2. `src/utils/mapInstitutionalData.ts`
Limpar o sufixo `· Base: <baseLabel>` das `description` dos KPIs (linhas 229–253), mantendo somente a descrição funcional:
- "Total de Alunos" → `Alunos do simulado`
- "Nota Prevista da IES" → `Nota ${notaAtual}` (sem `· Base: …`); manter fallback `sixthYearFallback` e `Conceito TRI indisponível`.
- "Distância Próxima Faixa" → `Para próxima faixa`
- "Alunos Abaixo do Esperado" → `Abaixo de ${PROFICIENCY_THRESHOLD} pts`
- "Taxa de Adesão" → `${scopedTotalAlunos} de ${realTotalIesUsers} alunos` (remover `scopeLabelSuffix`); manter fallback.
- "Percentual de Acertos" e "Proficiência Média (TRI)" já não têm base — manter.
- Manter o campo `baseLabel` no objeto KPI (consumido em outros lugares como tooltips/relatórios) — apenas não exibido no card.

### 3. `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
Ajustar a barra de contexto (linhas ~70–94) para o formato pedido:
`Analisando N alunos · Base: <base> · Conceito previsto: Conceito X`

Onde `<base>` deriva de `data.headerSummary.conceitoMode`:
- `sixth-year` → `6º ano (11º e 12º semestres)`
- `general` → `Geral — todos os alunos que fizeram a prova`
- `semestres` → `Semestre(s): <lista>` usando `data.headerSummary.semestresAtivos` (ex.: `Semestre(s): 9, 10`)

Remover o selo lateral à direita ("Padrão · 6º ano" / "Base geral" / "Recorte por semestre") já que a base agora é descrita por extenso. Manter o aviso âmbar `sixthYearFallback`.

Remover a prop `showBaseBadge` da chamada de `<KpiCardsGrid>`.

## Fora do escopo
- Lógica de cálculo de base, TRI, sanção, filtros e dados permanece inalterada.
- Outras abas (Diagnóstico Curricular, etc.) não são afetadas.
- `headerSummary.baseLabel` continua disponível para relatórios/export.
