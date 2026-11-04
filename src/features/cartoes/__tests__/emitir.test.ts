import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  EmissaoCancelada,
  formatarDataBR,
  gerarPdf,
  montarSpecs,
  classificarAlunos,
  csvDaEmissao,
  csvDosExcluidos,
  descricaoDaExclusao,
  nomeDoArquivo,
  ordenarAlunos,
} from '../emitir.ts';
import { drawCard, fitText, slotValues } from '../render.ts';
import { TEMPLATES, ehIesUniatenas } from '../templates.ts';

const SIM = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
const ALUNOS = [
  { matricula: '2023001234', nome: 'Maria Exemplo da Silva' },
  { matricula: 'ab-12.3/x', nome: 'Çãtia Ñandú Öztürk' },
  { matricula: '99-G-12345', nome: 'Álvaro Falso' },
];

function paginas(buf: ArrayBuffer): number {
  const texto = new TextDecoder('latin1').decode(new Uint8Array(buf));
  return (texto.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe('templates', () => {
  it('os dois layouts trazem a lista de desenho', () => {
    for (const layout of ['sfa', 'uniatenas'] as const) {
      const t = TEMPLATES[layout];
      expect(t.layout).toBe(layout);
      expect(t.draw_version).toBe(layout === 'sfa' ? 3 : 1);
      expect(t.draw.length).toBeGreaterThan(30);
      expect(t.draw.some((op) => op.op === 'qr')).toBe(true);
      expect(t.draw.some((op) => op.op === 'bubbles')).toBe(true);
      expect(Object.keys(t.questions)).toHaveLength(100);
    }
    expect(TEMPLATES.sfa.matricula).toBeNull();
    expect(TEMPLATES.uniatenas.matricula?.columns).toHaveLength(8);
  });

  it('só usa operações de desenho e fontes que o interpretador conhece', () => {
    const ops = new Set(['rect', 'circle', 'line', 'poly', 'text', 'numbers', 'bubbles', 'qr']);
    for (const t of Object.values(TEMPLATES)) {
      for (const op of t.draw) {
        expect(ops.has(op.op)).toBe(true);
        if ('font' in op) expect(['Helvetica', 'Helvetica-Bold', 'Courier-Bold']).toContain(op.font);
      }
    }
  });

  it('reconhece as IES do grupo UniAtenas sem considerar acento ou caixa', () => {
    expect(ehIesUniatenas('VALENÇA')).toBe(true);
    expect(ehIesUniatenas('valenca')).toBe(true);
    expect(ehIesUniatenas(' Porto Seguro ')).toBe(true);
    expect(ehIesUniatenas('UNIFIP')).toBe(false);
  });
});

describe('ordem e formatação', () => {
  it('ordena por nome sem considerar acentos e desempata pela matrícula', () => {
    expect(ordenarAlunos(ALUNOS).map((a) => a.nome)).toEqual(['Álvaro Falso', 'Çãtia Ñandú Öztürk', 'Maria Exemplo da Silva']);
    const iguais = [
      { matricula: 'b', nome: 'Ana' },
      { matricula: 'a', nome: 'ana' },
    ];
    expect(ordenarAlunos(iguais).map((a) => a.matricula)).toEqual(['a', 'b']);
  });

  it('formata a data para dd/mm/aaaa', () => {
    expect(formatarDataBR('2026-10-25')).toBe('25/10/2026');
    expect(formatarDataBR('2026-10-25T12:00:00Z')).toBe('25/10/2026');
    expect(formatarDataBR(new Date(2026, 9, 5))).toBe('05/10/2026');
    expect(formatarDataBR(null)).toBe('');
    expect(formatarDataBR('sem data')).toBe('sem data');
  });

  it('gera um nome de arquivo seguro', () => {
    expect(nomeDoArquivo('Faculdade São José', 'SIMULADO ENAMED 2026')).toBe('cartoes_faculdade-sao-jose_simulado-enamed-2026.pdf');
    expect(nomeDoArquivo('', '')).toBe('cartoes_simulado.pdf');
  });
});

describe('montarSpecs', () => {
  it('um cartão pessoal por aluno, ordenado, com rótulo e IES do cabeçalho', () => {
    const specs = montarSpecs({ layout: 'sfa', simuladoId: SIM, nomeSimulado: 'S', ies: 'IES X', data: '01/01/2026', alunos: ALUNOS });
    expect(specs.map((s) => s.alunoNome)).toEqual(['Álvaro Falso', 'Çãtia Ñandú Öztürk', 'Maria Exemplo da Silva']);
    expect(specs.every((s) => s.model === 'personalizado' && s.ies === 'IES X')).toBe(true);
    expect(specs[0]!.label).toBe('99-G-12345');
    // a matrícula é normalizada (trim e maiúsculas) e é a mesma do QR
    expect(specs.map((s) => s.matricula)).toEqual(['99-G-12345', 'AB-12.3/X', '2023001234']);
  });

  it('a IES do aluno vale mais que a do cabeçalho', () => {
    const [spec] = montarSpecs({ layout: 'sfa', simuladoId: SIM, ies: 'A', alunos: [{ ...ALUNOS[0]!, ies: 'B' }] });
    expect(spec!.ies).toBe('B');
  });

  it('UniAtenas: o mesmo cartão repetido, sem nome', () => {
    const specs = montarSpecs({ layout: 'uniatenas', simuladoId: SIM, copias: 3 });
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({ model: 'uniatenas', ies: 'UniAtenas', label: 'UNIATENAS' });
  });

  it.each([
    [{ layout: 'sfa', simuladoId: SIM }, /informe os alunos/],
    [{ layout: 'sfa', simuladoId: SIM, alunos: [] }, /informe os alunos/],
    [{ layout: 'sfa', simuladoId: 'sim-1', alunos: ALUNOS }, /UUID/],
    [{ layout: 'sfa', simuladoId: SIM, alunos: [{ matricula: '', nome: 'X' }] }, /sem_matricula/],
    [{ layout: 'sfa', simuladoId: SIM, alunos: [{ matricula: '12 34', nome: 'X' }] }, /formato_nao_suportado/],
    [{ layout: 'sfa', simuladoId: SIM, alunos: [{ matricula: 'A'.repeat(25), nome: 'X' }] }, /formato_nao_suportado/],
    [{ layout: 'sfa', simuladoId: SIM, alunos: [{ matricula: '1', nome: 'X' }, { matricula: ' 1 ', nome: 'Y' }] }, /repetida/],
    [{ layout: 'uniatenas', simuladoId: SIM, alunos: ALUNOS }, /não é personalizado/],
    [{ layout: 'uniatenas', simuladoId: SIM, copias: 0 }, /copias/],
  ] as const)('recusa entrada inválida %#', (entrada, erro) => {
    expect(() => montarSpecs(entrada as Parameters<typeof montarSpecs>[0])).toThrow(erro);
  });
});

describe('classificarAlunos', () => {
  it('matrícula utilizável e única segue como está; os demais caem no plano B (e-mail) ou ficam fora', () => {
    const lista = [
      { nome: 'A', matricula: '2023001', email: 'a@x.com' },
      { nome: 'B', matricula: null, email: 'b@x.com' },
      { nome: 'C', matricula: '   ', email: ' C@X.com ' },
      { nome: 'D', matricula: '12 34', email: 'd@x.com' },
      { nome: 'E', matricula: 'x'.repeat(30), email: 'e@x.com' },
      { nome: 'F', matricula: '99-G-99999', email: 'f@x.com' },
      { nome: 'G', matricula: ' 99-g-99999 ', email: 'g@x.com' },
      { nome: 'H', matricula: 'ab.12', email: null },
      { nome: 'I', matricula: null, email: null },
      { nome: 'J', matricula: '', email: 'sem-arroba' },
      { nome: 'K', matricula: null, email: 'k'.repeat(60) + '@x.com' },
    ];
    const r = classificarAlunos(lista);
    expect(r.aptos.map((a) => [a.nome, a.via, a.motivoSemMatricula ?? null])).toEqual([
      ['A', 'matricula', null],
      ['B', 'email', 'sem_matricula'],
      ['C', 'email', 'sem_matricula'],
      ['D', 'email', 'formato_nao_suportado'],
      ['E', 'email', 'formato_nao_suportado'],
      ['F', 'email', 'duplicada'],
      ['G', 'email', 'duplicada'],
      ['H', 'matricula', null],
    ]);
    expect(r.excluidos.map((e) => [e.aluno.nome, e.motivo, e.motivoSemMatricula])).toEqual([
      ['I', 'sem_email', 'sem_matricula'],
      ['J', 'email_invalido', 'sem_matricula'],
      ['K', 'email_longo_demais', 'sem_matricula'],
    ]);
  });

  it('e-mail repetido deixa de fora quem precisava dele, mas não quem tem matrícula', () => {
    const r = classificarAlunos([
      { nome: 'A', matricula: '1', email: 'igual@x.com' },
      { nome: 'B', matricula: null, email: 'igual@x.com' },
      { nome: 'C', matricula: null, email: 'IGUAL@x.com' },
      { nome: 'D', matricula: null, email: 'unico@x.com' },
    ]);
    expect(r.aptos.map((a) => a.nome)).toEqual(['A', 'D']);
    expect(r.excluidos.map((e) => [e.aluno.nome, e.motivo])).toEqual([
      ['B', 'email_duplicado'],
      ['C', 'email_duplicado'],
    ]);
  });

  it('o aluno sem e-mail só fica de fora se a matrícula também não serve', () => {
    const r = classificarAlunos([
      { nome: 'A', matricula: '1' },
      { nome: 'B', matricula: null },
    ]);
    expect(r.aptos.map((a) => a.nome)).toEqual(['A']);
    expect(descricaoDaExclusao(r.excluidos[0]!)).toBe('sem matrícula cadastrada / sem e-mail cadastrado');
  });

  it('lista vazia e lista toda boa', () => {
    expect(classificarAlunos([])).toEqual({ aptos: [], excluidos: [] });
    expect(classificarAlunos(ALUNOS).excluidos).toEqual([]);
  });
});

describe('plano B em montarSpecs e nos CSVs', () => {
  it('aluno com e-mail vira cartão com QR do tipo E, sem matrícula, e o rótulo é o e-mail', () => {
    const specs = montarSpecs({
      layout: 'sfa',
      simuladoId: SIM,
      alunos: [{ nome: 'Bia Sem RA', email: ' Bia@X.com ' }, { nome: 'Ana', matricula: '2023001' }],
    });
    expect(specs.map((s) => [s.alunoNome, s.matricula ?? null, s.email ?? null, s.label])).toEqual([
      ['Ana', '2023001', null, '2023001'],
      ['Bia Sem RA', null, 'bia@x.com', 'bia@x.com'],
    ]);
  });

  it.each([
    [[{ nome: 'X', matricula: '1', email: 'a@x.com' }], /não os dois/],
    [[{ nome: 'X', email: 'sem-arroba' }], /email_invalido/],
    [[{ nome: 'X', email: 'a@x.com' }, { nome: 'Y', email: ' A@x.com ' }], /e-mail repetido/],
    [[{ nome: 'X' }], /sem_matricula/],
  ] as const)('recusa %#', (alunos, erro) => {
    expect(() => montarSpecs({ layout: 'sfa', simuladoId: SIM, alunos: alunos as never })).toThrow(erro);
  });

  it('o slot da dica só aparece no plano B', () => {
    expect(slotValues({ model: 'personalizado', simuladoId: SIM, email: 'a@x.com' }).dica_matricula).toMatch(/escreva sua matrícula/);
    expect(slotValues({ model: 'personalizado', simuladoId: SIM, matricula: '1' }).dica_matricula).toBe('');
    expect(slotValues({ model: 'personalizado', simuladoId: SIM, email: 'a@x.com' }).matricula).toBe('');
  });

  it('csvDaEmissao traz identificacao, tipo e nome, ordenado por nome', () => {
    const csv = csvDaEmissao([
      { nome: 'Zélia', matricula: ' ab-1 ' },
      { nome: 'Ana', email: 'Ana@x.com' },
    ]);
    expect(csv.slice(1)).toBe('identificacao;tipo;nome' + String.fromCharCode(13, 10) + 'ana@x.com;email;Ana' + String.fromCharCode(13, 10) + 'AB-1;matricula;Zélia' + String.fromCharCode(13, 10));
  });

  it('csvDosExcluidos explica o que falta em cada cadastro', () => {
    const { excluidos } = classificarAlunos([{ nome: 'Sem Nada', matricula: null, email: null, semestre: 7 }]);
    const csv = csvDosExcluidos(excluidos);
    expect(csv).toContain('nome;matricula;email;semestre;papel;motivo');
    expect(csv).toContain('Sem Nada;;;7;;sem matrícula cadastrada / sem e-mail cadastrado');
  });
});

describe('render', () => {
  it('slots: título, subtítulo, aluno, matrícula e rótulo', () => {
    const v = slotValues({ model: 'personalizado', simuladoId: SIM, nomeSimulado: 'ENAMED', ies: 'IES X', data: '25/10/2026', alunoNome: 'Maria', matricula: ' ab-1 ', label: 'ABC' });
    expect(v).toEqual({ titulo: 'CARTÃO-RESPOSTA — ENAMED', subtitulo: 'Instituição: IES X  •  Data: 25/10/2026', aluno: 'Maria', matricula: 'AB-1', dica_matricula: '', label: 'ABC' });
    const uni = slotValues({ model: 'uniatenas', simuladoId: SIM, alunoNome: 'ignorado', matricula: 'ignorada' });
    expect(uni.aluno).toBe('');
    expect(uni.matricula).toBe('');
    expect(slotValues({ model: 'uniatenas', simuladoId: SIM }).titulo).toBe('CARTÃO-RESPOSTA');
  });

  it('fitText: mantém o que cabe, encolhe o que não cabe e corta com reticências no mínimo', () => {
    const doc = new jsPDF({ unit: 'mm', format: [210, 297] });
    const curto = fitText(doc, 'Maria', 'Helvetica', 10.5, 100, 7);
    expect(curto).toEqual({ s: 'Maria', size: 10.5 });
    const medio = fitText(doc, 'Fulano de Tal Beltrano Ciclano Sicrano da Silva', 'Helvetica', 10.5, 60, 7);
    expect(medio.size).toBeLessThan(10.5);
    expect(medio.size).toBeGreaterThanOrEqual(7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(medio.size);
    expect(doc.getTextWidth(medio.s)).toBeLessThanOrEqual(60);
    const enorme = fitText(doc, 'X'.repeat(300), 'Helvetica', 10.5, 60, 7);
    expect(enorme.size).toBe(7);
    expect(enorme.s.endsWith('…')).toBe(true);
    doc.setFontSize(7);
    expect(doc.getTextWidth(enorme.s)).toBeLessThanOrEqual(60);
  });

  it('recusa desenhar um cartão num template de outro layout', () => {
    const doc = new jsPDF({ unit: 'mm', format: [210, 297] });
    expect(() => drawCard(doc, TEMPLATES.sfa, { model: 'uniatenas', simuladoId: SIM })).toThrow(/não combina/);
  });
});

describe('gerarPdf', () => {
  it('uma página A4 por cartão, com progresso', async () => {
    const specs = montarSpecs({ layout: 'sfa', simuladoId: SIM, nomeSimulado: 'S', ies: 'I', data: '01/01/2026', alunos: ALUNOS });
    const progresso = vi.fn();
    const buf = await gerarPdf(TEMPLATES.sfa, specs, { onProgress: progresso, ceder: 1 });
    expect(new TextDecoder('latin1').decode(new Uint8Array(buf).slice(0, 5))).toBe('%PDF-');
    expect(paginas(buf)).toBe(3);
    expect(progresso.mock.calls.map((c) => c[0])).toEqual([
      { feitas: 1, total: 3 },
      { feitas: 2, total: 3 },
      { feitas: 3, total: 3 },
    ]);
  });

  it('gera o cartão UniAtenas', async () => {
    const buf = await gerarPdf(TEMPLATES.uniatenas, montarSpecs({ layout: 'uniatenas', simuladoId: SIM, copias: 2 }));
    expect(paginas(buf)).toBe(2);
  });

  it('pode ser cancelada', async () => {
    const specs = montarSpecs({ layout: 'sfa', simuladoId: SIM, alunos: ALUNOS });
    let chamadas = 0;
    await expect(gerarPdf(TEMPLATES.sfa, specs, { shouldCancel: () => ++chamadas > 1 })).rejects.toBeInstanceOf(EmissaoCancelada);
  });

  it('recusa lista vazia', async () => {
    await expect(gerarPdf(TEMPLATES.sfa, [])).rejects.toThrow(/nenhum cartão/);
  });
});
