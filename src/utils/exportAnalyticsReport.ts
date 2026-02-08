import * as XLSX from 'xlsx';
import type { 
  OverviewMetrics, 
  EngagementMetrics, 
  ProgressMetrics, 
  DemographicsMetrics, 
  SimuladoMetrics 
} from '@/hooks/useAnalyticsData';

// ============== TYPES ==============
export interface AnalyticsExportFilters {
  dateRange: { start: Date; end: Date };
  university: string | null;
  universityName?: string;
  excludedIES: string[];
  exportedBy?: string;
}

export interface AnalyticsExportData {
  overview: OverviewMetrics;
  engagement: EngagementMetrics;
  progress: ProgressMetrics;
  demographics: DemographicsMetrics;
  simulados: SimuladoMetrics;
}

export interface ExportPreviewStats {
  totalUsuarios: number;
  sessoesNoPeriodo: number;
  simuladosAnalisados: number;
  questoesMapeadas: number;
  questoesProblematicas: number; // Questões com taxa de erro >= 50%
  registrosTotais: number;
}

// ============== HELPERS ==============
const formatBR = (n: number): string => n.toLocaleString('pt-BR');
const formatPercent = (n: number): string => `${n.toFixed(1)}%`;
const formatDate = (d: Date): string => d.toLocaleDateString('pt-BR');
const formatDateTime = (d: Date): string => d.toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

const getAppVersion = (): string => {
  // Versão do sistema - pode ser configurada em outro lugar
  return '2.0.0';
};

// ============== PREVIEW STATS ==============
export function calculatePreviewStats(data: AnalyticsExportData): ExportPreviewStats {
  const totalUsuarios = data.overview.totalUsuarios;
  
  // Usar contagem real de sessões (totalSessoesPeriodo) do hook
  const sessoesNoPeriodo = data.engagement.totalSessoesPeriodo 
    || data.engagement.sessoesPorDia.reduce((acc, d) => acc + d.sessoes, 0);
  
  const simuladosAnalisados = data.simulados.simuladosDisponiveis.length;
  
  // Total de questões de TODOS os simulados
  const questoesMapeadas = data.simulados.simuladosDisponiveis.reduce(
    (acc, s) => acc + (s.total_questoes || 0), 
    0
  );
  
  // Questões problemáticas (taxa de erro >= 50%)
  const questoesProblematicas = data.simulados.questoesProblematicas.length;
  
  // Estimativa de registros totais
  const registrosTotais = 
    totalUsuarios + 
    sessoesNoPeriodo + 
    data.engagement.pageViewsPorPagina.reduce((acc, p) => acc + p.views, 0) +
    data.simulados.simuladosDisponiveis.reduce((acc, s) => acc + s.iniciados + s.finalizados, 0);

  return {
    totalUsuarios,
    sessoesNoPeriodo,
    simuladosAnalisados,
    questoesMapeadas,
    questoesProblematicas,
    registrosTotais,
  };
}

// ============== CSV EXPORT (Simplified) ==============
export function exportAnalyticsCSV(data: AnalyticsExportData, filters: AnalyticsExportFilters): void {
  const timestamp = formatDateTime(new Date());
  
  const lines: string[] = [
    '# ═══════════════════════════════════════════════════════════════════',
    '# RELATÓRIO ANALÍTICO COMPLETO',
    '# SanarFlix Academy',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    '# METADADOS',
    `Exportado em:,${timestamp}`,
    `Período:,${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`,
    `IES Filtrada:,${filters.universityName || filters.university || 'Todas'}`,
    `IES Excluídas:,${filters.excludedIES.length > 0 ? filters.excludedIES.join('; ') : 'Nenhuma'}`,
    `Exportado por:,${filters.exportedBy || 'Sistema'}`,
    `Versão:,${getAppVersion()}`,
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# VISÃO GERAL',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Métrica,Valor',
    `Total de Usuários,${formatBR(data.overview.totalUsuarios)}`,
    `Usuários Ativos Hoje,${formatBR(data.overview.usuariosAtivosHoje)}`,
    `Usuários Ativos (7 dias),${formatBR(data.overview.usuariosAtivos7Dias)}`,
    `Sessões Hoje,${formatBR(data.overview.sessoesHoje)}`,
    `Tempo Médio de Sessão,${data.overview.mediaTempoSessao} min`,
    `Page Views Hoje,${formatBR(data.overview.pageViewsHoje)}`,
    `Simulados Iniciados Hoje,${formatBR(data.overview.simuladosIniciadosHoje)}`,
    `Simulados Finalizados Hoje,${formatBR(data.overview.simuladosFinalizadosHoje)}`,
    `SanarClass Views Hoje,${formatBR(data.overview.sanarclassViewsHoje)}`,
    `Taxa de Abandono,${formatPercent(data.overview.taxaAbandonoSimulados)}`,
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# ENGAJAMENTO - SESSÕES POR DIA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Data,Sessões,Duração Média (min)',
    ...data.engagement.sessoesPorDia.map(d => `${d.data},${d.sessoes},${d.duracao_media}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# ENGAJAMENTO - PÁGINAS MAIS ACESSADAS',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Página,Views',
    ...data.engagement.pageViewsPorPagina.map(p => `"${p.pagina}",${p.views}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# ENGAJAMENTO - HORÁRIOS DE PICO',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Hora,Acessos',
    ...data.engagement.horariosPico.map(h => `${h.hora}h,${h.acessos}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# PROGRESSO - POR MATÉRIA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Matéria,Progresso (%),Total Itens',
    ...data.progress.progressoMedioPorMateria.map(m => `"${m.materia}",${m.progresso},${m.total_itens}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# PROGRESSO - POR FAIXA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Faixa de Progresso,Quantidade de Usuários',
    ...data.progress.usuariosPorFaixaProgresso.map(f => `"${f.faixa}",${f.quantidade}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# DEMOGRAFIA - POR IES',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'IES,Quantidade de Usuários',
    ...data.demographics.usuariosPorIES.map(i => `"${i.ies_nome}",${i.quantidade}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# DEMOGRAFIA - POR SEMESTRE',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Semestre,Quantidade de Usuários',
    ...data.demographics.usuariosPorSemestre.map(s => `"${s.semestre}",${s.quantidade}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SIMULADOS - LISTA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Nome,Questões,Iniciados,Finalizados,Taxa Conclusão (%)',
    ...data.simulados.simuladosDisponiveis.map(s => 
      `"${s.nome}",${s.total_questoes},${s.iniciados},${s.finalizados},${s.taxa_conclusao}`
    ),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# QUESTÕES PROBLEMÁTICAS (TOP 20)',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Enunciado (truncado),Taxa de Erro (%)',
    ...data.simulados.questoesProblematicas.slice(0, 20).map(q => 
      `"${q.enunciado.substring(0, 100).replace(/"/g, '""').replace(/\n/g, ' ')}...",${q.taxa_erro}`
    ),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# FIM DO RELATÓRIO',
    '# ═══════════════════════════════════════════════════════════════════',
  ];

  const csvContent = lines.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `analytics_completo_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============== XLSX EXPORT (Premium Multi-Sheet) ==============
export function exportAnalyticsXLSX(data: AnalyticsExportData, filters: AnalyticsExportFilters): void {
  const wb = XLSX.utils.book_new();
  const timestamp = formatDateTime(new Date());

  // ============== ABA 1: CAPA E SUMÁRIO ==============
  const capaData = [
    [''],
    ['RELATÓRIO ANALÍTICO COMPLETO'],
    ['SanarFlix Academy'],
    [''],
    [''],
    ['METADADOS DO RELATÓRIO'],
    [''],
    ['Campo', 'Valor'],
    ['Exportado em', timestamp],
    ['Período analisado', `${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`],
    ['IES', filters.universityName || filters.university || 'Todas'],
    ['IES Excluídas', filters.excludedIES.length > 0 ? filters.excludedIES.join(', ') : 'Nenhuma'],
    ['Exportado por', filters.exportedBy || 'Sistema'],
    ['Versão do Sistema', getAppVersion()],
    [''],
    [''],
    ['SUMÁRIO DE ABAS'],
    [''],
    ['Nº', 'Aba', 'Descrição'],
    ['1', 'Capa e Sumário', 'Metadados e índice do relatório'],
    ['2', 'Visão Executiva', 'KPIs principais consolidados'],
    ['3', 'Engajamento', 'Sessões, page views e horários de pico'],
    ['4', 'Progresso', 'Progresso acadêmico por matéria e faixa'],
    ['5', 'Demografia', 'Distribuição por IES e semestre'],
    ['6', 'Simulados', 'Lista de simulados com métricas'],
    ['7', 'Questões Problemáticas', 'Top questões com maior taxa de erro'],
    ['8', 'Metadados Técnicos', 'Informações de integridade'],
  ];
  const wsCapa = XLSX.utils.aoa_to_sheet(capaData);
  wsCapa['!cols'] = [{ wch: 25 }, { wch: 50 }];
  wsCapa['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsCapa, 'Capa e Sumário');

  // ============== ABA 2: VISÃO EXECUTIVA ==============
  const visaoData = [
    ['VISÃO EXECUTIVA - KPIs'],
    [''],
    ['MÉTRICAS DE USUÁRIOS'],
    ['Métrica', 'Valor', 'Contexto'],
    ['Total de Usuários', data.overview.totalUsuarios, 'base total'],
    ['Usuários Ativos Hoje', data.overview.usuariosAtivosHoje, 'acessaram hoje'],
    ['Usuários Ativos (7 dias)', data.overview.usuariosAtivos7Dias, 'acessaram nos últimos 7 dias'],
    [''],
    ['MÉTRICAS DE SESSÃO'],
    ['Métrica', 'Valor', 'Contexto'],
    ['Sessões Hoje', data.overview.sessoesHoje, 'total de sessões'],
    ['Tempo Médio de Sessão', `${data.overview.mediaTempoSessao} min`, 'duração média'],
    ['Page Views Hoje', data.overview.pageViewsHoje, 'visualizações de página'],
    ['Dispositivos Mobile', `${formatPercent((data.engagement.dispositivosMobile / (data.engagement.dispositivosMobile + data.engagement.dispositivosDesktop || 1)) * 100)}`, 'do total de sessões'],
    [''],
    ['MÉTRICAS DE SIMULADOS'],
    ['Métrica', 'Valor', 'Contexto'],
    ['Simulados Iniciados Hoje', data.overview.simuladosIniciadosHoje, 'novas tentativas'],
    ['Simulados Finalizados Hoje', data.overview.simuladosFinalizadosHoje, 'provas concluídas'],
    ['Taxa de Abandono', `${data.overview.taxaAbandonoSimulados}%`, 'iniciados - finalizados'],
    [''],
    ['MÉTRICAS DE CONTEÚDO'],
    ['Métrica', 'Valor', 'Contexto'],
    ['SanarClass Views Hoje', data.overview.sanarclassViewsHoje, 'aulas acessadas'],
    ['Taxa de Conclusão de Conteúdo', `${data.progress.taxaConclusaoConteudo}%`, 'média geral'],
  ];
  const wsVisao = XLSX.utils.aoa_to_sheet(visaoData);
  wsVisao['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsVisao, 'Visão Executiva');

  // ============== ABA 3: ENGAJAMENTO ==============
  const engajamentoData = [
    ['ENGAJAMENTO'],
    [''],
    ['SESSÕES POR DIA'],
    ['Data', 'Sessões', 'Duração Média (min)'],
    ...data.engagement.sessoesPorDia.map(d => [d.data, d.sessoes, d.duracao_media]),
    [''],
    [''],
    ['PÁGINAS MAIS ACESSADAS (Top 20)'],
    ['Página', 'Views'],
    ...data.engagement.pageViewsPorPagina.slice(0, 20).map(p => [p.pagina, p.views]),
    [''],
    [''],
    ['HORÁRIOS DE PICO'],
    ['Hora', 'Acessos'],
    ...data.engagement.horariosPico.map(h => [`${h.hora}:00`, h.acessos]),
    [''],
    [''],
    ['DISPOSITIVOS'],
    ['Tipo', 'Quantidade', 'Percentual'],
    ['Mobile', data.engagement.dispositivosMobile, data.engagement.dispositivosMobile / (data.engagement.dispositivosMobile + data.engagement.dispositivosDesktop || 1)],
    ['Desktop', data.engagement.dispositivosDesktop, data.engagement.dispositivosDesktop / (data.engagement.dispositivosMobile + data.engagement.dispositivosDesktop || 1)],
  ];
  const wsEngaj = XLSX.utils.aoa_to_sheet(engajamentoData);
  wsEngaj['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 20 }];
  // Format percentage cells for devices
  const deviceStartRow = engajamentoData.findIndex(row => row[0] === 'Tipo') + 2;
  for (let r = deviceStartRow; r < deviceStartRow + 2; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 2 });
    if (wsEngaj[cell]) wsEngaj[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsEngaj, 'Engajamento');

  // ============== ABA 4: PROGRESSO ==============
  const progressoData = [
    ['PROGRESSO ACADÊMICO'],
    [''],
    ['PROGRESSO POR MATÉRIA'],
    ['Matéria', 'Progresso (%)', 'Total de Itens'],
    ...data.progress.progressoMedioPorMateria.map(m => [m.materia, m.progresso / 100, m.total_itens]),
    [''],
    [''],
    ['USUÁRIOS POR FAIXA DE PROGRESSO'],
    ['Faixa', 'Quantidade de Usuários'],
    ...data.progress.usuariosPorFaixaProgresso.map(f => [f.faixa, f.quantidade]),
    [''],
    ['TAXA GERAL DE CONCLUSÃO'],
    ['', data.progress.taxaConclusaoConteudo / 100],
  ];
  const wsProgresso = XLSX.utils.aoa_to_sheet(progressoData);
  wsProgresso['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }];
  // Format percentages
  const materiaStartRow = 4;
  for (let r = materiaStartRow; r < materiaStartRow + data.progress.progressoMedioPorMateria.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsProgresso[cell]) wsProgresso[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsProgresso, 'Progresso');

  // ============== ABA 5: DEMOGRAFIA ==============
  const demografiaData = [
    ['DEMOGRAFIA'],
    [''],
    ['USUÁRIOS POR IES'],
    ['IES', 'Quantidade'],
    ...data.demographics.usuariosPorIES.map(i => [i.ies_nome, i.quantidade]),
    [''],
    [''],
    ['USUÁRIOS POR SEMESTRE'],
    ['Semestre', 'Quantidade'],
    ...data.demographics.usuariosPorSemestre.map(s => [s.semestre, s.quantidade]),
  ];
  const wsDemog = XLSX.utils.aoa_to_sheet(demografiaData);
  wsDemog['!cols'] = [{ wch: 40 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsDemog, 'Demografia');

  // ============== ABA 6: SIMULADOS ==============
  const simuladosHeader = ['Nome', 'Questões', 'Iniciados', 'Finalizados', 'Taxa de Conclusão'];
  const simuladosRows = data.simulados.simuladosDisponiveis.map(s => [
    s.nome,
    s.total_questoes,
    s.iniciados,
    s.finalizados,
    s.taxa_conclusao / 100,
  ]);
  const wsSimulados = XLSX.utils.aoa_to_sheet([
    ['SIMULADOS'],
    [''],
    simuladosHeader,
    ...simuladosRows,
    [''],
    ['DESEMPENHO GERAL'],
    ['Métrica', 'Valor'],
    ['Média de Acertos', `${data.simulados.desempenhoGeral.media_acertos}%`],
    ['Total de Respostas', formatBR(data.simulados.desempenhoGeral.total_respostas)],
  ]);
  wsSimulados['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  // Format percentages
  for (let r = 3; r < 3 + simuladosRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 4 });
    if (wsSimulados[cell]) wsSimulados[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsSimulados, 'Simulados');

  // ============== ABA 7: QUESTÕES PROBLEMÁTICAS ==============
  const questoesHeader = ['#', 'Enunciado (truncado)', 'Taxa de Erro'];
  const questoesRows = data.simulados.questoesProblematicas.slice(0, 50).map((q, idx) => [
    idx + 1,
    q.enunciado.substring(0, 150).replace(/\n/g, ' '),
    q.taxa_erro / 100,
  ]);
  const wsQuestoes = XLSX.utils.aoa_to_sheet([
    ['QUESTÕES PROBLEMÁTICAS - TOP 50'],
    [''],
    questoesHeader,
    ...questoesRows,
  ]);
  wsQuestoes['!cols'] = [{ wch: 5 }, { wch: 80 }, { wch: 15 }];
  for (let r = 3; r < 3 + questoesRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 2 });
    if (wsQuestoes[cell]) wsQuestoes[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsQuestoes, 'Questões Problemáticas');

  // ============== ABA 8: METADADOS TÉCNICOS ==============
  const stats = calculatePreviewStats(data);
  const metadadosData = [
    ['METADADOS TÉCNICOS'],
    [''],
    ['INFORMAÇÕES DE GERAÇÃO'],
    ['Campo', 'Valor'],
    ['Data/Hora de Exportação', timestamp],
    ['Versão do Sistema', getAppVersion()],
    ['Formato', 'XLSX (Excel)'],
    [''],
    ['CONTAGEM DE REGISTROS'],
    ['Tabela', 'Quantidade'],
    ['Usuários', stats.totalUsuarios],
    ['Sessões no Período', stats.sessoesNoPeriodo],
    ['Simulados Analisados', stats.simuladosAnalisados],
    ['Questões Mapeadas', stats.questoesMapeadas],
    ['Registros Totais (estimado)', stats.registrosTotais],
    [''],
    ['FILTROS APLICADOS'],
    ['Filtro', 'Valor'],
    ['Período', `${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`],
    ['IES', filters.universityName || filters.university || 'Todas'],
    ['IES Excluídas', filters.excludedIES.length > 0 ? filters.excludedIES.join(', ') : 'Nenhuma'],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metadadosData);
  wsMeta['!cols'] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados Técnicos');

  // Download
  const filename = `analytics_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ============== ESTIMATE FILE SIZE ==============
export function estimateFileSizeKB(data: AnalyticsExportData, format: 'xlsx' | 'csv'): number {
  const stats = calculatePreviewStats(data);
  
  // Rough estimation based on data volume
  const baseSize = format === 'xlsx' ? 50 : 20; // Base overhead in KB
  const perRecordSize = format === 'xlsx' ? 0.05 : 0.02; // KB per record
  
  return Math.round(baseSize + (stats.registrosTotais * perRecordSize));
}

// ============== SIMULADOS-ONLY XLSX EXPORT ==============
export function exportSimuladosFromAnalyticsData(data: AnalyticsExportData, filters: AnalyticsExportFilters): void {
  const wb = XLSX.utils.book_new();
  const timestamp = formatDateTime(new Date());

  // ABA 1: RESUMO
  const resumoData = [
    ['RELATÓRIO DE SIMULADOS'],
    ['SanarFlix Academy'],
    [''],
    ['Exportado em', timestamp],
    ['Período', `${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`],
    ['IES', filters.universityName || filters.university || 'Todas'],
    [''],
    ['MÉTRICAS GERAIS'],
    ['Métrica', 'Valor'],
    ['Total de Simulados', data.simulados.simuladosDisponiveis.length],
    ['Média de Acertos', `${data.simulados.desempenhoGeral.media_acertos}%`],
    ['Total de Respostas', formatBR(data.simulados.desempenhoGeral.total_respostas)],
    ['Questões Problemáticas', data.simulados.questoesProblematicas.length],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // ABA 2: LISTA DE SIMULADOS
  const simuladosHeader = ['Nome', 'Total Questões', 'Iniciados', 'Finalizados', 'Taxa de Conclusão'];
  const simuladosRows = data.simulados.simuladosDisponiveis.map(s => [
    s.nome,
    s.total_questoes,
    s.iniciados,
    s.finalizados,
    `${s.taxa_conclusao}%`,
  ]);
  const wsSimulados = XLSX.utils.aoa_to_sheet([
    ['LISTA DE SIMULADOS'],
    [''],
    simuladosHeader,
    ...simuladosRows,
  ]);
  wsSimulados['!cols'] = [{ wch: 45 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSimulados, 'Simulados');

  // ABA 3: QUESTÕES PROBLEMÁTICAS
  const questoesHeader = ['#', 'Enunciado', 'Taxa de Erro (%)'];
  const questoesRows = data.simulados.questoesProblematicas.map((q, idx) => [
    idx + 1,
    q.enunciado.substring(0, 200).replace(/\n/g, ' '),
    `${q.taxa_erro}%`,
  ]);
  const wsQuestoes = XLSX.utils.aoa_to_sheet([
    ['QUESTÕES PROBLEMÁTICAS (Taxa de Erro ≥ 50%)'],
    [''],
    questoesHeader,
    ...questoesRows,
  ]);
  wsQuestoes['!cols'] = [{ wch: 5 }, { wch: 100 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsQuestoes, 'Questões Problemáticas');

  // Download
  const filename = `simulados_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
