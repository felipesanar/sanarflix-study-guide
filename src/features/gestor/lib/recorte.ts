import type { FiltroSemestre } from '@/features/gestor/api/types';

/**
 * Parte de DADO do filtro global (spec §4.5) — o par `{ iesId, semestre }`
 * que a camada de queries recebe para as consultas que não dependem da lista
 * de simulados selecionados (Diagnóstico Curricular, Visão de Alunos). Os
 * setters de `useFiltrosGestor` (Fase 2) nunca descem para `api/queries.ts`;
 * só este par de valores desce.
 *
 * Distinto de `FiltrosGestor` (api/types.ts), que acrescenta `simulados` e é
 * o que `useVisaoGeral`/`useDetalhamento` de fato consomem — este tipo é o
 * recorte MÍNIMO usado pelas Tasks 42 (CascataDiagnostico), 45 (TabelaAlunos/
 * DrawerAluno) e 46.
 */
export interface Recorte {
  iesId: string | null;
  semestre: FiltroSemestre;
}
