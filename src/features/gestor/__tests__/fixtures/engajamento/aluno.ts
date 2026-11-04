import type { AlunoEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_aluno` (drawer, spec §8.4): `aluno`,
 * `resumo`, `meses` (uma linha por mês do período), `especialidades` (top 5) e
 * `timeline` (até 4 itens). Só as chaves que a RPC emite.
 */
export function alunoEngajamento(): AlunoEngajamento {
  return {
    aluno: {
      id: 'aluno-1',
      nome: 'Ana Clara Ribeiro',
      semestre: 8,
      situacao: 'ativo',
      ultimaAtividade: '2026-10-22',
      diasSemAtividade: 0,
    },
    resumo: {
      questoes: 1284,
      acertoPct: 74.0,
      videos: 142,
      documentos: 61,
      diasAtivos: 42,
      diasNoPeriodo: 175,
      mediaSemestreQuestoes: 420,
      mediaSemestreAcertoPct: 66.0,
    },
    meses: [
      { mes: '2026-08', parcial: false, questoes: 400, videos: 30, documentos: 10 },
      { mes: '2026-09', parcial: false, questoes: 600, videos: 20, documentos: 20 },
      { mes: '2026-10', parcial: true, questoes: 284, videos: 5, documentos: 0 },
    ],
    especialidades: [
      { id: 'esp-1', nome: 'Cardiologia', questoes: 300, acertoPct: 80.0, acertoPctSemestre: 70.0 },
      { id: 'esp-2', nome: 'Pediatria', questoes: 200, acertoPct: 45.0, acertoPctSemestre: 62.0 },
      { id: 'esp-3', nome: 'Neonatologia', questoes: 50, acertoPct: null, acertoPctSemestre: null },
    ],
    timeline: [
      { dia: '2026-10-22', tipo: 'questoes', especialidade: 'Cardiologia', questoes: 25, acertoPct: 80.0, conteudo: null },
      { dia: '2026-10-21', tipo: 'video', especialidade: 'Farmacologia', questoes: null, acertoPct: null, conteudo: 'Betabloqueadores' },
      { dia: '2026-10-19', tipo: 'documento', especialidade: 'Obstetrícia', questoes: null, acertoPct: null, conteudo: 'Pré-natal de risco' },
    ],
  };
}
