import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InstitutionalViewModel, DesempenhoV2Filters } from '@/types/desempenhoV2';

type RGB = [number, number, number];
type ExportModule = 'visao-institucional' | 'diagnostico-curricular' | 'visao-alunos' | 'inteligencia-decisoria';

const COLORS = {
  wine: [139, 21, 56] as RGB,
  wineDark: [107, 16, 40] as RGB,
  wineLight: [169, 29, 70] as RGB,
  white: [255, 255, 255] as RGB,
  bgLight: [249, 250, 251] as RGB,
  border: [229, 231, 235] as RGB,
  textDark: [31, 41, 55] as RGB,
  textMuted: [107, 114, 128] as RGB,
  success: [5, 150, 105] as RGB,
  error: [220, 38, 38] as RGB,
  warning: [234, 179, 8] as RGB,
};

const PROFICIENCY_THRESHOLD = 60;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function sanitize(text: string): string {
  return text.replace(/[\u0000-\u001F]/g, '').trim();
}

function drawGradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, from: RGB, to: RGB, steps = 30) {
  const stepH = h / steps;
  for (let i = 0; i < steps; i++) {
    const r = from[0] + ((to[0] - from[0]) * i) / steps;
    const g = from[1] + ((to[1] - from[1]) * i) / steps;
    const b = from[2] + ((to[2] - from[2]) * i) / steps;
    doc.setFillColor(r, g, b);
    doc.rect(x, y + i * stepH, w, stepH + 0.5, 'F');
  }
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const dateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Gerado em ${dateStr}`, MARGIN, PAGE_H - 8);
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    doc.setDrawColor(...COLORS.border);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
  }
}

function checkPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 20) {
    doc.addPage();
    return 22;
  }
  return y;
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  y = checkPage(doc, y, 14);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.wine);
  doc.text(sanitize(title), MARGIN, y);
  y += 2;
  doc.setDrawColor(...COLORS.wine);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  return y + 6;
}

function tableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; w: number; align?: string }[]): number {
  y = checkPage(doc, y, 10);
  doc.setFillColor(...COLORS.bgLight);
  doc.rect(MARGIN, y - 4, CONTENT_W, 7, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  cols.forEach(c => {
    const align = (c.align as any) || 'left';
    doc.text(sanitize(c.label), c.x, y, { align });
  });
  return y + 6;
}

// ── Cover page ──

function drawCover(doc: jsPDF, simuladoNome: string, filters: DesempenhoV2Filters) {
  drawGradientRect(doc, 0, 0, PAGE_W, PAGE_H, COLORS.wine, COLORS.wineDark);

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de', PAGE_W / 2, 90, { align: 'center' });
  doc.text('Desempenho Institucional', PAGE_W / 2, 105, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(sanitize(simuladoNome || 'Simulado'), PAGE_W / 2, 125, { align: 'center' });

  const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.setFontSize(10);
  doc.text(dateStr, PAGE_W / 2, 140, { align: 'center' });

  // Filters summary
  const filterLines: string[] = [];
  if (filters.iesId) filterLines.push(`IES: ${filters.iesId}`);
  if (filters.areas.length) filterLines.push(`Áreas: ${filters.areas.join(', ')}`);
  if (filters.semestres.length) filterLines.push(`Semestres: ${filters.semestres.join(', ')}`);
  if (filters.especialidades.length) filterLines.push(`Especialidades: ${filters.especialidades.join(', ')}`);
  if (filters.temas.length) filterLines.push(`Temas: ${filters.temas.join(', ')}`);

  if (filterLines.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let fy = 160;
    doc.text('Filtros aplicados:', PAGE_W / 2, fy, { align: 'center' });
    fy += 6;
    filterLines.forEach(line => {
      doc.text(sanitize(line), PAGE_W / 2, fy, { align: 'center' });
      fy += 5;
    });
  }
}

// ── Visão Institucional ──

function drawVisaoInstitucional(doc: jsPDF, data: InstitutionalViewModel): void {
  doc.addPage();
  let y = sectionTitle(doc, 22, 'Visão Institucional');

  // KPIs
  const kpiW = CONTENT_W / 2 - 2;
  data.kpis.forEach((kpi, i) => {
    y = checkPage(doc, y, 18);
    const col = i % 2;
    const kx = MARGIN + col * (kpiW + 4);
    if (col === 0 && i > 0) y += 0; // same row for col 1

    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(kx, y - 4, kpiW, 15, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textDark);
    doc.text(sanitize(String(kpi.value)), kx + 4, y + 2);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textMuted);
    doc.text(sanitize(kpi.label), kx + 4, y + 7);

    if (col === 1) y += 18;
  });
  if (data.kpis.length % 2 !== 0) y += 18;

  // Faixas table
  y = checkPage(doc, y, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textDark);
  doc.text('Distribuição por Faixa', MARGIN, y);
  y += 6;

  const fCols = [
    { label: 'Faixa', x: MARGIN + 2, w: 50 },
    { label: 'Qtd', x: MARGIN + 80, w: 30, align: 'center' },
    { label: '%', x: MARGIN + 130, w: 30, align: 'center' },
  ];
  y = tableHeader(doc, y, fCols);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  data.faixas.forEach(f => {
    y = checkPage(doc, y, 7);
    doc.setTextColor(...COLORS.textDark);
    doc.text(sanitize(f.faixa), fCols[0].x, y);
    doc.text(String(f.quantidade), fCols[1].x, y, { align: 'center' });
    doc.text(`${f.percentual.toFixed(1)}%`, fCols[2].x, y, { align: 'center' });
    y += 6;
  });

  // Meta
  y += 4;
  y = checkPage(doc, y, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Meta Institucional', MARGIN, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`Proficiência atual: ${data.meta.proficienciaAtual.toFixed(1)}%`, MARGIN + 2, y);
  y += 5;
  doc.text(`Meta: ${data.meta.meta}%  |  Gap: ${data.meta.gapProficiencia.toFixed(1)}pts`, MARGIN + 2, y);
  y += 5;
  doc.text(`Conceito atual: ${data.meta.notaAtual}  |  Status: ${data.meta.status}`, MARGIN + 2, y);
}

// ── Diagnóstico Curricular ──

function drawDiagnosticoCurricular(doc: jsPDF, data: InstitutionalViewModel): void {
  doc.addPage();
  let y = sectionTitle(doc, 22, 'Diagnóstico Curricular');

  const cols = [
    { label: 'Área / Especialidade / Tema', x: MARGIN + 2, w: 90 },
    { label: 'Total', x: MARGIN + 100, w: 20, align: 'center' },
    { label: 'Acertos', x: MARGIN + 122, w: 20, align: 'center' },
    { label: '% Acerto', x: MARGIN + 150, w: 24, align: 'center' },
  ];
  y = tableHeader(doc, y, cols);

  data.curricular.areas.forEach(area => {
    y = checkPage(doc, y, 8);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.wine);
    doc.text(sanitize(area.name), cols[0].x, y);
    doc.setTextColor(...COLORS.textDark);
    doc.text(String(area.total), cols[1].x, y, { align: 'center' });
    doc.text(String(area.acertos), cols[2].x, y, { align: 'center' });
    doc.text(`${area.percentual.toFixed(1)}%`, cols[3].x, y, { align: 'center' });
    y += 6;

    area.specialties.forEach(sp => {
      y = checkPage(doc, y, 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textDark);
      doc.text(`  ${sanitize(sp.name)}`, cols[0].x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(sp.total), cols[1].x, y, { align: 'center' });
      doc.text(String(sp.acertos), cols[2].x, y, { align: 'center' });
      doc.text(`${sp.percentual.toFixed(1)}%`, cols[3].x, y, { align: 'center' });
      y += 5;

      sp.temas.forEach(tema => {
        y = checkPage(doc, y, 6);
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.textMuted);
        const temaLabel = sanitize(tema.name);
        const truncated = temaLabel.length > 55 ? temaLabel.substring(0, 52) + '...' : temaLabel;
        doc.text(`    ${truncated}`, cols[0].x, y);
        doc.text(String(tema.total), cols[1].x, y, { align: 'center' });
        doc.text(String(tema.acertos), cols[2].x, y, { align: 'center' });
        const pctColor: RGB = tema.percentual < PROFICIENCY_THRESHOLD ? COLORS.error : COLORS.success;
        doc.setTextColor(...pctColor);
        doc.text(`${tema.percentual.toFixed(1)}%`, cols[3].x, y, { align: 'center' });
        y += 5;
      });
    });
    y += 2;
  });
}

// ── Visão de Alunos ──

function drawVisaoAlunos(doc: jsPDF, data: InstitutionalViewModel): void {
  doc.addPage();
  let y = sectionTitle(doc, 22, 'Visão de Alunos');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);
  doc.text(`Total de alunos: ${data.allStudents.length}  |  Abaixo do esperado: ${data.alunosAbaixo.length}`, MARGIN + 2, y);
  y += 8;

  const cols = [
    { label: 'Nome', x: MARGIN + 2, w: 70 },
    { label: 'Sem.', x: MARGIN + 76, w: 14, align: 'center' },
    { label: 'Acertos', x: MARGIN + 94, w: 18, align: 'center' },
    { label: 'Total', x: MARGIN + 114, w: 16, align: 'center' },
    { label: '% Acerto', x: MARGIN + 138, w: 20, align: 'center' },
    { label: 'Distância', x: MARGIN + 162, w: 20, align: 'center' },
  ];
  y = tableHeader(doc, y, cols);

  const sortedStudents = [...data.allStudents].sort((a, b) => a.percentual - b.percentual);
  const studentsToShow = sortedStudents.slice(0, 100);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  let even = false;

  studentsToShow.forEach(s => {
    y = checkPage(doc, y, 6);
    if (even) {
      doc.setFillColor(...COLORS.bgLight);
      doc.rect(MARGIN, y - 3.5, CONTENT_W, 5.5, 'F');
    }
    even = !even;

    doc.setTextColor(...COLORS.textDark);
    const nome = sanitize(s.nome);
    doc.text(nome.length > 38 ? nome.substring(0, 35) + '...' : nome, cols[0].x, y);
    doc.text(String(s.semestre), cols[1].x, y, { align: 'center' });
    doc.text(String(s.acertos), cols[2].x, y, { align: 'center' });
    doc.text(String(s.total), cols[3].x, y, { align: 'center' });

    const pctColor: RGB = s.percentual < PROFICIENCY_THRESHOLD ? COLORS.error : COLORS.success;
    doc.setTextColor(...pctColor);
    doc.text(`${s.percentual.toFixed(1)}%`, cols[4].x, y, { align: 'center' });

    const dist = Math.max(0, PROFICIENCY_THRESHOLD - s.percentual);
    doc.setTextColor(...(dist > 0 ? COLORS.error : COLORS.success));
    doc.text(dist > 0 ? `${dist.toFixed(0)}pts` : 'OK', cols[5].x, y, { align: 'center' });

    y += 5.5;
  });

  if (data.allStudents.length > 100) {
    y += 4;
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Exibindo 100 de ${data.allStudents.length} alunos (ordenados por % acerto).`, MARGIN + 2, y);
  }
}

// ── Inteligência Decisória ──

interface DecisionItem {
  title: string;
  subtitle: string;
  percentual: number;
  gap: number;
  prevalencia: number;
  impactoPotencial: number;
  compositeScore: number;
}

export function buildDecisionItems(data: InstitutionalViewModel): DecisionItem[] {
  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0) || 1;
  const totalStudents = data.allStudents.length || 1;
  const items: DecisionItem[] = [];

  for (const area of data.curricular.areas) {
    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        if (tema.percentual >= PROFICIENCY_THRESHOLD) continue;
        const gap = PROFICIENCY_THRESHOLD - tema.percentual;
        const prevalencia = (tema.total / totalQuestions) * 100;
        const alunosAfetados = Math.ceil(totalStudents * Math.min(gap / 40, 1) * 0.7);
        const impactoPotencial = Math.round(prevalencia * (gap / 100) * 0.5 * 10) / 10;
        const compositeScore = Math.min(100, Math.round(
          gap * 1.0 + prevalencia * 1.5 + alunosAfetados * 0.8 + impactoPotencial * 3
        ));

        items.push({
          title: tema.name,
          subtitle: `${area.name} > ${sp.name}`,
          percentual: tema.percentual,
          gap,
          prevalencia,
          impactoPotencial,
          compositeScore,
        });
      }
    }
  }
  return items.sort((a, b) => b.compositeScore - a.compositeScore);
}

function drawInteligenciaDecisoria(doc: jsPDF, data: InstitutionalViewModel): void {
  doc.addPage();
  let y = sectionTitle(doc, 22, 'Inteligência Decisória – Temas Prioritários');

  const items = buildDecisionItems(data).slice(0, 15);

  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('Todos os temas estão acima do limiar de proficiência.', MARGIN + 2, y);
    return;
  }

  const cols = [
    { label: '#', x: MARGIN + 2, w: 8, align: 'center' },
    { label: 'Tema', x: MARGIN + 12, w: 60 },
    { label: 'Área > Espec.', x: MARGIN + 74, w: 50 },
    { label: '% Acerto', x: MARGIN + 126, w: 20, align: 'center' },
    { label: 'Gap', x: MARGIN + 148, w: 16, align: 'center' },
    { label: 'Score', x: MARGIN + 166, w: 16, align: 'center' },
  ];
  y = tableHeader(doc, y, cols);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');

  items.forEach((item, i) => {
    y = checkPage(doc, y, 6);
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.bgLight);
      doc.rect(MARGIN, y - 3.5, CONTENT_W, 5.5, 'F');
    }
    doc.setTextColor(...COLORS.textDark);
    doc.text(String(i + 1), cols[0].x, y, { align: 'center' });

    const tName = sanitize(item.title);
    doc.text(tName.length > 35 ? tName.substring(0, 32) + '...' : tName, cols[1].x, y);

    const sub = sanitize(item.subtitle);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(sub.length > 28 ? sub.substring(0, 25) + '...' : sub, cols[2].x, y);

    doc.setTextColor(...COLORS.error);
    doc.text(`${item.percentual.toFixed(1)}%`, cols[3].x, y, { align: 'center' });

    doc.setTextColor(...COLORS.textDark);
    doc.text(`${item.gap.toFixed(0)}pts`, cols[4].x, y, { align: 'center' });
    doc.text(String(item.compositeScore), cols[5].x, y, { align: 'center' });

    y += 5.5;
  });
}

// ── Main export ──

export async function generateInstitutionalPDF(
  data: InstitutionalViewModel,
  filters: DesempenhoV2Filters,
  modules: ExportModule[],
  simuladoNome?: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCover(doc, simuladoNome || 'Simulado', filters);

  if (modules.includes('visao-institucional')) drawVisaoInstitucional(doc, data);
  if (modules.includes('diagnostico-curricular')) drawDiagnosticoCurricular(doc, data);
  if (modules.includes('visao-alunos')) drawVisaoAlunos(doc, data);
  if (modules.includes('inteligencia-decisoria')) drawInteligenciaDecisoria(doc, data);

  addFooter(doc);

  return doc.output('blob');
}
