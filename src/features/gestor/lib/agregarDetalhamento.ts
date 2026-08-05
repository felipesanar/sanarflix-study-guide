import type { CelulaAreaSemestre } from '../api/detalhamentoExtras';

type Area = { id: string; nome: string; acertoPct: number; critica: boolean };
type Semestre = { semestre: number; acertoPct: number; emEvidencia: boolean };

/** Áreas recalculadas para um semestre. Célula sem valor sai do recorte (§4.10). */
export function recalcularAreas(areas: Area[], matriz: CelulaAreaSemestre[], semestre: number): Area[] {
  return areas.flatMap((area) => {
    const celula = matriz.find((c) => c.areaId === area.id && c.semestre === semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...area, acertoPct: celula.acertoPct }];
  });
}

/** Semestres recalculados para uma grande área. Célula sem valor sai do recorte (§4.10). */
export function recalcularSemestres(
  semestres: Semestre[],
  matriz: CelulaAreaSemestre[],
  areaId: string,
): Semestre[] {
  return semestres.flatMap((s) => {
    const celula = matriz.find((c) => c.areaId === areaId && c.semestre === s.semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...s, acertoPct: celula.acertoPct }];
  });
}

/**
 * Média das entradas ponderada pelo número de participantes de cada simulado.
 * Entrada com `valor === null` ou sem participante fica **fora** da média (§4.10:
 * nunca preencher lacuna com zero). Sem nenhuma entrada aproveitável, `null`.
 */
export function mediaPonderadaPorParticipantes(
  entradas: { valor: number | null; participantes: number }[],
): number | null {
  let soma = 0;
  let peso = 0;

  for (const entrada of entradas) {
    if (entrada.valor === null || entrada.participantes <= 0) continue;
    soma += entrada.valor * entrada.participantes;
    peso += entrada.participantes;
  }

  return peso === 0 ? null : soma / peso;
}

/** Mediana de uma lista de valores. Lista vazia devolve `null`. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}
