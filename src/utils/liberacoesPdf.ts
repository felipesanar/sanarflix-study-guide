import jsPDF from 'jspdf';
import type { FinalizacaoRow } from '@/components/admin/simulados/liberacoes-types';
import { formatDataCurta, formatFinalizado, formatTempo } from '@/components/admin/simulados/liberacoes-format';

export const LIBERACOES_PDF_COLUMNS = ['Aluno', 'Simulado', 'Tent.', 'Finalizado', 'Tempo', 'Saídas', 'Ação'] as const;

/** Cada célula é uma lista de linhas — mesmo conteúdo da tabela na tela. */
export function buildLiberacoesPdfRows(rows: FinalizacaoRow[]): string[][][] {
  return rows.map((r) => [
    [r.user_nome ?? 'Nome não disponível', r.user_email ?? '—'],
    [r.simulado_nome ?? 'Simulado não encontrado'],
    [`#${r.tentativa_numero || 1}`],
    [formatFinalizado(r.finalizado_em)],
    [formatTempo(r.tempo_total_segundos)],
    [`${r.saidas_de_aba} aba · ${r.saidas_de_fullscreen} tela`, ...(r.bloqueado_por_saidas ? ['Bloqueado por saídas'] : [])],
    r.liberado_novamente ? ['Liberado', ...(r.liberado_em ? [formatDataCurta(r.liberado_em)] : [])] : ['Não liberado'],
  ]);
}

const sanitize = (s: string) => s.replace(/[^\u0000-\u00FF·—–]/g, '');

export function exportLiberacoesPdf(rows: FinalizacaoRow[], simuladoNome: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const widths = [70, 70, 15, 36, 20, 40, 22];
  const lineH = 4.2;
  let y = M;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(sanitize(`Liberações — ${simuladoNome}`), M, y + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Exportado em ${formatFinalizado(new Date().toISOString())} · ${rows.length} registro(s)`, M, y + 10);
  y += 16;

  const header = () => {
    doc.setFillColor(240, 240, 240); doc.rect(M, y, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    let x = M;
    LIBERACOES_PDF_COLUMNS.forEach((c, i) => { doc.text(sanitize(c), x + 2, y + 4.8); x += widths[i]; });
    y += 7;
    doc.setFont('helvetica', 'normal');
  };
  header();

  for (const cells of buildLiberacoesPdfRows(rows)) {
    const wrapped = cells.map((lines, i) => lines.flatMap((l) => doc.splitTextToSize(sanitize(l), widths[i] - 4) as string[]));
    const h = Math.max(...wrapped.map((w) => w.length)) * lineH + 3;
    if (y + h > H - M - 6) { doc.addPage(); y = M; header(); }
    let x = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, j) => {
        doc.setTextColor(j > 0 && (i === 0 || i === 6) ? 110 : 20);
        doc.text(l, x + 2, y + 4 + j * lineH);
      });
      x += widths[i];
    });
    doc.setTextColor(20);
    y += h;
    doc.setDrawColor(220); doc.line(M, y, W - M, y);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const slug = simuladoNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`liberacoes-${slug || 'simulado'}-${date}.pdf`);
}
