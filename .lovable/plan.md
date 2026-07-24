## Causa raiz

A rota `/gestor/visao-institucional` é renderizada dentro do `GestorLayout`, que envolve os módulos com `GestorFiltersProvider` (`src/experiences/gestor/GestorFiltersProvider.tsx`). Esse provider **ainda** deriva `availableSemestres` de `data.allStudents` via `extractSemestresFromData(data)`. No modo "Padrão (6º ano)", `data.allStudents` já vem recortado pela RPC ao 6º ano (sem 11 e 12) — por isso o dropdown "Selecionar semestres" só oferece 11º e 12º ao alternar direto para "Por semestre". A fonte correta (respondentes do simulado) já é calculada pelo hook `useInstitutionalPerformanceData` e exposta como `availableSemestres: number[]` — a página `DesempenhoInstitucionalV2.tsx` já foi migrada para ela, mas o `GestorFiltersProvider` não.

## Correção

Arquivo: `src/experiences/gestor/GestorFiltersProvider.tsx`

1. Ler `availableSemestres` (renomeado para `hookAvailableSemestres: number[]`) do retorno de `useInstitutionalPerformanceData(filters)`.
2. Remover `extractSemestresFromData`, o `useState<lastSemestresOptions>` e o `useEffect` que preenche esse estado — passam a ser desnecessários.
3. Manter `FALLBACK_SEMESTRES` (1–12) apenas como fallback enquanto o fetch da lista de respondentes ainda não respondeu no modo "Por semestre".
4. Recalcular `availableSemestres: SemestreOption[]` mapeando `hookAvailableSemestres` para `{ id: String(n), label: '${n}º Semestre' }` (ordenado). Se vazio e `baseMode === 'semestres'`, usar `FALLBACK_SEMESTRES`; caso contrário, `[]`.

## Fora do escopo

- Nenhuma mudança em RPCs, no hook, nos módulos de conteúdo ou em `applyDesempenhoV2Filters`.
- Nenhuma mudança visual — só a lista do dropdown passa a listar todos os semestres que responderam o simulado, como o comportamento esperado.

## Validação

- USCS + "3º Simulado - USCS" + saindo direto de "Padrão (6º ano)" para "Por semestre": dropdown lista os semestres com respondentes (6, 7, 10, 11 e 12, conforme dados atuais), não apenas 11/12.
- Alternância entre módulos do gestor preserva a lista.
- Trocar de simulado/IES atualiza a lista para os respondentes daquele par.
