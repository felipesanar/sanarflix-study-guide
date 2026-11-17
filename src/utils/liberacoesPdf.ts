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

const WINE: [number, number, number] = [147, 31, 31];
const WINE_DARK: [number, number, number] = [105, 22, 22];
const WINE_LIGHTEST: [number, number, number] = [253, 247, 247];
const WINE_LIGHTER: [number, number, number] = [248, 226, 226];

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/sanarflix-academy-lockup-red.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function exportLiberacoesPdf(rows: FinalizacaoRow[], simuladoNome: string) {
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const widths = [70, 70, 15, 36, 20, 40, 22];
  const lineH = 4.2;
  let y = M;

  // Faixa de marca
  const HB = 30;
  doc.setFillColor(...WINE_DARK); doc.rect(0, 0, W, HB, 'F');
  doc.setFillColor(...WINE); doc.rect(0, 0, W * 0.62, HB, 'F');
  doc.triangle(W * 0.62, 0, W * 0.62 + 18, 0, W * 0.62, HB, 'F');
  if (logo) {
    doc.setFillColor(255, 255, 255); doc.roundedRect(M - 3, 6, 62, 18, 3, 3, 'F');
    try { doc.addImage(logo, 'PNG', M, 8, 54, 14); } catch { /* fallback abaixo */ }
  } else {
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('SanarFlix Academy', M, 18);
  }
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Relatório de Liberações', W - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`Exportado em ${formatFinalizado(new Date().toISOString())}`, W - M, 19.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`${rows.length} registro(s)`, W - M, 24.5, { align: 'right' });
  doc.setFillColor(...WINE_LIGHTER); doc.rect(0, HB, W, 1.2, 'F');
  y = HB + 8;


  const header = () => {
    doc.setFillColor(...WINE); doc.rect(M, y, W - 2 * M, 7, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    let x = M;
    LIBERACOES_PDF_COLUMNS.forEach((c, i) => { doc.text(sanitize(c), x + 2, y + 4.8); x += widths[i]; });
    y += 7;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
  };
  header();

  let idx = 0;
  for (const cells of buildLiberacoesPdfRows(rows)) {
    const wrapped = cells.map((lines, i) => lines.flatMap((l) => doc.splitTextToSize(sanitize(l), widths[i] - 4) as string[]));
    const h = Math.max(...wrapped.map((w) => w.length)) * lineH + 3;
    if (y + h > H - 14) { doc.addPage(); y = M; header(); }
    if (idx++ % 2 === 1) { doc.setFillColor(...WINE_LIGHTEST); doc.rect(M, y, W - 2 * M, h, 'F'); }
    let x = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, j) => {
        const liberado = i === 6 && j === 0 && l === 'Liberado';
        const bloqueado = i === 5 && l === 'Bloqueado por saídas';
        if (liberado || bloqueado) { doc.setTextColor(...WINE); doc.setFont('helvetica', 'bold'); }
        else { doc.setTextColor(j > 0 && (i === 0 || i === 6) ? 110 : 20); doc.setFont('helvetica', i === 0 && j === 0 ? 'bold' : 'normal'); }
        doc.text(l, x + 2, y + 4 + j * lineH);
      });
      x += widths[i];
    });
    doc.setTextColor(20);
    y += h;
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(235, 225, 225); doc.line(M, y, W - M, y);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(120);
    doc.setDrawColor(...WINE); doc.setLineWidth(0.4); doc.line(M, H - 10, W - M, H - 10); doc.setLineWidth(0.2);
    doc.setTextColor(...WINE); doc.setFont('helvetica', 'bold');
    doc.text('SanarFlix Academy', M, H - 6);
    doc.setTextColor(120); doc.setFont('helvetica', 'normal');
    doc.text('Documento de uso interno', W / 2, H - 6, { align: 'center' });
    doc.text(`Página ${p} de ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const slug = simuladoNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`liberacoes-${slug || 'simulado'}-${date}.pdf`);
}
