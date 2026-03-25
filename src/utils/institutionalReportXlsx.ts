import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InstitutionalViewModel, DesempenhoV2Filters } from '@/types/desempenhoV2';
import { buildDecisionItems } from './institutionalReportPdf';

type ExportModule = 'visao-institucional' | 'diagnostico-curricular' | 'visao-alunos' | 'inteligencia-decisoria';
const PROFICIENCY_THRESHOLD = 60;

function freezeAndFilter(ws: XLSX.WorkSheet, lastCol: string, lastRow: number) {
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` };
}

function buildResumoSheet(data: InstitutionalViewModel, filters: DesempenhoV2Filters, simuladoNome?: string): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  rows.push(['Relatório de Desempenho Institucional']);
  rows.push(['Simulado', simuladoNome || '']);
  rows.push(['Data de geração', dateStr]);
  rows.push([]);

  // Filters
  rows.push(['Filtros aplicados']);
  if (filters.iesId) rows.push(['IES', filters.iesId]);
  if (filters.areas.length) rows.push(['Áreas', filters.areas.join(', ')]);
  if (filters.semestres.length) rows.push(['Semestres', filters.semestres.join(', ')]);
  if (filters.especialidades.length) rows.push(['Especialidades', filters.especialidades.join(', ')]);
  if (filters.temas.length) rows.push(['Temas', filters.temas.join(', ')]);
  rows.push([]);

  // KPIs
  rows.push(['Indicadores Principais']);
  data.kpis.forEach(kpi => {
    rows.push([kpi.label, typeof kpi.value === 'number' ? kpi.value : String(kpi.value), kpi.status]);
  });
  rows.push([]);

  // Faixas
  rows.push(['Distribuição por Faixa']);
  rows.push(['Faixa', 'Quantidade', '% do Total']);
  data.faixas.forEach(f => {
    rows.push([f.faixa, f.quantidade, f.percentual]);
  });
  rows.push([]);

  // Meta
  rows.push(['Meta Institucional']);
  rows.push(['Proficiência Atual (%)', data.meta.proficienciaAtual]);
  rows.push(['Meta (%)', data.meta.meta]);
  rows.push(['Gap (pts)', data.meta.gapProficiencia]);
  rows.push(['Conceito Atual', data.meta.notaAtual]);
  rows.push(['Status', data.meta.status]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }];
  return ws;
}

function buildDiagnosticoSheet(data: InstitutionalViewModel): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  rows.push(['Área', 'Especialidade', 'Tema', 'Total Questões', 'Acertos', '% Acerto']);

  data.curricular.areas.forEach(area => {
    area.specialties.forEach(sp => {
      sp.temas.forEach(tema => {
        rows.push([area.name, sp.name, tema.name, tema.total, tema.acertos, tema.percentual]);
      });
      // Subtotal specialty
      rows.push([area.name, sp.name, '(Subtotal)', sp.total, sp.acertos, sp.percentual]);
    });
    // Subtotal area
    rows.push([area.name, '(Total Área)', '', area.total, area.acertos, area.percentual]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
  freezeAndFilter(ws, 'F', rows.length);
  return ws;
}

function buildAlunosSheet(data: InstitutionalViewModel): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];
  rows.push(['Nome', 'Semestre', 'Acertos', 'Total', '% Acerto', 'Distância (pts)', 'Status']);

  const sorted = [...data.allStudents].sort((a, b) => a.percentual - b.percentual);
  sorted.forEach(s => {
    const dist = Math.max(0, PROFICIENCY_THRESHOLD - s.percentual);
    rows.push([
      s.nome,
      s.semestre,
      s.acertos,
      s.total,
      Math.round(s.percentual * 10) / 10,
      Math.round(dist * 10) / 10,
      s.percentual >= PROFICIENCY_THRESHOLD ? 'Proficiente' : 'Abaixo',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
  freezeAndFilter(ws, 'G', rows.length);
  return ws;
}

function buildTemasPrioritariosSheet(data: InstitutionalViewModel): XLSX.WorkSheet {
  const items = buildDecisionItems(data).slice(0, 30);
  const rows: (string | number)[][] = [];
  rows.push(['Prioridade', 'Tema', 'Área > Especialidade', '% Acerto', 'Gap (pts)', 'Prevalência (%)', 'Impacto Potencial', 'Score Composto']);

  items.forEach((item, i) => {
    rows.push([
      i + 1,
      item.title,
      item.subtitle,
      Math.round(item.percentual * 10) / 10,
      Math.round(item.gap * 10) / 10,
      Math.round(item.prevalencia * 10) / 10,
      item.impactoPotencial,
      item.compositeScore,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  freezeAndFilter(ws, 'H', rows.length);
  return ws;
}

export function generateInstitutionalXLSX(
  data: InstitutionalViewModel,
  filters: DesempenhoV2Filters,
  modules: ExportModule[],
  simuladoNome?: string,
): Blob {
  const wb = XLSX.utils.book_new();

  // Always include resumo
  XLSX.utils.book_append_sheet(wb, buildResumoSheet(data, filters, simuladoNome), 'Resumo Institucional');

  if (modules.includes('diagnostico-curricular')) {
    XLSX.utils.book_append_sheet(wb, buildDiagnosticoSheet(data), 'Diagnóstico por Área');
  }
  if (modules.includes('visao-alunos')) {
    XLSX.utils.book_append_sheet(wb, buildAlunosSheet(data), 'Lista de Alunos');
  }
  if (modules.includes('inteligencia-decisoria')) {
    XLSX.utils.book_append_sheet(wb, buildTemasPrioritariosSheet(data), 'Temas Prioritários');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
