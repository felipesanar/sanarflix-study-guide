/**
 * Export do Caderno de Erros em PDF (SanarFlix Academy).
 * Usa jsPDF (já presente no projeto). A lógica de agrupamento é pura/testável;
 * a renderização do PDF é glue sobre o jsPDF.
 */
import jsPDF from 'jspdf';

export interface CadernoExportEntry {
  grandeArea: string | null;
  tema: string | null;
  reasonLabel: string;
  learningText: string | null;
  enunciado?: string | null;
  correta?: string | null;
  comentario?: string | null;
}

export interface CadernoAreaGroup {
  area: string;
  items: CadernoExportEntry[];
}

const SEM_AREA = 'Sem área';

/** Agrupa as entradas por área (ordenadas), preservando a ordem dentro de cada grupo. */
export function groupCadernoByArea(entries: CadernoExportEntry[]): CadernoAreaGroup[] {
  const map = new Map<string, CadernoExportEntry[]>();
  for (const e of entries) {
    const key = e.grandeArea?.trim() || SEM_AREA;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([area, items]) => ({ area, items }));
}

/** Gera e dispara o download de um PDF do caderno, agrupado por área. */
export function generateCadernoPDF(entries: CadernoExportEntry[], filename = 'caderno-de-erros.pdf'): void {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const writeWrapped = (text: string, size: number, style: 'normal' | 'bold' = 'normal', gap = 4) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines) {
      ensureSpace(size * 0.5);
      doc.text(line, margin, y);
      y += size * 0.5;
    }
    y += gap;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Caderno de Erros', margin, y); y += 10;

  const groups = groupCadernoByArea(entries);
  if (groups.length === 0) {
    writeWrapped('Nenhum registro no caderno.', 12);
  }

  for (const group of groups) {
    ensureSpace(14);
    doc.setFillColor(245, 240, 242);
    doc.rect(margin - 2, y - 5, maxW + 4, 9, 'F');
    writeWrapped(group.area, 13, 'bold', 5);

    group.items.forEach((it, idx) => {
      ensureSpace(20);
      const header = `${idx + 1}. ${it.tema || 'Sem tema'}  ·  ${it.reasonLabel}`;
      writeWrapped(header, 11, 'bold', 2);
      if (it.enunciado) writeWrapped(it.enunciado, 10, 'normal', 2);
      if (it.correta) writeWrapped(`Gabarito: ${it.correta}`, 10, 'bold', 2);
      if (it.comentario) writeWrapped(`Comentário: ${it.comentario}`, 9, 'normal', 2);
      if (it.learningText) writeWrapped(`Meu aprendizado: ${it.learningText}`, 9, 'normal', 4);
    });
  }

  doc.save(filename);
}
