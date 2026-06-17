## Objetivo
Adaptar a aba "Visão Institucional" para o novo contrato da RPC `get_institutional_tri`: filtro multisseleção de semestres, card de Conceito baseado no 6º ano (com fallback geral), e opção "Conceito Geral" que devolve Conceito/Distância/Sanção à base geral.

## Mudanças

### 1. `src/services/institutional.ts`
- Trocar o parâmetro `p_semestre: number | null` por `p_semestres: number[]` na chamada de `get_institutional_tri` (array vazio = todos).
- Atualizar a assinatura `fetchInstitutionalTri(simuladoId, iesId, semestres: number[])`.
- Estender `InstitutionalTriSnapshot` com:
  - `pcp_sixth_year: number | null`
  - `num_students_sixth_year: number | null`

### 2. `src/hooks/useInstitutionalPerformanceData.ts`
- Substituir `activeSemestre` por `activeSemestres = filters.semestres.map(Number)`.
- Remover a segunda chamada para `triInstitutional` (com `null`). Uma única chamada à RPC já traz `concept`, `pcp` geral e `pcp_sixth_year`.
- Passar `activeSemestres` para `fetchInstitutionalTri` e para o mapper.
- Contagem de `users` para Taxa de Adesão: quando houver semestres selecionados, usar `.in('semestre', activeSemestres)` em vez de `.eq`.
- Propagar a flag `conceitoGeralMode` (lida de `filters.semestres.includes('all-general')`, ver passo 4) para o mapper.

### 3. `src/utils/mapInstitutionalData.ts`
Reescrever a derivação de Conceito / Distância / Sanção:

- Recorte reagente (Total, Proficiência média, Proficientes, Abaixo do esperado) continua vindo do `triSnapshot` (que agora reflete união dos semestres selecionados).
- Novo helper `getConceitoFromPcp(pcp)` reutilizando os mesmos cortes `[40, 60, 75, 90]` já usados na "Distância Próxima Faixa" (alinhar com `getConceito` existente).
- **Modo padrão (6º ano):**
  - `basePcpForConcept = pcp_sixth_year`
  - Se `num_students_sixth_year > 0`: Conceito do card = `getConceitoFromPcp(pcp_sixth_year)`; Distância = `próximoCorte - pcp_sixth_year`; Sanção = `getSancaoFromPcp(pcp_sixth_year)`.
  - Se `num_students_sixth_year === 0`: fallback para `concept` geral e `pcp` geral; sinalizar `sixthYearFallback = true` no `headerSummary` para a UI exibir o aviso.
- **Modo "Conceito Geral":** Conceito do card = `concept` (mapeado por `conceitoFromNota`); Distância e Sanção derivadas de `pcp` geral.
- Banner de Sanção (`InstitutionalAlertBanner`): passar `percentProficientes` e `conceitoScoped` correspondentes à base ativa (6º ano ou geral).
- `HeaderSummary` ganha: `conceitoMode: 'sixth-year' | 'general'`, `sixthYearFallback: boolean`, `basePctProficientes: number | null` (para o banner).

### 4. Filtro "Conceito Geral"
- `src/types/desempenhoV2.ts`: adicionar campo opcional `conceitoGeral: boolean` em `DesempenhoV2Filters` (default `false`) e incluí-lo em `countActiveFilters`.
- `src/components/analytics/v2/shell/GlobalFilterBar.tsx`: dentro do `MultiSelectFilter` de Semestres, ou como item especial no topo da lista, adicionar a opção fixa "Conceito Geral" que alterna `conceitoGeral`. Não conta como semestre selecionado para a RPC, mas troca o modo do card de Conceito.
- `src/hooks/useDesempenhoV2State.ts`: incluir o novo campo no estado inicial e na limpeza.

### 5. `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- "Analisando N alunos" continua usando `headerSummary.totalAlunos` (= `num_students` do recorte).
- Atualizar o scope label quando houver múltiplos semestres: `do Xº, Yº e Zº semestres` (ou `dos semestres X, Y, Z`).
- O texto inline "Conceito previsto" passa a refletir o `conceitoScoped` da base ativa (6º ano / geral).
- Selo "Institucional" permanece nos cards de Conceito, Distância e Sanção (controlado por `KpiCardsGrid` via `scope: 'institutional'`).

### 6. `src/components/analytics/v2/KpiCardsGrid.tsx` (ajustes mínimos)
- Card "Nota Prevista da IES": adicionar nota de rodapé "Valor calculado com base nos alunos do 6º ano (11º e 12º semestres), público da prova do ENAMED." quando `conceitoMode === 'sixth-year'`. Quando `sixthYearFallback`, exibir aviso "Sem alunos do 6º ano — usando conceito geral".

### 7. Mocks
- `src/mocks/desempenhoInstitucionalV2.ts` e o `getMockViewModel` em `useInstitutionalPerformanceData.ts`: incluir `pcp_sixth_year` / `num_students_sixth_year` e os novos campos do `headerSummary` para o modo demo continuar consistente.

## Pontos técnicos
- A multisseleção pode incluir um único semestre: `p_semestres=[10]` deve produzir o mesmo resultado de antes.
- O card de Conceito é estático em relação ao filtro de semestres (sempre 6º ano), exceto quando "Conceito Geral" é selecionado.
- Distância e Sanção acompanham o card de Conceito: 6º ano por padrão, geral em modo "Conceito Geral", fallback para geral se não houver alunos do 6º ano.
- Não há mudança de RPC server-side neste plano — apenas consumo do novo contrato.
