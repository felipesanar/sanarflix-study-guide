import type { Meta } from '@/features/gestor/api/types';
import type { SemestreVisaoGeral, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_visao_geral`, derivada do exemplo da spec
 * §8.1 (PARACATU, "Últimos 6 meses" em 22/10/2026). Os campos que o exemplo da
 * spec traz são os dele (KPIs, recência, níveis, hábito); os que ele corta
 * (`…`) foram completados com números que fecham entre si: meses, semestres e
 * consumo somam os totais dos KPIs, como as validações V12 e V13 exigem.
 * Nenhuma chave aqui é inventada: são exatamente as que a RPC emite.
 */

export const META_ENGAJAMENTO: Meta = {
  periodo: '01/05/2026 a 22/10/2026',
  fonte: 'SanarFlix: dim_aluno_b2b · fato_consumo_conteudo_b2b · fato_resolucao_questoes_b2b (camada eng_*)',
  atualizadoEm: '2026-10-22T09:02:41.5+00:00',
  criterio: 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre.',
  partial: true,
  lowSample: false,
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((1000 * n) / d) / 10 : null);

/** [base, engajados]: somam 521 e 330. */
const BASE_E_ENGAJADOS: Array<[number, number]> = [
  [40, 20], [60, 35], [35, 22], [50, 30], [30, 20], [45, 28],
  [50, 30], [80, 52], [25, 15], [45, 28], [25, 16], [36, 34],
];

const semestres = (): SemestreVisaoGeral[] =>
  BASE_E_ENGAJADOS.map(([base, engajados], i) => ({
    semestre: i + 1,
    ciclo: i + 1 <= 4 ? 'basico' : i + 1 <= 8 ? 'clinico' : 'internato',
    base,
    engajados,
    engajadosPct: pct(engajados, base),
    videosPorEngajado: 9.1,
    documentosPorEngajado: 8.4,
    questoesPorEngajado: 442,
    acertoPct: 61.0,
  }));

/** Visão geral da PARACATU, sem semestre e sem aluno. */
export function visaoGeralParacatu(): VisaoGeralEngajamento {
  // 180 + 215 + 198 + 262 + 223 + 197 alunos ativos, sobre a base de 521.
  const mesesBase = [
    ['2026-05', 180, 21000, 65.2, 1400, 800],
    ['2026-06', 215, 24000, 66.0, 1500, 900],
    ['2026-07', 198, 22000, 66.8, 1300, 700],
    ['2026-08', 262, 31000, 67.1, 1900, 1100],
    ['2026-09', 223, 28000, 66.5, 1700, 900],
    ['2026-10', 197, 19873, 65.9, 1010, 627],
  ] as const;

  return {
    ies: { id: 'd86c32ba-2d09-4c7e-a426-1d981ec7b595', nome: 'PARACATU' },
    temDados: true,
    periodo: {
      inicio: '2026-05-01',
      fim: '2026-10-22',
      dias: 175,
      hoje: '2026-10-22',
      mesReferenciaHabito: '2026-09',
      anterior: { inicio: '2025-11-07', fim: '2026-04-30', comparavelQuestoes: true, comparavelConteudos: false },
    },
    recorte: { semestre: null, aluno: null },
    kpis: {
      baseAtiva: 521,
      engajados: 330,
      engajadosPct: 63.3,
      engajadosPctAnterior: null,
      engajadosPctIes: null,
      semRetorno30: 133,
      semRetorno30Pct: 25.5,
      questoes: 145873,
      questoesPorEngajado: 442,
      acertoPct: 66.4,
      acertoPctAnterior: null,
      acertoPctIes: null,
    },
    aluno: null,
    meses: mesesBase.map(([mes, alunosAtivos, questoes, acertoPct, videos, documentos]) => ({
      mes,
      parcial: mes === '2026-10',
      alunosAtivos,
      pctBase: pct(alunosAtivos, 521),
      diasAtivos: null,
      questoes,
      acertoPct,
      videos,
      documentos,
    })),
    habito: { mes: '2026-09', ativosNoMes: 223, baixo: 133, medio: 50, alto: 35, altissimo: 5, diasAtivosAluno: null },
    niveis: [
      {
        nivel: 'frequente',
        total: 4,
        amostra: [
          { id: 'u-1', nome: 'Ana Clara Ribeiro' },
          { id: 'u-2', nome: 'Bruno Alves' },
          { id: 'u-3', nome: 'Camila Souza' },
        ],
      },
      {
        nivel: 'esporadico',
        total: 193,
        amostra: [
          { id: 'u-4', nome: 'Daniel Costa' },
          { id: 'u-5', nome: 'Elisa Martins' },
          { id: 'u-6', nome: 'Fábio Lima' },
        ],
      },
      {
        nivel: 'parou',
        total: 15,
        amostra: [
          { id: 'u-7', nome: 'Gabriela Dias' },
          { id: 'u-8', nome: 'Heitor Nunes' },
          { id: 'u-9', nome: 'Isabela Rocha' },
        ],
      },
      {
        nivel: 'nunca',
        total: 309,
        amostra: [
          { id: 'u-10', nome: 'João Pedro Silva' },
          { id: 'u-11', nome: 'Karina Pires' },
          { id: 'u-12', nome: 'Lucas Teixeira' },
        ],
      },
    ],
    recencia: {
      ativos30: 197,
      sumidos30a59: 69,
      sumidos60: 64,
      nuncaAcessou: 191,
      previaSumidos30mais: [
        {
          id: 'u-20',
          nome: 'Marina Duarte',
          semestre: 8,
          ultimaAtividade: '2026-08-02',
          diasSemAtividade: 81,
          detalhe: { dia: '2026-08-02', tipo: 'questoes', especialidade: 'Cardiologia' },
        },
        {
          id: 'u-21',
          nome: 'Nelson Prado',
          semestre: 7,
          ultimaAtividade: '2026-08-19',
          diasSemAtividade: 64,
          detalhe: { dia: '2026-08-19', tipo: 'video', especialidade: 'Farmacologia' },
        },
        {
          id: 'u-22',
          nome: 'Olívia Matos',
          semestre: 12,
          ultimaAtividade: '2026-08-27',
          diasSemAtividade: 56,
          detalhe: { dia: '2026-08-27', tipo: 'documento', especialidade: 'Obstetrícia' },
        },
        {
          id: 'u-23',
          nome: 'Paulo Reis',
          semestre: 5,
          ultimaAtividade: '2026-09-01',
          diasSemAtividade: 51,
          detalhe: { dia: '2026-09-01', tipo: 'questoes', especialidade: null },
        },
        {
          id: 'u-24',
          nome: 'Quitéria Lopes',
          semestre: 9,
          ultimaAtividade: '2026-09-10',
          diasSemAtividade: 42,
          detalhe: null,
        },
      ],
    },
    consumo: {
      questoes: { total: 145873, totalAnterior: 0, totalIes: null, acertoPct: 66.4, acertoPctAnterior: null, acertoPctIes: null, alunos: 296 },
      videos: { total: 8810, totalAnterior: null, totalIes: null, alunos: 209 },
      documentos: { total: 5027, totalAnterior: null, totalIes: null, alunos: 282 },
    },
    especialidades: [{ id: 'esp-1', nome: 'Cardiologia', ciclo: 'clinico', questoes: 9000, acertoPct: 64.1 }],
    semestres: semestres(),
  };
}

/** A mesma visão geral filtrada pelo 8º semestre (`p_semestre = 8`): vêm as notas "média da IES". */
export function visaoGeralSemestre8(): VisaoGeralEngajamento {
  const base = visaoGeralParacatu();
  return {
    ...base,
    recorte: { semestre: 8, aluno: null },
    kpis: {
      ...base.kpis,
      baseAtiva: 80,
      engajados: 52,
      engajadosPct: 65.0,
      engajadosPctIes: 63.3,
      semRetorno30: 18,
      semRetorno30Pct: 22.5,
      questoes: 23000,
      questoesPorEngajado: 442,
      acertoPct: 68.2,
      acertoPctIes: 66.4,
    },
  };
}

/** A mesma visão geral filtrada por um aluno do 8º semestre (`p_aluno`). */
export function visaoGeralComAluno(): VisaoGeralEngajamento {
  const base = visaoGeralParacatu();
  return {
    ...base,
    recorte: { semestre: null, aluno: { id: 'aluno-1', nome: 'Ana Clara Ribeiro', semestre: 8 } },
    kpis: {
      ...base.kpis,
      baseAtiva: 1,
      engajados: 1,
      engajadosPct: 100.0,
      semRetorno30: 0,
      semRetorno30Pct: 0.0,
      questoes: 1284,
      questoesPorEngajado: 1284,
      acertoPct: 74.0,
    },
    aluno: {
      situacao: 'ativo',
      ultimaAtividade: '2026-10-22',
      diasSemAtividade: 0,
      diasAtivos: 42,
      diasNoPeriodo: 175,
      diasComQuestoes: 38,
      baseSemestre: 80,
      mediaSemestreQuestoes: 420,
      mediaSemestreAcertoPct: 66.0,
      mediaSemestreVideos: 9.1,
      mediaSemestreDocumentos: 8.4,
      especialidadeMaisAssistida: { nome: 'Cardiologia', total: 21 },
      especialidadeMaisLida: { nome: 'Pediatria', total: 12 },
    },
    consumo: {
      questoes: { total: 1284, totalAnterior: 0, totalIes: null, acertoPct: 74.0, acertoPctAnterior: null, acertoPctIes: null, alunos: 1 },
      videos: { total: 142, totalAnterior: null, totalIes: null, alunos: 1 },
      documentos: { total: 61, totalAnterior: null, totalIes: null, alunos: 1 },
    },
    meses: base.meses.map((m, i) => ({ ...m, diasAtivos: [6, 8, 7, 9, 8, 4][i] })),
    habito: { mes: '2026-09', ativosNoMes: 1, baixo: 0, medio: 0, alto: 1, altissimo: 0, diasAtivosAluno: 8 },
    niveis: base.niveis.map((n) => ({
      ...n,
      total: n.nivel === 'frequente' ? 1 : 0,
      amostra: n.nivel === 'frequente' ? [{ id: 'aluno-1', nome: 'Ana Clara Ribeiro' }] : [],
    })),
    recencia: { ativos30: 1, sumidos30a59: 0, sumidos60: 0, nuncaAcessou: 0, previaSumidos30mais: [] },
  };
}

/** Variante: aluno sem nenhuma atividade (nunca acessou). */
export function visaoGeralAlunoSemAtividade(): VisaoGeralEngajamento {
  const base = visaoGeralComAluno();
  return {
    ...base,
    kpis: { ...base.kpis, engajados: 0, engajadosPct: 0.0, semRetorno30: 0, questoes: 0, questoesPorEngajado: null, acertoPct: null },
    aluno: {
      ...base.aluno!,
      situacao: 'sem_atividade',
      ultimaAtividade: null,
      diasSemAtividade: null,
      diasAtivos: 0,
      diasComQuestoes: 0,
      especialidadeMaisAssistida: null,
      especialidadeMaisLida: null,
    },
    meses: base.meses.map((m) => ({ ...m, diasAtivos: 0 })),
    habito: { mes: '2026-09', ativosNoMes: 0, baixo: 0, medio: 0, alto: 0, altissimo: 0, diasAtivosAluno: 0 },
  };
}

/** Resultado de hook (`ResultadoGestor`) com defaults de "carregado". */
export function resultadoGestor<T>(data: T | undefined, extra: Record<string, unknown> = {}) {
  return {
    data,
    meta: data === undefined ? undefined : META_ENGAJAMENTO,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: () => undefined,
    ...extra,
  };
}
