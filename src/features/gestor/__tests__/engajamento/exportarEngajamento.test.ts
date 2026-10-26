import { describe, it, expect } from 'vitest';
import { montarCsvSecoes } from '@/features/gestor/lib/exportarCsv';
import {
  nomeArquivoExportacao,
  secoesConteudos,
  secoesQuestoes,
  secoesVisaoGeral,
  textoRecorteCsv,
} from '@/features/gestor/lib/exportarEngajamento';
import { conteudosParacatu } from '../fixtures/engajamento/conteudos';
import { questoesParacatu } from '../fixtures/engajamento/questoes';
import { visaoGeralComAluno, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** "Exportar" do cabeçalho (spec 2026-10-22-engajamento §10.7, D11, P16). */

const RECORTE = { inicio: '2026-05-01', fim: '2026-10-22', semestre: null };
const REC_TXT = 'Período: 01/05/2026 a 22/10/2026 · Semestre: Todos · Aluno: Todos';

const csv = (secoes: ReturnType<typeof secoesVisaoGeral>) => montarCsvSecoes(secoes);
const linhasDe = (secoes: ReturnType<typeof secoesVisaoGeral>) => csv(secoes).replace(/^﻿/, '').split('\r\n');
const titulos = (secoes: ReturnType<typeof secoesVisaoGeral>) => secoes.map((s) => s.titulo);
const cabecalhos = (secoes: ReturnType<typeof secoesVisaoGeral>) => secoes.map((s) => s.colunas.map((c) => c.cabecalho));

describe('textoRecorteCsv', () => {
  it('período, semestre e aluno (e tipo em Conteúdos)', () => {
    expect(textoRecorteCsv(RECORTE)).toBe(REC_TXT);
    expect(textoRecorteCsv({ ...RECORTE, semestre: 8, alunoNome: 'Ana Clara Ribeiro' })).toBe(
      'Período: 01/05/2026 a 22/10/2026 · Semestre: 8º · Aluno: Ana Clara Ribeiro',
    );
    expect(textoRecorteCsv({ ...RECORTE, tipo: 'video' })).toBe(`${REC_TXT} · Tipo: Vídeo`);
  });
});

describe('nomeArquivoExportacao', () => {
  it('usa nomeArquivoCsv com ["engajamento", aba, slug da IES]', () => {
    const agora = new Date(2026, 9, 22);
    expect(nomeArquivoExportacao('visao-geral', 'PARACATU', agora)).toBe('gestor-engajamento-visao-geral-paracatu-2026-10-22.csv');
    expect(nomeArquivoExportacao('questoes', 'Centro Universitário São Lucas', agora)).toBe(
      'gestor-engajamento-questoes-centro-universitario-sao-lucas-2026-10-22.csv',
    );
    expect(nomeArquivoExportacao('conteudos', 'Integrado', agora)).toBe('gestor-engajamento-conteudos-integrado-2026-10-22.csv');
  });
});

describe('secoesVisaoGeral', () => {
  it('as 8 seções da §10.7, na ordem, cada uma com o recorte na linha do título', () => {
    const s = secoesVisaoGeral(visaoGeralParacatu(), RECORTE);
    expect(titulos(s)).toEqual([
      `Indicadores · ${REC_TXT}`,
      `Engajamento mês a mês · ${REC_TXT}`,
      `Do acesso ao hábito (set/26) · ${REC_TXT}`,
      `Nível de engajamento · ${REC_TXT}`,
      `Quem não voltou · ${REC_TXT}`,
      `Consumo por mês · ${REC_TXT}`,
      `Especialidades mais praticadas · ${REC_TXT}`,
      `Comparativo entre semestres · ${REC_TXT}`,
    ]);
  });

  it('cabeçalhos de coluna de cada seção', () => {
    expect(cabecalhos(secoesVisaoGeral(visaoGeralParacatu(), RECORTE))).toEqual([
      ['Indicador', 'Valor'],
      ['Mês', 'Alunos ativos', '% da base ativa'],
      ['Faixa', 'Alunos', '% dos ativos no mês'],
      ['Categoria', 'Alunos', '% da base'],
      ['Faixa', 'Alunos', '% da base'],
      ['Mês', 'Questões', '% de acerto', 'Vídeos', 'Documentos'],
      ['Especialidade', 'Questões', '% de acerto'],
      ['Semestre', 'Ciclo', 'Base', 'Engajados', '% engajados', 'Vídeos / aluno', 'Docs / aluno', 'Questões / aluno', '% de acerto'],
    ]);
  });

  it('os números são os da tela: indicadores, hábito, níveis e recência', () => {
    const texto = csv(secoesVisaoGeral(visaoGeralParacatu(), RECORTE));
    expect(texto).toContain('Base ativa;521');
    expect(texto).toContain('Alunos engajados;330');
    expect(texto).toContain('% de alunos engajados;63,3%');
    expect(texto).toContain('Questões resolvidas;145873');
    expect(texto).toContain('Baixo engajamento (1 a 3 dias);133;59,6%');
    expect(texto).toContain('Ativo e frequente;4;0,8%');
    expect(texto).toContain('Era frequente e parou;15;2,9%');
    expect(texto).toContain('Sumidos há 30–59 dias;69;13,2%');
    expect(texto).toContain('Nunca acessaram;191;36,7%');
  });

  it('mês parcial marcado e comparativo com os 12 semestres e o ciclo', () => {
    const l = linhasDe(secoesVisaoGeral(visaoGeralParacatu(), RECORTE));
    expect(l.some((x) => x.startsWith('out/26 (parcial);197;'))).toBe(true);
    expect(l.some((x) => x.startsWith('1º;Básico;40;20;50,0%;9,1;8,4;442;61,0%'))).toBe(true);
    expect(l.some((x) => x.startsWith('12º;Internato;'))).toBe(true);
    expect(l.filter((x) => /^\d+º;(Básico|Clínico|Internato);/.test(x))).toHaveLength(12);
  });

  it('com aluno: "Dias ativos mês a mês" no lugar do engajamento, e o nome só na linha do recorte', () => {
    const s = secoesVisaoGeral(visaoGeralComAluno(), { ...RECORTE, alunoNome: 'Ana Clara Ribeiro' });
    expect(s[1].titulo).toBe('Dias ativos mês a mês · Período: 01/05/2026 a 22/10/2026 · Semestre: Todos · Aluno: Ana Clara Ribeiro');
    expect(s[1].colunas.map((c) => c.cabecalho)).toEqual(['Mês', 'Dias ativos']);
    expect(csv(s)).toContain('mai/26;6');
  });

  it('nenhum e-mail, id de aluno ou amostra nominal no CSV agregado', () => {
    const d = visaoGeralParacatu();
    const texto = csv(secoesVisaoGeral(d, RECORTE));
    expect(texto).not.toMatch(/@/);
    for (const n of d.niveis) for (const a of n.amostra) {
      expect(texto).not.toContain(a.nome);
      expect(texto).not.toContain(a.id);
    }
    for (const p of d.recencia.previaSumidos30mais) {
      expect(texto).not.toContain(p.nome);
      expect(texto).not.toContain(p.id);
    }
  });

  it('percentual sem base vira "—", nunca NaN', () => {
    const d = visaoGeralParacatu();
    d.kpis = { ...d.kpis, baseAtiva: 0 };
    d.habito = { ...d.habito, ativosNoMes: 0 };
    const texto = csv(secoesVisaoGeral(d, RECORTE));
    expect(texto).not.toContain('NaN');
    expect(texto).toContain('Baixo engajamento (1 a 3 dias);133;—');
  });
});

describe('secoesQuestoes', () => {
  it('seções e cabeçalhos: KPIs, evolução, por semestre e taxonomia achatada', () => {
    const s = secoesQuestoes(questoesParacatu(), RECORTE);
    expect(titulos(s)).toEqual([
      `Indicadores · ${REC_TXT}`,
      `Evolução mensal · ${REC_TXT}`,
      `Por semestre · ${REC_TXT}`,
      `Taxonomia · ${REC_TXT}`,
    ]);
    expect(cabecalhos(s)).toEqual([
      ['Indicador', 'Valor'],
      ['Mês', 'Questões', '% de acerto'],
      ['Semestre', 'Questões', '% de acerto'],
      ['Ciclo', 'Nível 1', 'Nível 2', 'Nível 3', 'Questões', 'Alunos', 'Acerto %'],
    ]);
  });

  it('taxonomia: uma linha por nó de cada nível, clínico (3 níveis) e básico (2)', () => {
    const l = linhasDe(secoesQuestoes(questoesParacatu(), RECORTE));
    expect(l).toContain('Clínico;Clínica Médica;;;60000;250;67,0%');
    expect(l).toContain('Clínico;Clínica Médica;Cardiologia;;35000;200;68,0%');
    expect(l).toContain('Clínico;Clínica Médica;Cardiologia;Arritmias;20000;180;70,0%');
    expect(l).toContain('Básico;Fisiologia;;;30000;200;69,0%');
    expect(l).toContain('Básico;Fisiologia;Fisiologia cardiovascular;;18000;180;70,0%');
    // 2 grandes áreas + 3 especialidades + 5 temas + 2 disciplinas + 3 assuntos
    expect(l.filter((x) => /^(Clínico|Básico);/.test(x))).toHaveLength(15);
  });

  it('as linhas de nível 1 somam o total de questões (V11)', () => {
    const l = linhasDe(secoesQuestoes(questoesParacatu(), RECORTE));
    const nivel1 = l.filter((x) => /^(Clínico|Básico);[^;]+;;;/.test(x)).map((x) => Number(x.split(';')[4]));
    expect(nivel1.reduce((s, v) => s + v, 0)).toBe(145873);
  });

  it('com semestre filtrado, o recorte diz "Semestre: 8º"', () => {
    const s = secoesQuestoes(questoesParacatu(), { ...RECORTE, semestre: 8 });
    expect(s[0].titulo).toContain('Semestre: 8º');
  });
});

describe('secoesConteudos', () => {
  it('seções e cabeçalhos, com o tipo no recorte', () => {
    const s = secoesConteudos(conteudosParacatu(), { ...RECORTE, tipo: 'document' });
    const rec = `${REC_TXT} · Tipo: Documento`;
    expect(titulos(s)).toEqual([`Indicadores · ${rec}`, `Evolução mensal · ${rec}`, `Por semestre · ${rec}`, `Por especialidade · ${rec}`]);
    expect(cabecalhos(s)).toEqual([
      ['Indicador', 'Valor'],
      ['Mês', 'Consumos'],
      ['Semestre', 'Consumos'],
      ['Especialidade', 'Módulo', 'Conteúdo', 'Tipo', 'Consumos', 'Alunos'],
    ]);
  });

  it('árvore achatada: especialidade, módulo e conteúdo (com o tipo)', () => {
    const l = linhasDe(secoesConteudos(conteudosParacatu(), RECORTE));
    expect(l).toContain('Cardiologia;;;;7000;210');
    expect(l).toContain('Cardiologia;Arritmias;;;4000;150');
    expect(l).toContain('Cardiologia;Arritmias;Aula de ECG;Vídeo;2400;120');
    expect(l).toContain('Cardiologia;Materiais gerais;Mapa mental de cardiologia;Documento;3000;100');
    // 2 especialidades + 3 módulos + 4 conteúdos
    expect(l.filter((x) => /^(Cardiologia|Farmacologia);/.test(x))).toHaveLength(9);
  });

  it('indicadores batem com a tela e a evolução marca o mês parcial', () => {
    const texto = csv(secoesConteudos(conteudosParacatu(), RECORTE));
    expect(texto).toContain('Conteúdos consumidos;13837');
    expect(texto).toContain('Vídeos;8810');
    expect(texto).toContain('Documentos;5027');
    expect(texto).toContain('out/26 (parcial);1637');
  });

  it('sem e-mail nem id de aluno', () => {
    expect(csv(secoesConteudos(conteudosParacatu(), RECORTE))).not.toMatch(/@/);
  });
});

describe('montagem do arquivo', () => {
  it('o CSV começa com o BOM e usa ";" e quebra CRLF; seções separadas por linha em branco', () => {
    const texto = csv(secoesQuestoes(questoesParacatu(), RECORTE));
    expect(texto.startsWith('﻿')).toBe(true);
    expect(texto).toContain('\r\n\r\n');
    expect(texto.split('\r\n\r\n')).toHaveLength(4);
    expect(linhasDe(secoesQuestoes(questoesParacatu(), RECORTE))[1]).toBe('Indicador;Valor');
  });
});
