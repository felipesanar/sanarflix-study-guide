## Mudanças

### 1) Exibir Conceito Previsto ao lado de "Analisando N alunos"

Em `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`, no bloco "Recorte ativo" (linhas 79-89), acrescentar — após o texto "Analisando N alunos do Xº semestre" — um separador (·) e o conceito previsto vindo de `data.headerSummary.conceitoScoped` (já calculado no hook). Exemplo final:

> Analisando **20** alunos do 10º semestre · Conceito previsto: **Conceito 5**

O texto só aparece quando `conceitoScoped` existir. Substituir também o selo da direita "RECORTE POR SEMESTRE ATIVO" — manter apenas quando `isScoped` for true (já é o caso). Nenhuma mudança em hooks/serviços; o dado já está disponível.

### 2) Remover filtros "Áreas", "Especialidades" e "Temas" do topo

Em `src/components/analytics/v2/shell/GlobalFilterBar.tsx`:
- Remover os três `<MultiSelectFilter>` correspondentes (linhas 153, 154 e 156).
- Manter apenas "Semestres".
- Ajustar a condição do separador (linha 148) para considerar apenas `availableSemestres`.

Em `src/pages/DesempenhoInstitucionalV2.tsx`:
- Parar de passar `availableAreas`, `availableEspecialidades` e `availableTemas` ao `GlobalFilterBar` e remover as funções auxiliares `extractAreasFromData`, `extractEspecialidadesFromData`, `extractTemasFromData` (não mais usadas).

Os campos `areas`, `especialidades` e `temas` continuam existindo no estado/tipos para não quebrar `useDesempenhoV2State`, `applyDesempenhoV2Filters` e a serialização da URL — apenas deixam de ter UI. Não mexer em backend/RPCs.

### Arquivos editados
- `src/components/analytics/v2/modules/VisaoInstitucionalModule.tsx`
- `src/components/analytics/v2/shell/GlobalFilterBar.tsx`
- `src/pages/DesempenhoInstitucionalV2.tsx`
