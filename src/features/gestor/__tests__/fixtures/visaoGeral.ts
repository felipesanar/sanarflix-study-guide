/**
 * Fixture única da Fase 4 (Task 37) — insumo de `VisaoGeral` reusado pelas
 * Tasks 38, 39, 40, 41, 44 e 46. Os valores de `visaoGeralFake` e
 * `visaoComUmSimulado()` espelham ao pé da letra o Step 1 da Task 37 do plano
 * (`docs/superpowers/plans/2026-07-25-portal-gestor-v2.md`), pois os agentes
 * paralelos das Tasks 38/39/40 já replicaram esses mesmos valores em fixtures
 * locais (`evolucaoPorAreaFake`, `DOIS_SEMESTRES` etc.) antes deste arquivo
 * existir — mudar os números aqui divergiria do que eles já validaram.
 *
 * `visaoComCasosDificeis()` é o insumo adicional pedido para exercitar os
 * quatro cantos onde os bugs desta fase moram: delta negativo (herdado de
 * `acertoPct`), ponto nulo dentro de uma régua de KPI, IES sem contrato
 * (`contratados: null`, nunca `0` — spec §4.10) e simulado sem nenhum
 * participante (ponto de evolução com `valor: null`).
 */
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';

export const metaFake: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

export const visaoGeralFake: VisaoGeral = {
  kpis: {
    enamedProjetado: {
      valor: 3,
      delta: 1,
      serie: [
        { rotulo: '1º simulado', valor: 2 },
        { rotulo: 'anterior', valor: 2 },
        { rotulo: 'atual', valor: 3 },
      ],
      criterio: 'Conceito 1–5 derivado do percentual de alunos proficientes do simulado',
    },
    proficientesPct: {
      valor: 62,
      delta: 4,
      serie: [
        { rotulo: '1º simulado', valor: 51 },
        { rotulo: 'anterior', valor: 58 },
        { rotulo: 'atual', valor: 62 },
      ],
      criterio: 'Proficiente = proficiência >= 60',
    },
    acertoPct: {
      valor: 57,
      delta: -2,
      serie: [
        { rotulo: '1º simulado', valor: 55 },
        { rotulo: 'anterior', valor: 59 },
        { rotulo: 'atual', valor: 57 },
      ],
      criterio: 'Acertos sobre questões respondidas',
    },
    simulados: { realizados: 3, contratados: 7 },
  },
  evolucao: [
    { simuladoId: 's1', nome: 'Simulado 1', data: '2026-03-10T00:00:00.000Z', valor: 51, participantes: 120 },
    { simuladoId: 's2', nome: 'Simulado 2', data: '2026-05-12T00:00:00.000Z', valor: 58, participantes: 118 },
    { simuladoId: 's3', nome: 'Simulado 3', data: '2026-07-14T00:00:00.000Z', valor: 62, participantes: 115 },
  ],
  evolucaoPorArea: [
    {
      area: 'Clínica Médica',
      critica: true,
      pontos: [
        { rotulo: 'Simulado 1', valor: 28 },
        { rotulo: 'Simulado 2', valor: 29 },
        { rotulo: 'Simulado 3', valor: 27 },
      ],
    },
    {
      area: 'Cirurgia',
      critica: false,
      pontos: [
        { rotulo: 'Simulado 1', valor: 58 },
        { rotulo: 'Simulado 2', valor: 60 },
        { rotulo: 'Simulado 3', valor: 61 },
      ],
    },
    {
      area: 'Pediatria',
      critica: false,
      pontos: [
        { rotulo: 'Simulado 1', valor: 52 },
        { rotulo: 'Simulado 2', valor: 54 },
        { rotulo: 'Simulado 3', valor: 55 },
      ],
    },
  ],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
    {
      nivel: 'mediano',
      areas: [
        { id: 'ga-cirurgia', nome: 'Cirurgia', acertoPct: 61 },
        { id: 'ga-pediatria', nome: 'Pediatria', acertoPct: 55 },
      ],
    },
    { nivel: 'critico', areas: [{ id: 'ga-clinica', nome: 'Clínica Médica', acertoPct: 27 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 48, percentual: 42 },
    { grupo: 'em_variacao', quantidade: 39, percentual: 34 },
    { grupo: 'consistentemente_nao_proficiente', quantidade: 28, percentual: 24 },
  ],
  dispersao: [
    { alunoId: 'a1', semestre: 11, nota: 72 },
    { alunoId: 'a2', semestre: 11, nota: 58 },
    { alunoId: 'a3', semestre: 11, nota: 64 },
    { alunoId: 'a4', semestre: 12, nota: 81 },
    { alunoId: 'a5', semestre: 12, nota: 49 },
    { alunoId: 'a6', semestre: 12, nota: 66 },
  ],
  insights: [
    { escopo: 'area', texto: 'Clínica Médica está em nível crítico nos três simulados, com desempenho estável em 27%.' },
    { escopo: 'aluno', texto: '28 alunos permanecem abaixo do limiar em todos os simulados do recorte.' },
  ],
};

/** Recorte com apenas 1 simulado realizado: régua some, gráfico não desenha linha. */
export function visaoComUmSimulado(): VisaoGeral {
  return {
    ...visaoGeralFake,
    kpis: {
      enamedProjetado: { valor: 2, delta: null, serie: [{ rotulo: 'atual', valor: 2 }], criterio: metaFake.criterio },
      proficientesPct: { valor: 51, delta: null, serie: [{ rotulo: 'atual', valor: 51 }], criterio: metaFake.criterio },
      acertoPct: { valor: 55, delta: null, serie: [{ rotulo: 'atual', valor: 55 }], criterio: metaFake.criterio },
      simulados: { realizados: 1, contratados: 7 },
    },
    evolucao: [visaoGeralFake.evolucao[0]],
    evolucaoPorArea: visaoGeralFake.evolucaoPorArea.map((area) => ({ ...area, pontos: [area.pontos[0]] })),
  };
}

/**
 * Casos difíceis de propósito, para as tasks seguintes (41, 44, 46) não
 * precisarem reinventar borda: ponto nulo dentro da régua de um KPI
 * (`proficientesPct.serie[1]`), IES sem contrato (`simulados.contratados:
 * null` — nunca `0`, spec §4.10) e um simulado sem nenhum participante
 * (`evolucao[2].valor: null`, `participantes: 0`). O delta negativo já vem de
 * `visaoGeralFake.kpis.acertoPct` e é preservado pelo spread.
 */
export function visaoComCasosDificeis(): VisaoGeral {
  return {
    ...visaoGeralFake,
    kpis: {
      ...visaoGeralFake.kpis,
      proficientesPct: {
        ...visaoGeralFake.kpis.proficientesPct,
        serie: [
          { rotulo: '1º simulado', valor: 51 },
          { rotulo: 'anterior', valor: null },
          { rotulo: 'atual', valor: 62 },
        ],
      },
      // `realizados: 2`, não 3: desde a Task de 05/08 (KPI "simulados
      // realizados" recalculado no cliente a partir de `evolucao`, ver
      // `contarSimuladosComNotaReal` em `api/queries.ts`), o numerador conta
      // só pontos com `valor !== null` — e `evolucao` abaixo tem exatamente 2
      // (s1, s2; s3 tem `valor: null`). Deixar em 3 aqui reproduziria, DENTRO
      // da própria fixture, o mesmo tipo de contradição KPI-vs-gráfico que a
      // correção existe para eliminar.
      simulados: { realizados: 2, contratados: null },
    },
    evolucao: [
      visaoGeralFake.evolucao[0],
      visaoGeralFake.evolucao[1],
      { simuladoId: 's3', nome: 'Simulado 3', data: '2026-07-14T00:00:00.000Z', valor: null, participantes: 0 },
    ],
  };
}
