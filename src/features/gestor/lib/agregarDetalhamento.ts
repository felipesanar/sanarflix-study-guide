import type { CelulaAreaSemestre } from '../api/detalhamentoExtras';
import type { AlunoNoSimulado } from '../api/types';

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

export interface ProficienciaPorSemestre {
  semestre: number;
  mediaProficiencia: number;
  /** Alunos com `proficiencia !== null` naquele semestre — o denominador da média, nunca o total de matriculados. */
  amostra: number;
}

/**
 * Média de proficiência por semestre, para o resumo "Proficiência por
 * semestre" (`ProficienciaPorSemestreChart`) — o mesmo componente usa esta
 * função para o resumo e filtra `Detalhamento.alunos` direto para o
 * drill-down inline por aluno, sem depender de nenhum campo novo de RPC (a
 * mesma fonte que `TabelaAlunosSimulado` já usa hoje).
 *
 * Aluno com `semestre === null` fica fora (não há onde agrupá-lo); aluno com
 * `proficiencia === null` fica fora da MÉDIA e da amostra, mas não descarta o
 * semestre inteiro — nunca preencher ausência com zero (§4.10, mesma regra de
 * `mediaPonderadaPorParticipantes` acima). Semestre sem NENHUM aluno com nota
 * não aparece no resultado — ausência de semestre, não uma barra em 0.
 *
 * Ordenado por `semestre` DECRESCENTE (12º primeiro) — decisão de produto
 * (10/08): a ordem segue a trilha acadêmica, não o desempenho.
 */
export function agregarProficienciaPorSemestre(alunos: AlunoNoSimulado[]): ProficienciaPorSemestre[] {
  const porSemestre = new Map<number, number[]>();

  for (const aluno of alunos) {
    if (aluno.semestre === null || aluno.proficiencia === null) continue;
    const notas = porSemestre.get(aluno.semestre) ?? [];
    notas.push(aluno.proficiencia);
    porSemestre.set(aluno.semestre, notas);
  }

  return [...porSemestre.entries()]
    .map(([semestre, notas]) => ({
      semestre,
      mediaProficiencia: notas.reduce((soma, nota) => soma + nota, 0) / notas.length,
      amostra: notas.length,
    }))
    .sort((a, b) => b.semestre - a.semestre);
}
