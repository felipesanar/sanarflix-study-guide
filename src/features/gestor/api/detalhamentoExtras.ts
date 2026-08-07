import type { AcertoPorAreaESemestre, AlunoNoSimulado, Detalhamento } from './types';

/**
 * Célula da matriz área × semestre. Campo aditivo do payload de
 * `get_gestor_detalhamento` (migration 20260726120000). Existe porque o
 * recorte cruzado da tela de Detalhamento tem transição de 200 ms no valor —
 * o que só fecha recalculando no cliente, sem round-trip.
 */
export interface CelulaAreaSemestre {
  areaId: string;
  semestre: number;
  acertoPct: number | null;
  amostra: number;
}

/** Recorte cruzado ativo. Mesma forma do campo `recorte` do envelope. */
export type RecorteCruzado = NonNullable<AcertoPorAreaESemestre['recorte']>;

export type AcertoPorAreaESemestreComMatriz = AcertoPorAreaESemestre & {
  matriz?: CelulaAreaSemestre[];
};

export type DetalhamentoComExtras = Detalhamento & {
  acertoPorAreaESemestre: AcertoPorAreaESemestreComMatriz;
  /** Todos os alunos do recorte, sem paginação — a tabela pagina no cliente. */
  alunos?: AlunoNoSimulado[];
};
