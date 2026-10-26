import type { AdminEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_admin_engajamento` (spec §8.10): só as chaves que a RPC emite, sem
 * dado individual de aluno. A rede soma as 3 IES do ranking (V17): base 1.000
 * (521 + 300 + 179) e 600 engajados (330 + 190 + 80).
 */
export function adminEngajamento(): AdminEngajamento {
  return {
    periodo: {
      inicio: '2026-05-01',
      fim: '2026-10-22',
      dias: 175,
      hoje: '2026-10-22',
      anterior: { inicio: '2025-11-07', fim: '2026-04-30', comparavelConteudos: false },
    },
    recorte: { semestre: null },
    rede: {
      ies: 3,
      baseAtiva: 1000,
      engajados: 600,
      engajadosPct: 60.0,
      engajadosPctRede: null,
      medianaEngajadosPctIes: 63.3,
      semRetorno30: 250,
      semRetorno30Pct: 25.0,
      questoes: 261000,
      acertoPct: 66.4,
    },
    ranking: [
      {
        iesId: 'ies-paracatu',
        nome: 'PARACATU',
        base: 521,
        engajados: 330,
        engajadosPct: 63.3,
        engajadosPctAnterior: null,
        semRetorno30Pct: 25.5,
        videosPorEngajado: 42.2,
        questoesPorEngajado: 442,
        acertoPct: 66.4,
        proficiencia: { pct: 75.0, alunos: 452, proficientes: 338, simuladoId: 'sim-1', simuladoNome: 'UNIATENAS - 10/09/26', dataReferencia: '2026-09-10' },
      },
      {
        iesId: 'ies-faculdade-b',
        nome: 'Faculdade Beta de Medicina',
        base: 300,
        engajados: 190,
        engajadosPct: 63.3,
        engajadosPctAnterior: 57.0,
        semRetorno30Pct: 30.0,
        videosPorEngajado: 12.5,
        questoesPorEngajado: 300,
        acertoPct: 70.1,
        proficiencia: { pct: 35.0, alunos: 200, proficientes: 70, simuladoId: 'sim-2', simuladoNome: 'ENAMED Beta - 01/06/26', dataReferencia: '2026-06-01' },
      },
      {
        iesId: 'ies-centro-c',
        nome: 'Centro Univ. Gama',
        base: 179,
        engajados: 80,
        engajadosPct: 44.7,
        engajadosPctAnterior: 50.0,
        semRetorno30Pct: 18.0,
        videosPorEngajado: null,
        questoesPorEngajado: null,
        acertoPct: null,
        proficiencia: null,
      },
    ],
    meses: [
      { mes: '2026-05', parcial: false, questoes: 40000, acertoPct: 65.2, videos: 3000, documentos: 1500, conteudos: 4500 },
      { mes: '2026-06', parcial: false, questoes: 45000, acertoPct: 66.0, videos: 3200, documentos: 1600, conteudos: 4800 },
      { mes: '2026-07', parcial: false, questoes: 42000, acertoPct: 66.8, videos: 2800, documentos: 1400, conteudos: 4200 },
      { mes: '2026-08', parcial: false, questoes: 50000, acertoPct: 67.1, videos: 3500, documentos: 1800, conteudos: 5300 },
      { mes: '2026-09', parcial: false, questoes: 48000, acertoPct: 66.5, videos: 3300, documentos: 1700, conteudos: 5000 },
      { mes: '2026-10', parcial: true, questoes: 36000, acertoPct: 65.9, videos: 2500, documentos: 1200, conteudos: 3700 },
    ],
    semestres: Array.from({ length: 12 }, (_, i) => ({
      semestre: i + 1,
      questoes: 20000 + i * 1000,
      acertoPct: i === 8 ? null : 60 + i,
      videos: 1000 + i * 100,
      documentos: 500 + i * 50,
      conteudos: 1500 + i * 150,
    })),
  };
}

/** Variante filtrada pelo 8º semestre: aparece "rede inteira". */
export function adminEngajamentoSemestre8(): AdminEngajamento {
  const d = adminEngajamento();
  return {
    ...d,
    recorte: { semestre: 8 },
    rede: { ...d.rede, ies: 3, baseAtiva: 170, engajados: 111, engajadosPct: 65.3, engajadosPctRede: 60.0, semRetorno30: 28, semRetorno30Pct: 16.5, questoes: 20477, acertoPct: 66.9 },
  };
}
