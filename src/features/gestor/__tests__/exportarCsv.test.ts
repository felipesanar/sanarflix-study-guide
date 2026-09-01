import { describe, expect, it } from 'vitest';
import { montarCsv, montarCsvSecoes, nomeArquivoCsv, secaoCsv, type ColunaCsv } from '@/features/gestor/lib/exportarCsv';

interface Linha {
  nome: string;
  acerto: number | null;
}

const COLUNAS: ReadonlyArray<ColunaCsv<Linha>> = [
  { cabecalho: 'Tema', valor: (l) => l.nome },
  { cabecalho: 'Acerto (%)', valor: (l) => (l.acerto === null ? '' : String(l.acerto).replace('.', ',')) },
];

describe('exportarCsv — o arquivo que fecha o ciclo operacional (auditoria 09/08 B4)', () => {
  it('usa ; como separador e CRLF, com BOM de UTF-8 na frente', () => {
    const csv = montarCsv(COLUNAS, [{ nome: 'Cardiologia', acerto: 24.5 }]);

    // BOM: sem ele o Excel no Windows lê o arquivo como Latin-1.
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Tema;Acerto (%)\r\n');
    expect(csv).toContain('Cardiologia;24,5');
  });

  it('célula vazia onde não há dado — nunca zero, que afirmaria um desempenho não medido', () => {
    const csv = montarCsv(COLUNAS, [{ nome: 'Nefrologia', acerto: null }]);
    expect(csv.trim().endsWith('Nefrologia;')).toBe(true);
    expect(csv).not.toContain(';0');
  });

  it('escapa aspas, quebra de linha e o próprio separador', () => {
    const csv = montarCsv(COLUNAS, [{ nome: 'Tema "A"; com quebra\nna segunda linha', acerto: 1 }]);
    expect(csv).toContain('"Tema ""A""; com quebra\nna segunda linha"');
  });

  it('neutraliza injeção de fórmula: célula iniciada por =, +, - ou @ não executa no Excel', () => {
    const csv = montarCsv(COLUNAS, [{ nome: '=SOMA(A1:A9)', acerto: 1 }]);
    expect(csv).toContain("'=SOMA(A1:A9)");
    expect(csv).not.toContain(';=SOMA');
  });

  it('nome de arquivo sem acento, em kebab-case, datado', () => {
    const nome = nomeArquivoCsv(['temas', 'Clínica Médica', 'Cardiologia'], new Date(2026, 7, 9));
    expect(nome).toBe('gestor-temas-clinica-medica-cardiologia-2026-08-09.csv');
  });

  it('nome de arquivo não fica pendurado quando as partes vêm vazias', () => {
    expect(nomeArquivoCsv(['', '   '], new Date(2026, 0, 3))).toBe('gestor-recorte-2026-01-03.csv');
  });
});

describe('montarCsvSecoes — resumo do aluno + detalhamento por área no mesmo arquivo (01/09)', () => {
  it('um BOM só, título por seção e linha em branco entre blocos', () => {
    const csv = montarCsvSecoes([
      secaoCsv({ titulo: 'Resumo por simulado', colunas: COLUNAS, linhas: [{ nome: 'Cardiologia', acerto: 24.5 }] }),
      secaoCsv({ titulo: 'Detalhamento por tema', colunas: COLUNAS, linhas: [{ nome: 'Nefrologia', acerto: null }] }),
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.match(/\uFEFF/g)).toHaveLength(1);
    expect(csv).toContain('Resumo por simulado\r\nTema;Acerto (%)\r\nCardiologia;24,5');
    expect(csv).toContain('\r\n\r\nDetalhamento por tema\r\n');
    expect(csv.trim().endsWith('Nefrologia;')).toBe(true);
  });
});
