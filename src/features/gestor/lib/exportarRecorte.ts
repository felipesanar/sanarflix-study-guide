/**
 * Exportação do RECORTE INSTITUCIONAL (pedido de 11/08) — o export que existia
 * no painel institucional antigo e saiu junto com aquela rota. Aqui ele volta
 * como terceira opção do Início ("Exportar dados"), em dois formatos:
 *
 *  - PDF: relatório de leitura, uma folha A4 retrato com KPIs, evolução,
 *    diagnóstico por grande área e distribuição de alunos.
 *  - XLSX: planilha formatada (larguras, cabeçalho congelado, formato numérico
 *    por coluna), uma aba por bloco, para quem vai continuar a análise.
 *
 * Privacidade (handoff §7.7): NENHUM dos dois leva lista nominal de aluno — só
 * agregados que já estão na tela. O gate de `podeExportar` fica em quem chama.
 *
 * Regras de dado (CLAUDE.md §2): nada é inventado. Valor ausente sai como
 * TRAÇO no PDF e como célula VAZIA no XLSX — nunca zero.
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';
import { ROTULO_GRUPO_PLURAL, ROTULO_NIVEL, TRACO } from '@/features/gestor/lib/rotulos';

export type FormatoExport = 'pdf' | 'xlsx';

export interface DadosExportRecorte {
  iesNome: string;
  /** Rótulo legível do recorte de semestre, ex.: "6º ano" / "Geral" / "8º período". */
  semestreRotulo: string;
  visaoGeral: VisaoGeral;
  meta?: Meta;
}

const pct = (valor: number | null): string =>
  valor === null || valor === undefined || Number.isNaN(valor)
    ? TRACO
    : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const num = (valor: number | null): string =>
  valor === null || valor === undefined || Number.isNaN(valor)
    ? TRACO
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const dataBr = (iso: string | null): string => {
  if (!iso) return TRACO;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? TRACO : d.toLocaleDateString('pt-BR');
};

/** Célula de planilha: `null` vira vazio (nunca 0) — mesma regra do TRAÇO na UI. */
const celula = (valor: number | null): number | null =>
  valor === null || valor === undefined || Number.isNaN(valor) ? null : valor;

function nomeArquivo(dados: DadosExportRecorte, ext: FormatoExport): string {
  const agora = new Date();
  const data = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
  const miolo = [dados.iesNome, dados.semestreRotulo]
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `gestor-${miolo || 'recorte'}-${data}.${ext}`;
}

/* ------------------------------- blocos de dado ------------------------------ */

interface Linha {
  rotulo: string;
  valores: string[];
}

function linhasKpis(vg: VisaoGeral): Linha[] {
  const k = vg.kpis;
  return [
    {
      rotulo: 'Conceito ENAMED projetado',
      valores: [
        num(k.enamedProjetado.valor),
        k.enamedProjetado.origem === 'oficial' ? 'Nota oficial' : 'Estimado',
      ],
    },
    { rotulo: 'Alunos proficientes', valores: [pct(k.proficientesPct.valor), ''] },
    { rotulo: 'Acerto médio', valores: [pct(k.acertoPct.valor), ''] },
    {
      rotulo: 'Simulados com nota',
      valores: [
        `${k.simulados.realizados}`,
        k.simulados.contratados === null ? TRACO : `de ${k.simulados.contratados} contratados`,
      ],
    },
    { rotulo: 'Alunos matriculados no recorte', valores: [num(vg.alunosMatriculadosNoRecorte), ''] },
  ];
}

function linhasEvolucao(vg: VisaoGeral): Linha[] {
  return vg.evolucao.map((ponto, indice) => ({
    rotulo: `${indice + 1}º simulado`,
    valores: [ponto.nome, dataBr(ponto.data), pct(ponto.valor), num(ponto.participantes)],
  }));
}

function linhasDiagnostico(vg: VisaoGeral): Linha[] {
  return vg.diagnosticoResumo.flatMap((bloco) =>
    bloco.areas.map((area) => ({
      rotulo: area.nome,
      valores: [pct(area.acertoPct), ROTULO_NIVEL[bloco.nivel]],
    })),
  );
}

function linhasDistribuicao(vg: VisaoGeral): Linha[] {
  return vg.distribuicaoAlunos.map((item) => ({
    rotulo: ROTULO_GRUPO_PLURAL[item.grupo],
    valores: [num(item.quantidade), pct(item.percentual)],
  }));
}

/* ----------------------------------- PDF ----------------------------------- */

const MARGEM = 14;
const CINZA = 110;

/** Uma tabela simples desenhada à mão (sem jspdf-autotable, que não está no bundle). */
function tabela(
  doc: jsPDF,
  y: number,
  titulo: string,
  cabecalhos: string[],
  linhas: Linha[],
  larguras: number[],
): number {
  const larguraUtil = doc.internal.pageSize.getWidth() - MARGEM * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  let cursor = y;

  const novaPaginaSePreciso = (altura: number) => {
    if (cursor + altura > alturaPagina - MARGEM) {
      doc.addPage();
      cursor = MARGEM;
    }
  };

  novaPaginaSePreciso(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30);
  doc.text(titulo, MARGEM, cursor);
  cursor += 5;

  const colunas = [larguraUtil - larguras.reduce((a, b) => a + b, 0), ...larguras];
  const desenharLinha = (celulas: string[], negrito: boolean) => {
    novaPaginaSePreciso(7);
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(negrito ? CINZA : 40);
    let x = MARGEM;
    celulas.forEach((texto, i) => {
      const largura = colunas[i] ?? 25;
      const cortado = doc.splitTextToSize(texto || '', largura - 2)[0] ?? '';
      doc.text(cortado, x, cursor);
      x += largura;
    });
    cursor += 5.2;
    doc.setDrawColor(228);
    doc.line(MARGEM, cursor - 3.4, MARGEM + larguraUtil, cursor - 3.4);
  };

  desenharLinha(cabecalhos, true);
  if (linhas.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(CINZA);
    doc.text('Sem dados para este recorte.', MARGEM, cursor);
    cursor += 5.2;
  } else {
    linhas.forEach((linha) => desenharLinha([linha.rotulo, ...linha.valores], false));
  }

  return cursor + 6;
}

export function exportarRecortePdf(dados: DadosExportRecorte): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const vg = dados.visaoGeral;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(25);
  doc.text('Relatório institucional', MARGEM, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(CINZA);
  doc.text(`${dados.iesNome || 'Instituição'} · ${dados.semestreRotulo}`, MARGEM, 26.5);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}${dados.meta?.periodo ? ` · Período: ${dados.meta.periodo}` : ''}`,
    MARGEM,
    31.5,
  );

  let y = 42;
  y = tabela(doc, y, 'Indicadores do recorte', ['Indicador', 'Valor', 'Observação'], linhasKpis(vg), [30, 45]);
  y = tabela(
    doc,
    y,
    'Evolução institucional',
    ['Ordem', 'Simulado', 'Data', 'Proficiência', 'Participantes'],
    linhasEvolucao(vg),
    [60, 22, 26, 26],
  );
  y = tabela(doc, y, 'Acerto por grande área', ['Grande área', 'Acerto', 'Classificação'], linhasDiagnostico(vg), [
    24,
    50,
  ]);
  y = tabela(doc, y, 'Distribuição de alunos', ['Grupo', 'Alunos', '% do recorte'], linhasDistribuicao(vg), [26, 30]);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'Dados agregados do recorte selecionado. Nenhuma informação nominal de aluno é incluída neste arquivo.',
    MARGEM,
    Math.min(y + 2, doc.internal.pageSize.getHeight() - 8),
  );

  const arquivo = nomeArquivo(dados, 'pdf');
  doc.save(arquivo);
  return arquivo;
}

/* ----------------------------------- XLSX ---------------------------------- */

/** Formato numérico por coluna (SheetJS: `z` na célula) — percentual com 1 casa, inteiro sem casa. */
function aplicarFormato(aba: XLSX.WorkSheet, colunasPct: number[], totalLinhas: number) {
  colunasPct.forEach((col) => {
    for (let linha = 1; linha <= totalLinhas; linha += 1) {
      const ref = XLSX.utils.encode_cell({ r: linha, c: col });
      const celulaAba = aba[ref] as XLSX.CellObject | undefined;
      if (celulaAba && typeof celulaAba.v === 'number') celulaAba.z = '0.0"%"';
    }
  });
}

export function exportarRecorteXlsx(dados: DadosExportRecorte): string {
  const vg = dados.visaoGeral;
  const livro = XLSX.utils.book_new();

  const resumo = XLSX.utils.aoa_to_sheet([
    ['Relatório institucional'],
    ['Instituição', dados.iesNome || TRACO],
    ['Recorte', dados.semestreRotulo],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Período', dados.meta?.periodo ?? TRACO],
    [],
    ['Indicador', 'Valor', 'Observação'],
    [
      'Conceito ENAMED projetado (1–5)',
      celula(vg.kpis.enamedProjetado.valor),
      vg.kpis.enamedProjetado.origem === 'oficial' ? 'Nota oficial' : 'Estimado',
    ],
    ['Alunos proficientes (%)', celula(vg.kpis.proficientesPct.valor), ''],
    ['Acerto médio (%)', celula(vg.kpis.acertoPct.valor), ''],
    [
      'Simulados com nota',
      vg.kpis.simulados.realizados,
      vg.kpis.simulados.contratados === null ? 'Sem contrato cadastrado' : `de ${vg.kpis.simulados.contratados} contratados`,
    ],
    ['Alunos matriculados no recorte', vg.alunosMatriculadosNoRecorte, ''],
  ]);
  resumo['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 30 }];
  resumo['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(livro, resumo, 'Resumo');

  const evolucao = XLSX.utils.aoa_to_sheet([
    ['Ordem', 'Simulado', 'Data', 'Proficiência (%)', 'Participantes'],
    ...vg.evolucao.map((ponto, i) => [
      `${i + 1}º simulado`,
      ponto.nome,
      dataBr(ponto.data),
      celula(ponto.valor),
      ponto.participantes,
    ]),
  ]);
  evolucao['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  evolucao['!freeze'] = 'A2';
  aplicarFormato(evolucao, [3], vg.evolucao.length);
  XLSX.utils.book_append_sheet(livro, evolucao, 'Evolução');

  const areas = XLSX.utils.aoa_to_sheet([
    ['Grande área', 'Acerto (%)', 'Classificação'],
    ...vg.diagnosticoResumo.flatMap((bloco) =>
      bloco.areas.map((area) => [area.nome, celula(area.acertoPct), ROTULO_NIVEL[bloco.nivel]]),
    ),
  ]);
  areas['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 24 }];
  areas['!freeze'] = 'A2';
  aplicarFormato(areas, [1], vg.diagnosticoResumo.reduce((total, b) => total + b.areas.length, 0));
  XLSX.utils.book_append_sheet(livro, areas, 'Acerto por área');

  const distribuicao = XLSX.utils.aoa_to_sheet([
    ['Grupo', 'Alunos', '% do recorte'],
    ...vg.distribuicaoAlunos.map((item) => [
      ROTULO_GRUPO_PLURAL[item.grupo],
      item.quantidade,
      celula(item.percentual),
    ]),
  ]);
  distribuicao['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 14 }];
  distribuicao['!freeze'] = 'A2';
  aplicarFormato(distribuicao, [2], vg.distribuicaoAlunos.length);
  XLSX.utils.book_append_sheet(livro, distribuicao, 'Distribuição');

  const arquivo = nomeArquivo(dados, 'xlsx');
  XLSX.writeFile(livro, arquivo);
  return arquivo;
}

export function exportarRecorte(formato: FormatoExport, dados: DadosExportRecorte): string {
  return formato === 'pdf' ? exportarRecortePdf(dados) : exportarRecorteXlsx(dados);
}
