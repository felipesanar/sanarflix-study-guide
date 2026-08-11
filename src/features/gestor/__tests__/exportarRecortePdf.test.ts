import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import jsPDF from 'jspdf';
import {
  BLOCOS_EXPORT,
  blocosDisponiveis,
  exportarRecortePdf,
  nomeArquivoExport,
  type BlocoExport,
} from '@/features/gestor/lib/exportarRecorte';
import type { VisaoGeral } from '@/features/gestor/api/types';

const VISAO_GERAL: VisaoGeral = {
  kpis: {
    enamedProjetado: { valor: 3, delta: null, serie: [], criterio: 'x', origem: 'estimado' },
    proficientesPct: { valor: 42.4, delta: null, serie: [], criterio: 'x' },
    acertoPct: { valor: null, delta: null, serie: [], criterio: 'x' },
    simulados: { realizados: 3, contratados: null },
  },
  alunosMatriculadosNoRecorte: 312,
  evolucao: [
    { simuladoId: 's1', nome: 'Simulado ENAMED 1 · 12/03/2026', data: '2026-03-12', valor: 38.2, participantes: 210 },
    { simuladoId: 's2', nome: 'Simulado ENAMED 2 · 21/05/2026', data: '2026-05-21', valor: null, participantes: 198 },
  ],
  evolucaoPorArea: [],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'a1', nome: 'Clínica Médica', acertoPct: 82.5 }] },
    { nivel: 'critico', areas: [{ id: 'a2', nome: 'Medicina Preventiva e Social', acertoPct: 21.1 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 48, percentual: 46 },
    { grupo: 'em_variacao', quantidade: 0, percentual: null },
  ],
  dispersao: [],
  insights: [],
};

const DADOS = {
  iesNome: 'Faculdade de Medicina Exemplo',
  semestreRotulo: '6º ano',
  simuladosRotulos: ['Simulado ENAMED 1 · 12/03/2026'],
  visaoGeral: VISAO_GERAL,
};

describe('exportarRecorte — relatório institucional por blocos (11/08)', () => {
  it('nome de arquivo sem acento, em kebab-case, datado', () => {
    const nome = nomeArquivoExport(DADOS, 'pdf');
    expect(nome).toMatch(/^relatorio-faculdade-de-medicina-exemplo-6-ano-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('blocos que dependem de simulado só ficam disponíveis com simulado no recorte', () => {
    const sem = blocosDisponiveis(0);
    expect(sem.has('indicadores')).toBe(true);
    expect(sem.has('metricasSimulados')).toBe(false);
    expect(sem.has('questoes')).toBe(false);

    const um = blocosDisponiveis(1);
    expect(um.has('metricasSimulados')).toBe(true);
    expect(um.has('questoes')).toBe(true);

    const dois = blocosDisponiveis(2);
    expect(dois.has('metricasSimulados')).toBe(true);
    // "Questão por questão" exige UM simulado — comparativo não tem questão única.
    expect(dois.has('questoes')).toBe(false);
  });

  it('a lista nominal de alunos é o único bloco marcado como dado pessoal', () => {
    expect(BLOCOS_EXPORT.filter((b) => b.nominal).map((b) => b.id)).toEqual(['alunos']);
  });

  it('gera o PDF com todos os blocos escolhidos e salva com o nome esperado', () => {
    const salvos: string[] = [];
    const proto = jsPDF.prototype as unknown as Record<string, unknown>;
    const original = proto.save;
    proto.save = function (this: jsPDF, nome?: string) {
      salvos.push(nome ?? '');
      if (process.env.GESTOR_PDF_QA) {
        writeFileSync(`/tmp/${nome}`, Buffer.from(this.output('arraybuffer') as ArrayBuffer));
      }
      return this;
    };

    const blocos: BlocoExport[] = ['indicadores', 'evolucao', 'areas', 'distribuicao'];
    const arquivo = exportarRecortePdf(DADOS, blocos);
    proto.save = original;

    expect(salvos).toEqual([arquivo]);
  });
});
