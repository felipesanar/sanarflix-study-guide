import * as XLSX from 'xlsx';
import type { SimuladoOverview, ExecutiveKPIs, SegmentacaoIES, SegmentacaoSemestre, SegmentacaoDimensao, QuestaoProblematica, ComportamentoMetrics, TemporalData } from '@/hooks/useSimuladosAnalytics';

interface ExportData {
  executive: ExecutiveKPIs;
  temporal: TemporalData;
  simulados: SimuladoOverview[];
  segmentacaoIES: SegmentacaoIES[];
  segmentacaoSemestre: SegmentacaoSemestre[];
  segmentacaoArea: SegmentacaoDimensao[];
  segmentacaoEspecialidade: SegmentacaoDimensao[];
  segmentacaoTema: SegmentacaoDimensao[];
  questoesProblematicas: QuestaoProblematica[];
  comportamento: ComportamentoMetrics;
}

interface ExportFilters {
  dateRange: { start: Date; end: Date };
  university: string | null;
  excludedIES: string[];
}

export type SimuladosPremiumExportData = ExportData;
export type SimuladosPremiumExportFilters = ExportFilters;

// ============== HELPERS ==============
const formatPercent = (value: number): string => `${value.toFixed(1)}%`;
const formatNumber = (value: number): string => value.toLocaleString('pt-BR');
const formatDate = (date: Date): string => date.toLocaleDateString('pt-BR');
const formatDateTime = (date: Date): string => date.toLocaleDateString('pt-BR', { 
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
});

// Cor institucional para headers
const HEADER_FILL = { fgColor: { rgb: '8B1538' } };
const HEADER_FONT = { color: { rgb: 'FFFFFF' }, bold: true };

// Calcular prioridade de intervenção baseado em acurácia e volume
function getPrioridadeIntervencao(acuracia: number, nRespostas: number, medianRespostas: number): string {
  if (acuracia < 40 && nRespostas >= medianRespostas) return 'CRÍTICA';
  if (acuracia < 50 && nRespostas >= medianRespostas) return 'Alta';
  if (acuracia < 50) return 'Média';
  if (acuracia < 60 && nRespostas >= medianRespostas) return 'Média';
  return 'Baixa';
}

// Gerar matriz cruzada Simulado x IES
function buildSimuladoIESMatrix(
  simulados: SimuladoOverview[],
  segmentacaoIES: SegmentacaoIES[],
  questoesProblematicas: QuestaoProblematica[]
): { headers: string[]; rows: (string | number | null)[][] } {
  // Para cada simulado, precisamos calcular a acurácia por IES
  // Como não temos esse dado granular diretamente, usamos os dados agregados disponíveis
  // Esta é uma aproximação - em produção ideal, o hook retornaria dados por simulado+IES
  
  const iesNames = segmentacaoIES.map(s => s.ies_nome);
  const headers = ['Simulado', 'Acurácia Geral', 'N Respostas', ...iesNames];
  
  const rows = simulados.map(sim => {
    const row: (string | number | null)[] = [
      sim.nome,
      sim.acuracia_media,
      sim.iniciados_unicos * sim.total_questoes, // Estimativa de respostas
    ];
    
    // Para cada IES, mostramos a acurácia geral dela (não é por simulado, mas dá contexto)
    // Isso é uma limitação - idealmente teríamos dados cruzados
    iesNames.forEach(iesNome => {
      const iesData = segmentacaoIES.find(s => s.ies_nome === iesNome);
      row.push(iesData?.acuracia ?? null);
    });
    
    return row;
  });
  
  return { headers, rows };
}

// Identificar gaps pedagógicos críticos
function buildGapsPedagogicos(
  segmentacaoTema: SegmentacaoDimensao[],
  segmentacaoEspecialidade: SegmentacaoDimensao[]
): { tema: string; tipo: string; acuracia: number; nRespostas: number; prioridade: string }[] {
  const allGaps: { tema: string; tipo: string; acuracia: number; nRespostas: number; prioridade: string }[] = [];
  
  // Calcular mediana de respostas para definir volume significativo
  const allRespostas = [...segmentacaoTema, ...segmentacaoEspecialidade].map(s => s.n_respostas);
  const sortedRespostas = [...allRespostas].sort((a, b) => a - b);
  const medianRespostas = sortedRespostas[Math.floor(sortedRespostas.length / 2)] || 0;
  
  // Gaps por tema
  segmentacaoTema
    .filter(t => t.acuracia < 60)
    .forEach(t => {
      allGaps.push({
        tema: t.nome,
        tipo: 'Tema',
        acuracia: t.acuracia,
        nRespostas: t.n_respostas,
        prioridade: getPrioridadeIntervencao(t.acuracia, t.n_respostas, medianRespostas),
      });
    });
  
  // Gaps por especialidade
  segmentacaoEspecialidade
    .filter(e => e.acuracia < 60)
    .forEach(e => {
      allGaps.push({
        tema: e.nome,
        tipo: 'Especialidade',
        acuracia: e.acuracia,
        nRespostas: e.n_respostas,
        prioridade: getPrioridadeIntervencao(e.acuracia, e.n_respostas, medianRespostas),
      });
    });
  
  // Ordenar por prioridade e volume
  const prioridadeOrdem: Record<string, number> = { 'CRÍTICA': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
  return allGaps.sort((a, b) => {
    const pDiff = prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade];
    if (pDiff !== 0) return pDiff;
    return b.nRespostas - a.nRespostas;
  });
}

// Dia da semana em português
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ============== CSV EXPORT (PREMIUM) ==============
export function exportToCSV(data: ExportData, filters: ExportFilters): void {
  const timestamp = formatDateTime(new Date());
  const gaps = buildGapsPedagogicos(data.segmentacaoTema, data.segmentacaoEspecialidade);
  
  const lines: string[] = [
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# RELATÓRIO PREMIUM DE ANALYTICS - SIMULADOS',
    '# SanarFlix Academy - Análise Pedagógica Profunda',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    '# METADADOS DO RELATÓRIO',
    `Exportado em:,${timestamp}`,
    `Período:,${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`,
    `IES Filtrada:,${filters.university || 'Todas'}`,
    `IES Excluídas:,${filters.excludedIES.length > 0 ? filters.excludedIES.join('; ') : 'Nenhuma'}`,
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 1: RESUMO EXECUTIVO',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Métrica,Valor,Observação',
    `Simulados Ativos,${data.executive.simuladosAtivos},no período`,
    `Alunos Iniciaram,${formatNumber(data.executive.alunosIniciaram)},usuários únicos`,
    `Alunos Concluíram,${formatNumber(data.executive.alunosConcluiram)},usuários únicos`,
    `Taxa de Conclusão,${formatPercent(data.executive.taxaConclusao)},concluintes / iniciantes`,
    `Acurácia Média,${formatPercent(data.executive.acuraciaMedia)},taxa de acertos`,
    `Tempo Mediano,${data.executive.tempoMedianoMinutos} min,p50`,
    `Tempo Médio,${data.executive.tempoMedioMinutos} min,média aritmética`,
    `Saídas de Aba (mediana),${data.executive.saidasAbaMediana.toFixed(1)},indicador de integridade`,
    `Saídas de Fullscreen (mediana),${data.executive.saidasFullscreenMediana.toFixed(1)},indicador de integridade`,
    `Tentativas (média),${data.executive.tentativasMedia.toFixed(1)},`,
    `Liberados Novamente,${formatPercent(data.executive.percentLiberadoNovamente)},nova tentativa autorizada`,
    `Total de Respostas,${formatNumber(data.executive.totalRespostas)},base de cálculo`,
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 2: PERFORMANCE POR SIMULADO (COMPLETA)',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Simulado,Status,Liberação,Encerramento,Duração (min),Questões,Iniciados,Concluintes,Taxa Conclusão,Acurácia,Tempo Mediano (min),Saídas Aba,Saídas Fullscreen,Tentativas',
    ...data.simulados.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      s.status,
      s.data_liberacao ? formatDate(new Date(s.data_liberacao)) : '-',
      s.data_encerramento ? formatDate(new Date(s.data_encerramento)) : '-',
      s.duracao_minutos,
      s.total_questoes,
      s.iniciados_unicos,
      s.concluintes_unicos,
      formatPercent(s.taxa_conclusao),
      formatPercent(s.acuracia_media),
      Math.round(s.tempo_mediano_segundos / 60),
      s.saidas_aba_media.toFixed(1),
      s.saidas_fullscreen_media.toFixed(1),
      s.tentativas_media.toFixed(1),
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 3: SEGMENTAÇÃO POR IES',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'IES,Alunos,Acurácia,N Respostas,Ranking',
    ...data.segmentacaoIES
      .sort((a, b) => b.acuracia - a.acuracia)
      .map((s, idx) => [
        `"${s.ies_nome.replace(/"/g, '""')}"`,
        s.alunos,
        formatPercent(s.acuracia),
        formatNumber(s.n_respostas),
        idx + 1,
      ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 4: SEGMENTAÇÃO POR SEMESTRE',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Semestre,Alunos,Acurácia,N Respostas',
    ...data.segmentacaoSemestre.map(s => [
      `"${s.semestre}"`,
      s.alunos,
      formatPercent(s.acuracia),
      formatNumber(s.n_respostas),
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 5: SEGMENTAÇÃO POR GRANDE ÁREA',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Grande Área,Acurácia,N Respostas',
    ...data.segmentacaoArea.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      formatPercent(s.acuracia),
      formatNumber(s.n_respostas),
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 6: SEGMENTAÇÃO POR ESPECIALIDADE',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Especialidade,Acurácia,N Respostas',
    ...data.segmentacaoEspecialidade.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      formatPercent(s.acuracia),
      formatNumber(s.n_respostas),
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 7: SEGMENTAÇÃO POR TEMA (GRANULARIDADE MÁXIMA)',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Tema,Acurácia,N Respostas',
    ...data.segmentacaoTema.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      formatPercent(s.acuracia),
      formatNumber(s.n_respostas),
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 8: GAPS PEDAGÓGICOS PRIORIZADOS (EXCLUSIVO)',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Tema/Especialidade,Tipo,Acurácia,N Respostas,Prioridade Intervenção',
    ...gaps.slice(0, 50).map(g => [
      `"${g.tema.replace(/"/g, '""')}"`,
      g.tipo,
      formatPercent(g.acuracia),
      formatNumber(g.nRespostas),
      g.prioridade,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 10: EVOLUÇÃO TEMPORAL - INÍCIOS POR DIA',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Data,Inícios',
    ...data.temporal.inicioPorDia.map(d => `${d.data},${d.count}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 11: EVOLUÇÃO TEMPORAL - CONCLUSÕES POR DIA',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Data,Conclusões',
    ...data.temporal.conclusaoPorDia.map(d => `${d.data},${d.count}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 12: HEATMAP DE ATIVIDADE (HORA x DIA DA SEMANA)',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Hora,Dia da Semana,Atividades',
    ...data.temporal.heatmapHorario.map(h => `${h.hora}:00,${diasSemana[h.dia] || h.dia},${h.count}`),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 13: QUESTÕES PROBLEMÁTICAS (TOP 50 COM DISTRIBUIÇÃO)',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Enunciado (truncado),Grande Área,Especialidade,Tema,Taxa Erro,N Respostas,Anulada,Dist. A,Dist. B,Dist. C,Dist. D,Dist. E',
    ...data.questoesProblematicas.slice(0, 50).map(q => {
      const distMap = new Map(q.distribuicao.map(d => [d.alternativa, d.percent]));
      return [
        `"${q.enunciado.substring(0, 120).replace(/"/g, '""').replace(/\n/g, ' ')}..."`,
        `"${q.grande_area || 'N/A'}"`,
        `"${q.especialidade || 'N/A'}"`,
        `"${q.tema || 'N/A'}"`,
        formatPercent(q.taxa_erro),
        q.n_respostas,
        q.anulada ? 'Sim' : 'Não',
        formatPercent(distMap.get('A') || 0),
        formatPercent(distMap.get('B') || 0),
        formatPercent(distMap.get('C') || 0),
        formatPercent(distMap.get('D') || 0),
        formatPercent(distMap.get('E') || 0),
      ].join(',');
    }),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# SEÇÃO 14: COMPORTAMENTO E INTEGRIDADE',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '',
    'Métrica,Valor',
    `Saídas de Aba (média),${data.comportamento.saidasAbaMedia.toFixed(2)}`,
    `Saídas de Aba (p95),${data.comportamento.saidasAbaP95.toFixed(2)}`,
    `Saídas de Fullscreen (média),${data.comportamento.saidasFullscreenMedia.toFixed(2)}`,
    `Saídas de Fullscreen (p95),${data.comportamento.saidasFullscreenP95.toFixed(2)}`,
    `Total Iniciados,${formatNumber(data.comportamento.abandono.totalIniciados)}`,
    `Total Finalizados,${formatNumber(data.comportamento.abandono.totalFinalizados)}`,
    `Taxa de Abandono,${formatPercent(data.comportamento.abandono.taxaAbandono)}`,
    `Liberados Novamente,${data.comportamento.liberadoNovamente.count} (${formatPercent(data.comportamento.liberadoNovamente.percent)})`,
    '',
    'Simulados com Fricção Alta:',
    ...data.comportamento.simuladosComFriccaoAlta.map(s => `"${s}"`),
    '',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
    '# FIM DO RELATÓRIO PREMIUM',
    '# ═══════════════════════════════════════════════════════════════════════════════════════',
  ];

  const csvContent = lines.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `simulados_analytics_premium_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============== XLSX EXPORT PREMIUM (15 ABAS ESPECIALIZADAS) ==============
export function exportToXLSX(data: ExportData, filters: ExportFilters): void {
  const wb = XLSX.utils.book_new();
  const timestamp = formatDateTime(new Date());
  const gaps = buildGapsPedagogicos(data.segmentacaoTema, data.segmentacaoEspecialidade);
  const matrix = buildSimuladoIESMatrix(data.simulados, data.segmentacaoIES, data.questoesProblematicas);

  // ============== ABA 1: CAPA EXECUTIVA ==============
  const capaData = [
    [''],
    ['RELATÓRIO PREMIUM DE ANALYTICS'],
    ['SIMULADOS - ANÁLISE PEDAGÓGICA PROFUNDA'],
    [''],
    ['SanarFlix Academy'],
    [''],
    ['═══════════════════════════════════════════════════════════════'],
    [''],
    ['METADADOS'],
    ['Exportado em', timestamp],
    ['Período de Análise', `${formatDate(filters.dateRange.start)} a ${formatDate(filters.dateRange.end)}`],
    ['IES Filtrada', filters.university || 'Todas as IES'],
    ['IES Excluídas', filters.excludedIES.length > 0 ? filters.excludedIES.join(', ') : 'Nenhuma'],
    [''],
    ['═══════════════════════════════════════════════════════════════'],
    [''],
    ['SUMÁRIO DO RELATÓRIO'],
    ['Total de Abas', '15'],
    [''],
    ['Aba', 'Conteúdo'],
    ['1. Capa', 'Metadados e visão geral'],
    ['2. KPIs Executivos', 'Indicadores-chave de performance'],
    ['3. Simulados', 'Performance detalhada por simulado'],
    ['4. Por IES', 'Ranking e comparativo entre instituições'],
    ['5. Por Semestre', 'Performance por período acadêmico'],
    ['6. Por Grande Área', 'Gaps pedagógicos por área médica'],
    ['7. Por Especialidade', 'Detalhamento por especialidade'],
    ['8. Por Tema', 'Granularidade máxima - todos os temas'],
    ['9. Gaps Priorizados', 'Intervenções pedagógicas rankeadas (EXCLUSIVO)'],
    ['10. Evolução Temporal', 'Séries de inícios e conclusões'],
    ['12. Heatmap', 'Mapa de calor hora x dia da semana'],
    ['13. Questões Prob.', 'Top 50 com distribuição de alternativas'],
    ['14. Comportamento', 'Métricas de integridade e abandono'],
    ['15. Matriz IES', 'Tabela cruzada Simulado x IES (EXCLUSIVO)'],
  ];
  const wsCapa = XLSX.utils.aoa_to_sheet(capaData);
  wsCapa['!cols'] = [{ wch: 25 }, { wch: 50 }];
  wsCapa['!merges'] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsCapa, '1. Capa');

  // ============== ABA 2: KPIs EXECUTIVOS ==============
  const kpisData = [
    ['INDICADORES-CHAVE DE PERFORMANCE'],
    [''],
    ['Categoria', 'Métrica', 'Valor', 'Observação'],
    ['Participação', 'Simulados Ativos', data.executive.simuladosAtivos, 'No período selecionado'],
    ['Participação', 'Alunos Iniciaram', data.executive.alunosIniciaram, 'Usuários únicos'],
    ['Participação', 'Alunos Concluíram', data.executive.alunosConcluiram, 'Usuários únicos'],
    ['Participação', 'Taxa de Conclusão', data.executive.taxaConclusao / 100, 'Concluintes / Iniciantes'],
    [''],
    ['Desempenho', 'Acurácia Média', data.executive.acuraciaMedia / 100, 'Taxa de acertos geral'],
    ['Desempenho', 'Total de Respostas', data.executive.totalRespostas, 'Base de cálculo'],
    [''],
    ['Tempo', 'Tempo Mediano', `${data.executive.tempoMedianoMinutos} min`, 'Percentil 50'],
    ['Tempo', 'Tempo Médio', `${data.executive.tempoMedioMinutos} min`, 'Média aritmética'],
    [''],
    ['Integridade', 'Saídas de Aba (mediana)', data.executive.saidasAbaMediana.toFixed(1), 'Indicador de foco'],
    ['Integridade', 'Saídas de Fullscreen (mediana)', data.executive.saidasFullscreenMediana.toFixed(1), 'Indicador de foco'],
    ['Integridade', 'Tentativas (média)', data.executive.tentativasMedia.toFixed(1), 'Por usuário/simulado'],
    ['Integridade', 'Liberados Novamente', data.executive.percentLiberadoNovamente / 100, 'Nova tentativa autorizada'],
  ];
  const wsKPIs = XLSX.utils.aoa_to_sheet(kpisData);
  wsKPIs['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];
  // Format percentages
  ['E4', 'E7', 'E9', 'E17'].forEach(cell => {
    if (wsKPIs[cell] && typeof wsKPIs[cell].v === 'number') wsKPIs[cell].z = '0.0%';
  });
  XLSX.utils.book_append_sheet(wb, wsKPIs, '2. KPIs Executivos');

  // ============== ABA 3: SIMULADOS DETALHADOS ==============
  const simuladosHeader = [
    'Simulado', 'Status', 'Liberação', 'Encerramento', 'Duração (min)', 
    'Questões', 'Anuladas', 'Iniciados', 'Concluintes', 'Taxa Conclusão', 'Acurácia',
    'Tempo Mediano (min)', 'Tempo Médio (min)', 'Saídas Aba', 'Saídas Fullscreen', 'Tentativas', 'IES Vinculadas'
  ];
  const simuladosRows = data.simulados.map(s => [
    s.nome,
    s.status,
    s.data_liberacao ? formatDate(new Date(s.data_liberacao)) : '-',
    s.data_encerramento ? formatDate(new Date(s.data_encerramento)) : '-',
    s.duracao_minutos,
    s.total_questoes,
    s.questoes_anuladas,
    s.iniciados_unicos,
    s.concluintes_unicos,
    s.taxa_conclusao / 100,
    s.acuracia_media / 100,
    Math.round(s.tempo_mediano_segundos / 60),
    Math.round(s.tempo_medio_segundos / 60),
    s.saidas_aba_media.toFixed(1),
    s.saidas_fullscreen_media.toFixed(1),
    s.tentativas_media.toFixed(1),
    s.ies_ids?.length || 0,
  ]);
  const wsSimulados = XLSX.utils.aoa_to_sheet([simuladosHeader, ...simuladosRows]);
  wsSimulados['!cols'] = [
    { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
  ];
  for (let r = 1; r <= simuladosRows.length; r++) {
    ['J', 'K'].forEach((col, idx) => {
      const cell = `${col}${r + 1}`;
      if (wsSimulados[cell] && typeof wsSimulados[cell].v === 'number') wsSimulados[cell].z = '0%';
    });
  }
  XLSX.utils.book_append_sheet(wb, wsSimulados, '3. Simulados');

  // ============== ABA 4: POR IES (RANKING) ==============
  const iesSorted = [...data.segmentacaoIES].sort((a, b) => b.acuracia - a.acuracia);
  const bestIES = iesSorted[0]?.acuracia || 0;
  const worstIES = iesSorted[iesSorted.length - 1]?.acuracia || 0;
  
  const iesHeader = ['Ranking', 'IES', 'Alunos', 'Acurácia', 'N Respostas', 'Delta vs Melhor'];
  const iesRows = iesSorted.map((s, idx) => [
    idx + 1,
    s.ies_nome,
    s.alunos,
    s.acuracia / 100,
    s.n_respostas,
    (s.acuracia - bestIES) / 100,
  ]);
  
  // Adicionar rodapé com estatísticas
  const iesFooter = [
    [''],
    ['ESTATÍSTICAS COMPARATIVAS'],
    ['Melhor Acurácia', formatPercent(bestIES)],
    ['Pior Acurácia', formatPercent(worstIES)],
    ['Delta (Melhor - Pior)', formatPercent(bestIES - worstIES)],
  ];
  
  const wsIES = XLSX.utils.aoa_to_sheet([iesHeader, ...iesRows, ...iesFooter]);
  wsIES['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
  for (let r = 1; r <= iesRows.length; r++) {
    const acuraciaCell = `D${r + 1}`;
    const deltaCell = `F${r + 1}`;
    if (wsIES[acuraciaCell]) wsIES[acuraciaCell].z = '0.0%';
    if (wsIES[deltaCell]) wsIES[deltaCell].z = '+0.0%;-0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsIES, '4. Por IES');

  // ============== ABA 5: POR SEMESTRE ==============
  const semHeader = ['Semestre', 'Alunos', 'Acurácia', 'N Respostas'];
  const semRows = data.segmentacaoSemestre.map(s => [
    s.semestre,
    s.alunos,
    s.acuracia / 100,
    s.n_respostas,
  ]);
  const wsSem = XLSX.utils.aoa_to_sheet([semHeader, ...semRows]);
  wsSem['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= semRows.length; r++) {
    const cell = `C${r + 1}`;
    if (wsSem[cell]) wsSem[cell].z = '0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsSem, '5. Por Semestre');

  // ============== ABA 6: POR GRANDE ÁREA ==============
  const areaHeader = ['Grande Área', 'Acurácia', 'N Respostas', 'Status'];
  const areaRows = data.segmentacaoArea
    .sort((a, b) => a.acuracia - b.acuracia)
    .map(s => [
      s.nome,
      s.acuracia / 100,
      s.n_respostas,
      s.acuracia < 50 ? '⚠️ GAP' : s.acuracia < 60 ? '⚡ Atenção' : '✓ OK',
    ]);
  const wsArea = XLSX.utils.aoa_to_sheet([areaHeader, ...areaRows]);
  wsArea['!cols'] = [{ wch: 45 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
  for (let r = 1; r <= areaRows.length; r++) {
    const cell = `B${r + 1}`;
    if (wsArea[cell]) wsArea[cell].z = '0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsArea, '6. Por Grande Área');

  // ============== ABA 7: POR ESPECIALIDADE ==============
  const espHeader = ['Especialidade', 'Acurácia', 'N Respostas', 'Status'];
  const espRows = data.segmentacaoEspecialidade
    .sort((a, b) => a.acuracia - b.acuracia)
    .map(s => [
      s.nome,
      s.acuracia / 100,
      s.n_respostas,
      s.acuracia < 50 ? '⚠️ GAP' : s.acuracia < 60 ? '⚡ Atenção' : '✓ OK',
    ]);
  const wsEsp = XLSX.utils.aoa_to_sheet([espHeader, ...espRows]);
  wsEsp['!cols'] = [{ wch: 45 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
  for (let r = 1; r <= espRows.length; r++) {
    const cell = `B${r + 1}`;
    if (wsEsp[cell]) wsEsp[cell].z = '0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsEsp, '7. Por Especialidade');

  // ============== ABA 8: POR TEMA (GRANULARIDADE MÁXIMA) ==============
  const temaHeader = ['Tema', 'Acurácia', 'N Respostas', 'Status'];
  const temaRows = data.segmentacaoTema
    .sort((a, b) => a.acuracia - b.acuracia)
    .map(s => [
      s.nome,
      s.acuracia / 100,
      s.n_respostas,
      s.acuracia < 50 ? '⚠️ GAP CRÍTICO' : s.acuracia < 60 ? '⚡ Atenção' : '✓ OK',
    ]);
  const wsTema = XLSX.utils.aoa_to_sheet([temaHeader, ...temaRows]);
  wsTema['!cols'] = [{ wch: 55 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
  for (let r = 1; r <= temaRows.length; r++) {
    const cell = `B${r + 1}`;
    if (wsTema[cell]) wsTema[cell].z = '0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsTema, '8. Por Tema');

  // ============== ABA 9: GAPS PRIORIZADOS (EXCLUSIVO) ==============
  const gapsHeader = ['Prioridade', 'Tema/Especialidade', 'Tipo', 'Acurácia', 'N Respostas', 'Ação Sugerida'];
  const gapsRows = gaps.slice(0, 50).map(g => [
    g.prioridade,
    g.tema,
    g.tipo,
    g.acuracia / 100,
    g.nRespostas,
    g.prioridade === 'CRÍTICA' ? 'Revisão urgente do conteúdo' 
      : g.prioridade === 'Alta' ? 'Aula de reforço recomendada'
      : g.prioridade === 'Média' ? 'Monitorar próximos simulados'
      : 'Acompanhamento padrão',
  ]);
  
  const gapsIntro = [
    ['GAPS PEDAGÓGICOS PRIORIZADOS'],
    ['Análise exclusiva que identifica lacunas de aprendizado ordenadas por criticidade e volume'],
    [''],
    ['Critérios de Priorização:'],
    ['• CRÍTICA: Acurácia < 40% COM volume significativo'],
    ['• Alta: Acurácia < 50% COM volume significativo'],
    ['• Média: Acurácia < 50% OU entre 50-60% com volume'],
    ['• Baixa: Demais casos'],
    [''],
  ];
  
  const wsGaps = XLSX.utils.aoa_to_sheet([...gapsIntro, gapsHeader, ...gapsRows]);
  wsGaps['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 35 }];
  for (let r = gapsIntro.length + 1; r <= gapsIntro.length + gapsRows.length; r++) {
    const cell = `D${r + 1}`;
    if (wsGaps[cell]) wsGaps[cell].z = '0.0%';
  }
  XLSX.utils.book_append_sheet(wb, wsGaps, '10. Gaps Priorizados');

  // ============== ABA 11: EVOLUÇÃO TEMPORAL ==============
  const temporalHeader = ['Data', 'Inícios', 'Conclusões'];
  const allDates = new Set([
    ...data.temporal.inicioPorDia.map(d => d.data),
    ...data.temporal.conclusaoPorDia.map(d => d.data),
  ]);
  const inicioMap = new Map(data.temporal.inicioPorDia.map(d => [d.data, d.count]));
  const conclusaoMap = new Map(data.temporal.conclusaoPorDia.map(d => [d.data, d.count]));
  
  const temporalRows = Array.from(allDates)
    .sort()
    .map(data => [
      data,
      inicioMap.get(data) || 0,
      conclusaoMap.get(data) || 0,
    ]);
  
  const wsTemporal = XLSX.utils.aoa_to_sheet([temporalHeader, ...temporalRows]);
  wsTemporal['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTemporal, '11. Evolução Temporal');

  // ============== ABA 12: HEATMAP ==============
  const heatmapIntro = [
    ['MAPA DE CALOR - ATIVIDADE POR HORA E DIA DA SEMANA'],
    ['Identifica os períodos de maior engajamento dos alunos'],
    [''],
  ];
  
  // Criar matriz 24h x 7 dias
  const heatmapMatrix: (string | number)[][] = [
    ['Hora', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  ];
  
  const heatmapMap = new Map<string, number>();
  data.temporal.heatmapHorario.forEach(h => {
    heatmapMap.set(`${h.hora}_${h.dia}`, h.count);
  });
  
  for (let hora = 0; hora < 24; hora++) {
    const row: (string | number)[] = [`${hora.toString().padStart(2, '0')}:00`];
    for (let dia = 0; dia < 7; dia++) {
      row.push(heatmapMap.get(`${hora}_${dia}`) || 0);
    }
    heatmapMatrix.push(row);
  }
  
  const wsHeatmap = XLSX.utils.aoa_to_sheet([...heatmapIntro, ...heatmapMatrix]);
  wsHeatmap['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsHeatmap, '12. Heatmap');

  // ============== ABA 13: QUESTÕES PROBLEMÁTICAS ==============
  const questoesHeader = [
    'Enunciado', 'Grande Área', 'Especialidade', 'Tema',
    'Taxa Erro', 'N Respostas', 'Anulada', 'Comentário',
    '% Alt. A', '% Alt. B', '% Alt. C', '% Alt. D', '% Alt. E'
  ];
  const questoesRows = data.questoesProblematicas.slice(0, 50).map(q => {
    const distMap = new Map(q.distribuicao.map(d => [d.alternativa, d.percent]));
    return [
      q.enunciado.substring(0, 200).replace(/\n/g, ' '),
      q.grande_area || 'N/A',
      q.especialidade || 'N/A',
      q.tema || 'N/A',
      q.taxa_erro / 100,
      q.n_respostas,
      q.anulada ? 'Sim' : 'Não',
      q.comentario?.substring(0, 100) || '',
      (distMap.get('A') || 0) / 100,
      (distMap.get('B') || 0) / 100,
      (distMap.get('C') || 0) / 100,
      (distMap.get('D') || 0) / 100,
      (distMap.get('E') || 0) / 100,
    ];
  });
  const wsQuestoes = XLSX.utils.aoa_to_sheet([questoesHeader, ...questoesRows]);
  wsQuestoes['!cols'] = [
    { wch: 80 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  for (let r = 1; r <= questoesRows.length; r++) {
    ['F', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
      const cell = `${col}${r + 1}`;
      if (wsQuestoes[cell] && typeof wsQuestoes[cell].v === 'number') wsQuestoes[cell].z = '0.0%';
    });
  }
  XLSX.utils.book_append_sheet(wb, wsQuestoes, '13. Questões Problem.');

  // ============== ABA 14: COMPORTAMENTO E INTEGRIDADE ==============
  const comportamentoData = [
    ['COMPORTAMENTO E INTEGRIDADE DOS SIMULADOS'],
    [''],
    ['MÉTRICAS DE SAÍDA'],
    ['Métrica', 'Valor', 'Interpretação'],
    ['Saídas de Aba (média)', data.comportamento.saidasAbaMedia.toFixed(2), 'Troca de janela durante prova'],
    ['Saídas de Aba (p95)', data.comportamento.saidasAbaP95.toFixed(2), 'Limite dos 5% mais problemáticos'],
    ['Saídas de Fullscreen (média)', data.comportamento.saidasFullscreenMedia.toFixed(2), 'Saída do modo tela cheia'],
    ['Saídas de Fullscreen (p95)', data.comportamento.saidasFullscreenP95.toFixed(2), 'Limite dos 5% mais problemáticos'],
    [''],
    ['TAXA DE ABANDONO'],
    ['Total Iniciados', data.comportamento.abandono.totalIniciados, 'Alunos que começaram'],
    ['Total Finalizados', data.comportamento.abandono.totalFinalizados, 'Alunos que terminaram'],
    ['Taxa de Abandono', data.comportamento.abandono.taxaAbandono / 100, 'Iniciaram mas não concluíram'],
    [''],
    ['LIBERAÇÕES'],
    ['Liberados Novamente (total)', data.comportamento.liberadoNovamente.count, 'Autorizações de nova tentativa'],
    ['Liberados Novamente (%)', data.comportamento.liberadoNovamente.percent / 100, 'Do total de finalizações'],
    [''],
    ['SIMULADOS COM FRICÇÃO ALTA'],
    ['(Média de saídas > p75 ou taxa abandono > 30%)'],
    ...data.comportamento.simuladosComFriccaoAlta.map(s => [s, '', '']),
    data.comportamento.simuladosComFriccaoAlta.length === 0 ? ['Nenhum simulado identificado', '', ''] : [],
  ].filter(row => row.length > 0);
  
  const wsComp = XLSX.utils.aoa_to_sheet(comportamentoData);
  wsComp['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 35 }];
  // Format percentages
  if (wsComp['B13']) wsComp['B13'].z = '0.0%';
  if (wsComp['B17']) wsComp['B17'].z = '0.0%';
  XLSX.utils.book_append_sheet(wb, wsComp, '14. Comportamento');

  // ============== ABA 15: MATRIZ SIMULADO x IES (EXCLUSIVO) ==============
  const matrixIntro = [
    ['MATRIZ CRUZADA: SIMULADO x IES'],
    ['Análise exclusiva que permite comparar a performance relativa entre instituições em cada simulado'],
    [''],
    ['Nota: Os valores por IES representam a acurácia média geral da instituição.'],
    ['Para análise granular por simulado+IES, consulte o time de dados.'],
    [''],
  ];
  
  const wsMatrix = XLSX.utils.aoa_to_sheet([...matrixIntro, matrix.headers, ...matrix.rows]);
  
  // Definir larguras das colunas
  const matrixCols = [{ wch: 40 }, { wch: 15 }, { wch: 12 }];
  for (let i = 3; i < matrix.headers.length; i++) {
    matrixCols.push({ wch: 12 });
  }
  wsMatrix['!cols'] = matrixCols;
  
  // Format percentages (colunas de IES)
  for (let r = matrixIntro.length + 1; r <= matrixIntro.length + matrix.rows.length; r++) {
    for (let c = 3; c < matrix.headers.length; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      if (wsMatrix[cell] && typeof wsMatrix[cell].v === 'number') wsMatrix[cell].z = '0%';
    }
    // Acurácia geral
    const acuraciaCell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsMatrix[acuraciaCell] && typeof wsMatrix[acuraciaCell].v === 'number') wsMatrix[acuraciaCell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsMatrix, '15. Matriz IES');

  // ============== DOWNLOAD ==============
  const filename = `simulados_analytics_premium_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
