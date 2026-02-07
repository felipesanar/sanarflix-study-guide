import * as XLSX from 'xlsx';
import type { SimuladoOverview, ExecutiveKPIs, SegmentacaoIES, SegmentacaoSemestre, SegmentacaoDimensao, QuestaoProblematica, ComportamentoMetrics } from '@/hooks/useSimuladosAnalytics';

interface ExportData {
  executive: ExecutiveKPIs;
  simulados: SimuladoOverview[];
  segmentacaoIES: SegmentacaoIES[];
  segmentacaoSemestre: SegmentacaoSemestre[];
  segmentacaoArea: SegmentacaoDimensao[];
  segmentacaoEspecialidade: SegmentacaoDimensao[];
  segmentacaoTema: SegmentacaoDimensao[];
  segmentacaoDificuldade: SegmentacaoDimensao[];
  questoesProblematicas: QuestaoProblematica[];
  comportamento: ComportamentoMetrics;
}

interface ExportFilters {
  dateRange: { start: Date; end: Date };
  university: string | null;
  excludedIES: string[];
}

// ============== CSV EXPORT ==============
export function exportToCSV(data: ExportData, filters: ExportFilters): void {
  const timestamp = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });
  
  const lines: string[] = [
    '# ═══════════════════════════════════════════════════════════════════',
    '# RELATÓRIO DE ANALYTICS - SIMULADOS',
    '# SanarFlix Academy',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    '# METADADOS DO RELATÓRIO',
    `Exportado em:,${timestamp}`,
    `Período:,${filters.dateRange.start.toLocaleDateString('pt-BR')} a ${filters.dateRange.end.toLocaleDateString('pt-BR')}`,
    `IES Filtrada:,${filters.university || 'Todas'}`,
    `IES Excluídas:,${filters.excludedIES.length > 0 ? filters.excludedIES.join('; ') : 'Nenhuma'}`,
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 1: RESUMO EXECUTIVO',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Métrica,Valor,Observação',
    `Simulados Ativos,${data.executive.simuladosAtivos},no período`,
    `Alunos Iniciaram,${data.executive.alunosIniciaram},usuários únicos`,
    `Alunos Concluíram,${data.executive.alunosConcluiram},usuários únicos`,
    `Taxa de Conclusão,${data.executive.taxaConclusao}%,concluintes / iniciantes`,
    `Acurácia Média,${data.executive.acuraciaMedia}%,taxa de acertos`,
    `Tempo Mediano,${data.executive.tempoMedianoMinutos} min,p50`,
    `Tempo Médio,${data.executive.tempoMedioMinutos} min,média aritmética`,
    `Saídas de Aba (mediana),${data.executive.saidasAbaMediana.toFixed(1)},`,
    `Saídas de Fullscreen (mediana),${data.executive.saidasFullscreenMediana.toFixed(1)},`,
    `Tentativas (média),${data.executive.tentativasMedia.toFixed(1)},`,
    `Liberados Novamente,${data.executive.percentLiberadoNovamente}%,`,
    `Total de Respostas,${data.executive.totalRespostas.toLocaleString('pt-BR')},base de cálculo`,
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 2: PERFORMANCE POR SIMULADO',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Simulado,Status,Iniciados,Concluintes,Taxa Conclusão,Acurácia,Tempo Mediano (min),Saídas Aba,Saídas Fullscreen,Tentativas,Questões',
    ...data.simulados.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      s.status,
      s.iniciados_unicos,
      s.concluintes_unicos,
      `${s.taxa_conclusao}%`,
      `${s.acuracia_media}%`,
      Math.round(s.tempo_mediano_segundos / 60),
      s.saidas_aba_media.toFixed(1),
      s.saidas_fullscreen_media.toFixed(1),
      s.tentativas_media.toFixed(1),
      s.total_questoes,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 3: SEGMENTAÇÃO POR IES',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'IES,Alunos,Acurácia,N Respostas',
    ...data.segmentacaoIES.map(s => [
      `"${s.ies_nome.replace(/"/g, '""')}"`,
      s.alunos,
      `${s.acuracia}%`,
      s.n_respostas,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 4: SEGMENTAÇÃO POR SEMESTRE',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Semestre,Alunos,Acurácia,N Respostas',
    ...data.segmentacaoSemestre.map(s => [
      `"${s.semestre}"`,
      s.alunos,
      `${s.acuracia}%`,
      s.n_respostas,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 5: SEGMENTAÇÃO POR GRANDE ÁREA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Grande Área,Acurácia,N Respostas',
    ...data.segmentacaoArea.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      `${s.acuracia}%`,
      s.n_respostas,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 6: SEGMENTAÇÃO POR ESPECIALIDADE',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Especialidade,Acurácia,N Respostas',
    ...data.segmentacaoEspecialidade.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      `${s.acuracia}%`,
      s.n_respostas,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 7: SEGMENTAÇÃO POR TEMA',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Tema,Acurácia,N Respostas',
    ...data.segmentacaoTema.map(s => [
      `"${s.nome.replace(/"/g, '""')}"`,
      `${s.acuracia}%`,
      s.n_respostas,
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 8: QUESTÕES PROBLEMÁTICAS (TOP 20 MAIOR ERRO)',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Enunciado (truncado),Grande Área,Especialidade,Tema,Dificuldade,Taxa Erro,N Respostas,Anulada',
    ...data.questoesProblematicas.slice(0, 20).map(q => [
      `"${q.enunciado.substring(0, 100).replace(/"/g, '""').replace(/\n/g, ' ')}..."`,
      `"${q.grande_area || 'N/A'}"`,
      `"${q.especialidade || 'N/A'}"`,
      `"${q.tema || 'N/A'}"`,
      `"${q.dificuldade || 'N/A'}"`,
      `${q.taxa_erro}%`,
      q.n_respostas,
      q.anulada ? 'Sim' : 'Não',
    ].join(',')),
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# SEÇÃO 9: COMPORTAMENTO E INTEGRIDADE',
    '# ═══════════════════════════════════════════════════════════════════',
    '',
    'Métrica,Valor',
    `Saídas de Aba (média),${data.comportamento.saidasAbaMedia.toFixed(2)}`,
    `Saídas de Aba (p95),${data.comportamento.saidasAbaP95.toFixed(2)}`,
    `Saídas de Fullscreen (média),${data.comportamento.saidasFullscreenMedia.toFixed(2)}`,
    `Saídas de Fullscreen (p95),${data.comportamento.saidasFullscreenP95.toFixed(2)}`,
    `Total Iniciados,${data.comportamento.abandono.totalIniciados}`,
    `Total Finalizados,${data.comportamento.abandono.totalFinalizados}`,
    `Taxa de Abandono,${data.comportamento.abandono.taxaAbandono}%`,
    `Liberados Novamente,${data.comportamento.liberadoNovamente.count} (${data.comportamento.liberadoNovamente.percent}%)`,
    '',
    '# ═══════════════════════════════════════════════════════════════════',
    '# FIM DO RELATÓRIO',
    '# ═══════════════════════════════════════════════════════════════════',
  ];

  const csvContent = lines.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `simulados_analytics_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============== XLSX EXPORT (Premium Formatted) ==============
export function exportToXLSX(data: ExportData, filters: ExportFilters): void {
  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });

  // ============== ABA 1: RESUMO EXECUTIVO ==============
  const resumoData = [
    ['RELATÓRIO DE ANALYTICS - SIMULADOS'],
    ['SanarFlix Academy'],
    [''],
    ['METADADOS'],
    ['Exportado em', timestamp],
    ['Período', `${filters.dateRange.start.toLocaleDateString('pt-BR')} a ${filters.dateRange.end.toLocaleDateString('pt-BR')}`],
    ['IES Filtrada', filters.university || 'Todas'],
    ['IES Excluídas', filters.excludedIES.length > 0 ? filters.excludedIES.join('; ') : 'Nenhuma'],
    [''],
    ['RESUMO EXECUTIVO'],
    ['Métrica', 'Valor', 'Observação'],
    ['Simulados Ativos', data.executive.simuladosAtivos, 'no período'],
    ['Alunos Iniciaram', data.executive.alunosIniciaram, 'usuários únicos'],
    ['Alunos Concluíram', data.executive.alunosConcluiram, 'usuários únicos'],
    ['Taxa de Conclusão', `${data.executive.taxaConclusao}%`, 'concluintes / iniciantes'],
    ['Acurácia Média', `${data.executive.acuraciaMedia}%`, 'taxa de acertos'],
    ['Tempo Mediano', `${data.executive.tempoMedianoMinutos} min`, 'p50'],
    ['Tempo Médio', `${data.executive.tempoMedioMinutos} min`, 'média aritmética'],
    ['Saídas de Aba (mediana)', data.executive.saidasAbaMediana.toFixed(1), ''],
    ['Saídas de Fullscreen (mediana)', data.executive.saidasFullscreenMediana.toFixed(1), ''],
    ['Tentativas (média)', data.executive.tentativasMedia.toFixed(1), ''],
    ['Liberados Novamente', `${data.executive.percentLiberadoNovamente}%`, ''],
    ['Total de Respostas', data.executive.totalRespostas.toLocaleString('pt-BR'), 'base de cálculo'],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }];
  wsResumo['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Título
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Subtítulo
  ];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

  // ============== ABA 2: SIMULADOS ==============
  const simuladosHeader = [
    'Simulado', 'Status', 'Liberação', 'Encerramento', 'Duração (min)', 
    'Questões', 'Iniciados', 'Concluintes', 'Taxa Conclusão', 'Acurácia',
    'Tempo Mediano (min)', 'Saídas Aba (média)', 'Saídas Fullscreen (média)', 'Tentativas (média)'
  ];
  const simuladosRows = data.simulados.map(s => [
    s.nome,
    s.status,
    s.data_liberacao ? new Date(s.data_liberacao).toLocaleDateString('pt-BR') : '-',
    s.data_encerramento ? new Date(s.data_encerramento).toLocaleDateString('pt-BR') : '-',
    s.duracao_minutos,
    s.total_questoes,
    s.iniciados_unicos,
    s.concluintes_unicos,
    s.taxa_conclusao / 100,
    s.acuracia_media / 100,
    Math.round(s.tempo_mediano_segundos / 60),
    s.saidas_aba_media,
    s.saidas_fullscreen_media,
    s.tentativas_media,
  ]);
  const wsSimulados = XLSX.utils.aoa_to_sheet([simuladosHeader, ...simuladosRows]);
  wsSimulados['!cols'] = [
    { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 16 },
  ];
  // Format percentages
  for (let r = 1; r <= simuladosRows.length; r++) {
    const taxaCell = XLSX.utils.encode_cell({ r, c: 8 });
    const acuraciaCell = XLSX.utils.encode_cell({ r, c: 9 });
    if (wsSimulados[taxaCell]) wsSimulados[taxaCell].z = '0%';
    if (wsSimulados[acuraciaCell]) wsSimulados[acuraciaCell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsSimulados, 'Simulados');

  // ============== ABA 3: SEGMENTAÇÃO IES ==============
  const iesHeader = ['IES', 'Alunos', 'Acurácia', 'N Respostas'];
  const iesRows = data.segmentacaoIES.map(s => [
    s.ies_nome,
    s.alunos,
    s.acuracia / 100,
    s.n_respostas,
  ]);
  const wsIES = XLSX.utils.aoa_to_sheet([iesHeader, ...iesRows]);
  wsIES['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= iesRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 2 });
    if (wsIES[cell]) wsIES[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsIES, 'Por IES');

  // ============== ABA 4: SEGMENTAÇÃO SEMESTRE ==============
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
    const cell = XLSX.utils.encode_cell({ r, c: 2 });
    if (wsSem[cell]) wsSem[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsSem, 'Por Semestre');

  // ============== ABA 5: GRANDE ÁREA ==============
  const areaHeader = ['Grande Área', 'Acurácia', 'N Respostas'];
  const areaRows = data.segmentacaoArea.map(s => [s.nome, s.acuracia / 100, s.n_respostas]);
  const wsArea = XLSX.utils.aoa_to_sheet([areaHeader, ...areaRows]);
  wsArea['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= areaRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsArea[cell]) wsArea[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsArea, 'Por Grande Área');

  // ============== ABA 6: ESPECIALIDADE ==============
  const espHeader = ['Especialidade', 'Acurácia', 'N Respostas'];
  const espRows = data.segmentacaoEspecialidade.map(s => [s.nome, s.acuracia / 100, s.n_respostas]);
  const wsEsp = XLSX.utils.aoa_to_sheet([espHeader, ...espRows]);
  wsEsp['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= espRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsEsp[cell]) wsEsp[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsEsp, 'Por Especialidade');

  // ============== ABA 7: TEMA ==============
  const temaHeader = ['Tema', 'Acurácia', 'N Respostas'];
  const temaRows = data.segmentacaoTema.map(s => [s.nome, s.acuracia / 100, s.n_respostas]);
  const wsTema = XLSX.utils.aoa_to_sheet([temaHeader, ...temaRows]);
  wsTema['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= temaRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsTema[cell]) wsTema[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsTema, 'Por Tema');

  // ============== ABA 8: DIFICULDADE ==============
  const difHeader = ['Dificuldade', 'Acurácia', 'N Respostas'];
  const difRows = data.segmentacaoDificuldade.map(s => [s.nome, s.acuracia / 100, s.n_respostas]);
  const wsDif = XLSX.utils.aoa_to_sheet([difHeader, ...difRows]);
  wsDif['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }];
  for (let r = 1; r <= difRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 1 });
    if (wsDif[cell]) wsDif[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsDif, 'Por Dificuldade');

  // ============== ABA 9: QUESTÕES PROBLEMÁTICAS ==============
  const questoesHeader = ['Enunciado', 'Grande Área', 'Especialidade', 'Tema', 'Dificuldade', 'Taxa Erro', 'N Respostas', 'Anulada'];
  const questoesRows = data.questoesProblematicas.map(q => [
    q.enunciado.substring(0, 200).replace(/\n/g, ' '),
    q.grande_area || 'N/A',
    q.especialidade || 'N/A',
    q.tema || 'N/A',
    q.dificuldade || 'N/A',
    q.taxa_erro / 100,
    q.n_respostas,
    q.anulada ? 'Sim' : 'Não',
  ]);
  const wsQuestoes = XLSX.utils.aoa_to_sheet([questoesHeader, ...questoesRows]);
  wsQuestoes['!cols'] = [
    { wch: 80 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, 
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];
  for (let r = 1; r <= questoesRows.length; r++) {
    const cell = XLSX.utils.encode_cell({ r, c: 5 });
    if (wsQuestoes[cell]) wsQuestoes[cell].z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, wsQuestoes, 'Questões Problemáticas');

  // ============== ABA 10: COMPORTAMENTO ==============
  const comportamentoData = [
    ['COMPORTAMENTO E INTEGRIDADE'],
    [''],
    ['Métrica', 'Valor'],
    ['Saídas de Aba (média)', data.comportamento.saidasAbaMedia.toFixed(2)],
    ['Saídas de Aba (p95)', data.comportamento.saidasAbaP95.toFixed(2)],
    ['Saídas de Fullscreen (média)', data.comportamento.saidasFullscreenMedia.toFixed(2)],
    ['Saídas de Fullscreen (p95)', data.comportamento.saidasFullscreenP95.toFixed(2)],
    [''],
    ['ABANDONO'],
    ['Total Iniciados', data.comportamento.abandono.totalIniciados],
    ['Total Finalizados', data.comportamento.abandono.totalFinalizados],
    ['Taxa de Abandono', `${data.comportamento.abandono.taxaAbandono}%`],
    [''],
    ['LIBERAÇÕES'],
    ['Liberados Novamente', data.comportamento.liberadoNovamente.count],
    ['Percentual', `${data.comportamento.liberadoNovamente.percent}%`],
    [''],
    ['SIMULADOS COM FRICÇÃO ALTA'],
    ...data.comportamento.simuladosComFriccaoAlta.map(s => [s]),
  ];
  const wsComp = XLSX.utils.aoa_to_sheet(comportamentoData);
  wsComp['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsComp, 'Comportamento');

  // Download
  const filename = `simulados_analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
