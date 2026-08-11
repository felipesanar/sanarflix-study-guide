import type {
  InstitutionalViewModel,
  RpcPerformanceResponse,
  RpcEvolutionEntry,
  RpcStudentScoresResponse,
  StudentScore,
  HeaderSummary,
  CurricularBreakdown,
  CurricularAreaNode,
  CurricularSpecialtyNode,
  CurricularTemaNode,
} from '@/types/desempenhoV2';
import type {
  KpiData,
  FaixaDistribuicao,
  MetaInstitucional,
  EvolucaoSimulado,
  DistanciaFaixa,
} from '@/mocks/desempenhoInstitucionalV2';
import type {
  InstitutionalTriSnapshot,
  InstitutionalTriEvolutionEntry,
} from '@/services/institutional';
import type { ActiveBase } from '@/utils/activeBase';
import { Logger } from '@/utils/logger';

// ── Proficiency rules (single source of truth) ──

/** Proficiency threshold: a student is "proficient" if accuracy >= 60% */
const PROFICIENCY_THRESHOLD = 60;

/** Faixa boundaries based on % accuracy */
const FAIXA_BOUNDARIES = [
  { faixa: 'Insuficiente', min: 0, max: 30, cor: 'hsl(0 84% 60%)' },
  { faixa: 'Regular', min: 30, max: 50, cor: 'hsl(24 100% 57%)' },
  { faixa: 'Intermediário', min: 50, max: 60, cor: 'hsl(45 100% 51%)' },
  { faixa: 'Bom', min: 60, max: 80, cor: 'hsl(142 71% 45%)' },
  { faixa: 'Excelente', min: 80, max: 101, cor: 'hsl(214 76% 38%)' },
];

/** Conceito institucional based on % proficient students */
function getConceito(percentProficientes: number): { conceito: string; nota: number } {
  if (percentProficientes >= 90) return { conceito: 'Conceito 5', nota: 5 };
  if (percentProficientes >= 75) return { conceito: 'Conceito 4', nota: 4 };
  if (percentProficientes >= 60) return { conceito: 'Conceito 3', nota: 3 };
  if (percentProficientes >= 40) return { conceito: 'Conceito 2', nota: 2 };
  return { conceito: 'Conceito 1', nota: 1 };
}

/** Map a numeric concept (1..5) coming from TRI tables to label */
function conceitoFromNota(nota: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(nota)));
  return `Conceito ${clamped}`;
}

/** Estimate affected students heuristic (shared across modules) */
export function estimateAffectedStudents(totalStudents: number, gap: number): number {
  return Math.ceil(totalStudents * Math.min(gap / 50, 1) * 0.8);
}

/**
 * Sanção regulatória derivada EXCLUSIVAMENTE do % de alunos proficientes (pcp
 * de resultados_ies_tri), independentemente do conceito da IES.
 *
 *   pcp < 30           → Suspensão imediata de ingresso de novos estudantes
 *   30 ≤ pcp < 40      → Redução de 50% das vagas autorizadas do curso
 *   40 ≤ pcp < 50      → Redução de 25% das vagas autorizadas do curso
 *   50 ≤ pcp < 60      → Abertura de processo de supervisão para monitoramento
 *   pcp ≥ 60           → Sem sanção
 */
function getSancaoFromPcp(percentProficientes: number | null | undefined): string | null {
  if (percentProficientes === null || percentProficientes === undefined) return null;
  const p = percentProficientes;
  if (p < 30) return 'Suspensão imediata de ingresso de novos estudantes';
  if (p < 40) return 'Redução de 50% das vagas autorizadas do curso';
  if (p < 50) return 'Redução de 25% das vagas autorizadas do curso';
  if (p < 60) return 'Abertura de processo de supervisão para monitoramento';
  return null;
}


function getKpiStatus(value: number, thresholds: { good: number; warning: number }): 'good' | 'warning' | 'critical' {
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.warning) return 'warning';
  return 'critical';
}

// ── Mapper ──

export function mapInstitutionalRpcToViewModel(
  performance: RpcPerformanceResponse,
  evolution: RpcEvolutionEntry[],
  studentScores: RpcStudentScoresResponse,
  totalIesUsers?: number,
  triSnapshot?: InstitutionalTriSnapshot | null,
  triEvolution?: InstitutionalTriEvolutionEntry[],
  studentTriScores?: { student_id: string; score_proprio: number | null }[],
  activeBase: ActiveBase = { semestres: null, mode: 'general', label: 'IES inteira' },
  sixthYearFallback: boolean = false,
  hasTri: boolean = true,
): InstitutionalViewModel {
  const { overallStats } = performance;
  const totalStudents = overallStats.totalStudents || studentScores.students.length;

  const triScoreById = new Map<string, number | null>();
  (studentTriScores ?? []).forEach((row) => {
    if (row.student_id) triScoreById.set(row.student_id, row.score_proprio);
  });

  const baseSemestresSet = activeBase.semestres ? new Set(activeBase.semestres) : null;
  const inBase = (sem: number) => baseSemestresSet === null || baseSemestresSet.has(sem);

  // Map ALL students; usaremos `inBase` para filtrar quando necessário.
  const allStudents: StudentScore[] = studentScores.students.map((s) => ({
    studentId: s.student_id,
    nome: s.nome,
    semestre: s.semestre ?? 0,
    acertos: s.score_total,
    total: s.total_questions,
    percentual: s.total_questions > 0 ? Math.round((s.score_total / s.total_questions) * 1000) / 10 : 0,
    scoresByArea: s.scores_by_area ?? {},
    totalsByArea: s.totals_by_area ?? {},
    scoresByTema: s.scores_by_tema ?? {},
    totalsByTema: s.totals_by_tema ?? {},
    triScore: s.student_id ? triScoreById.get(s.student_id) ?? null : null,
  }));

  // Para visualizações reagentes (faixas, lista de abaixo), usamos apenas alunos da base.
  const students = allStudents.filter((s) => inBase(s.semestre));

  // Classify students into faixas
  const faixaCounts: Record<string, number> = {};
  FAIXA_BOUNDARIES.forEach((f) => { faixaCounts[f.faixa] = 0; });

  students.forEach((s) => {
    const pct = s.percentual;
    const boundary = FAIXA_BOUNDARIES.find((f) => pct >= f.min && pct < f.max);
    if (boundary) faixaCounts[boundary.faixa]++;
  });

  const normalizePct = (raw: number | null | undefined): number | null => {
    if (raw === null || raw === undefined) return null;
    return Math.floor(raw <= 1 ? raw * 100 : raw);
  };

  // ── TRI authoritative values (base ativa) ──
  const triPercentProficientes = normalizePct(triSnapshot?.pcp);
  const triMeanScore = triSnapshot?.mean_score ?? null;
  const triMeanScoreRounded = triMeanScore !== null ? Math.round(triMeanScore) : null;
  const triNumStudents = triSnapshot?.num_students ?? null;
  const triNumProficient = triSnapshot?.num_proficient ?? null;
  const triNumBelow = triSnapshot?.num_below_expected ?? null;
  const conceptGeneralNota = triSnapshot?.concept ?? null;

  const basePctForConcept = triPercentProficientes;

  // Conceito: em modo geral (ou fallback) usa `concept` numérico; demais derivam do pcp.
  const useGeneralConceptColumn = activeBase.mode === 'general' || sixthYearFallback;
  let conceito: string | null;
  let notaAtual: number | null;
  if (useGeneralConceptColumn && conceptGeneralNota !== null) {
    notaAtual = conceptGeneralNota;
    conceito = conceitoFromNota(conceptGeneralNota);
  } else if (basePctForConcept !== null) {
    const info = getConceito(basePctForConcept);
    notaAtual = info.nota;
    conceito = info.conceito;
  } else {
    notaAtual = null;
    conceito = null;
  }

  const isSemestreScoped = activeBase.mode !== 'general';
  const percentProficientes = triPercentProficientes ?? 0;
  const proficiencyForKpi = triMeanScoreRounded;

  // Sanção e Distância derivam do pcp da base ativa
  const sancao = basePctForConcept !== null ? getSancaoFromPcp(basePctForConcept) : null;
  const conceitoScoped = conceito;
  const notaScoped = notaAtual;

  Logger.info('[TRI] Base ativa:', activeBase.mode, 'pcp:', basePctForConcept, 'sancao:', sancao, 'fallback6:', sixthYearFallback);

  const conceitoThresholds = [40, 60, 75, 90];
  const basePctForDist = basePctForConcept ?? 0;
  const nextConceitoTargetBase = conceitoThresholds.find((t) => basePctForDist < t) ?? 100;
  const distanciaPP = basePctForDist >= 90 ? 0 : Math.round(nextConceitoTargetBase - basePctForDist);

  // Meta
  const nextConceitoTarget = conceitoThresholds.find((t) => percentProficientes < t) ?? 100;
  const prevConceitoTarget = conceitoThresholds.filter((t) => percentProficientes >= t).pop() ?? 0;
  const baseProficientCount = triNumProficient;
  const baseTotalForMeta = triNumStudents;
  const alunosFaltamMeta = (baseProficientCount !== null && baseTotalForMeta !== null && baseTotalForMeta > 0)
    ? Math.max(0, Math.ceil((nextConceitoTarget / 100) * baseTotalForMeta) - baseProficientCount)
    : 0;

  // Alunos abaixo: estritos por TRI dentro da base.
  const alunosAbaixoStrict = students.filter(
    (s) => s.triScore !== null && s.triScore !== undefined && s.triScore < PROFICIENCY_THRESHOLD,
  );
  // Fallback por %acertos quando TRI não está disponível para nenhum aluno da base
  const hasAnyTri = students.some((s) => s.triScore !== null && s.triScore !== undefined);
  const alunosAbaixoByAccuracy = students.filter((s) => s.percentual < PROFICIENCY_THRESHOLD).length;
  const alunosAbaixoCount = triNumBelow !== null
    ? triNumBelow
    : (hasAnyTri ? alunosAbaixoStrict.length : alunosAbaixoByAccuracy);

  // Total de alunos da base — preferimos bySemester (participação real). TRI só se houver.
  let baseStudentsFromPerf = 0;
  (performance.bySemester ?? []).forEach((row) => {
    if (inBase(row.semestre)) baseStudentsFromPerf += row.num_students ?? 0;
  });
  const scopedTotalAlunos = hasTri && triNumStudents !== null
    ? triNumStudents
    : (baseStudentsFromPerf || students.length || overallStats.totalStudents);

  // % Acertos / Total — somar bySemester apenas dos semestres da base
  let baseAcertos = 0;
  let baseTotal = 0;
  (performance.bySemester ?? []).forEach((row) => {
    if (inBase(row.semestre)) {
      baseAcertos += row.acertos ?? 0;
      baseTotal += row.total ?? 0;
    }
  });
  if (baseTotal === 0) {
    // fallback: usa overall (ex.: bySemester sem dados)
    baseAcertos = overallStats.acertos;
    baseTotal = overallStats.total;
  }
  const percentualAcertos = baseTotal > 0
    ? Math.round((baseAcertos / baseTotal) * 1000) / 10
    : 0;

  // Adesão
  const realTotalIesUsers = totalIesUsers ?? 0;
  const taxaAdesao = realTotalIesUsers > 0
    ? Math.round((scopedTotalAlunos / realTotalIesUsers) * 1000) / 10
    : 0;
  const taxaAdesaoLabel = realTotalIesUsers > 0
    ? `${scopedTotalAlunos} de ${realTotalIesUsers} alunos`
    : 'Total de alunos da IES indisponível';

  const proficienciaDesc = 'Score TRI médio (0 a 100), calculado com Teoria de Resposta ao Item';

  const proficientesDescricao = (baseProficientCount !== null && baseTotalForMeta !== null)
    ? `${baseProficientCount} de ${baseTotalForMeta} alunos`
    : 'Dados TRI indisponíveis';

  const baseLabel = activeBase.label;
  const conceitoDescription = sixthYearFallback
    ? 'Sem alunos do 6º ano — exibindo base geral'
    : (notaAtual !== null ? `Nota ${notaAtual}` : 'Conceito TRI indisponível');

  const triPendingDesc = 'Aguardando cálculo do TRI';
  const kpis: KpiData[] = [
    { label: 'Total de Alunos', value: scopedTotalAlunos, icon: 'Users', status: 'neutral', description: 'Alunos do simulado', scope: 'scoped', baseLabel },
    { label: 'Percentual de Acertos', value: `${percentualAcertos}%`, icon: 'Target', status: getKpiStatus(percentualAcertos, { good: 60, warning: 40 }), description: `${baseAcertos} acertos de ${baseTotal} questões`, scope: 'scoped', baseLabel },
    { label: 'Proficiência Média (TRI)', value: hasTri && proficiencyForKpi !== null ? proficiencyForKpi : '—', icon: 'Target', status: hasTri && proficiencyForKpi !== null ? getKpiStatus(proficiencyForKpi, { good: 60, warning: 40 }) : 'neutral', description: hasTri ? proficienciaDesc : triPendingDesc, scope: 'scoped', baseLabel },
    { label: 'Alunos Proficientes', value: hasTri && triPercentProficientes !== null ? `${triPercentProficientes}%` : '—', icon: 'CheckCircle', status: hasTri && triPercentProficientes !== null ? getKpiStatus(triPercentProficientes, { good: 60, warning: 40 }) : 'neutral', description: hasTri ? proficientesDescricao : triPendingDesc, scope: 'scoped', baseLabel },
    { label: 'Nota Prevista da IES', value: hasTri ? (conceito ?? '—') : '—', icon: 'School', status: hasTri && notaAtual !== null ? getKpiStatus(notaAtual, { good: 4, warning: 3 }) : 'neutral', description: hasTri ? conceitoDescription : triPendingDesc, scope: 'scoped', baseLabel },
    { label: 'Distância Próxima Faixa', value: hasTri && basePctForConcept !== null ? (basePctForDist >= 90 ? '0 p.p.' : `${distanciaPP} p.p.`) : '—', icon: 'TrendingUp', status: hasTri ? (distanciaPP > 15 ? 'critical' : distanciaPP > 5 ? 'warning' : 'good') : 'neutral', description: hasTri ? 'Para próxima faixa' : triPendingDesc, scope: 'scoped', baseLabel },
    { label: 'Alunos Abaixo do Esperado', value: hasTri ? alunosAbaixoCount : '—', icon: 'AlertTriangle', status: hasTri ? getKpiStatus(100 - (alunosAbaixoCount / Math.max(baseTotalForMeta ?? scopedTotalAlunos, 1)) * 100, { good: 60, warning: 40 }) : 'neutral', description: hasTri ? (hasAnyTri || triNumBelow !== null ? `Abaixo de ${PROFICIENCY_THRESHOLD} pts (TRI)` : `Abaixo de ${PROFICIENCY_THRESHOLD}% de acerto (TRI indisponível)`) : triPendingDesc, scope: 'scoped', baseLabel },
    { label: 'Taxa de Adesão', value: realTotalIesUsers > 0 ? `${taxaAdesao}%` : '—', icon: 'CheckCircle', status: taxaAdesao >= 80 ? 'good' : taxaAdesao >= 50 ? 'warning' : 'neutral', description: taxaAdesaoLabel, scope: 'scoped', baseLabel },
  ];

  // ── Faixas ──
  const faixas: FaixaDistribuicao[] = FAIXA_BOUNDARIES.map((f) => ({
    faixa: f.faixa,
    quantidade: faixaCounts[f.faixa] || 0,
    cor: f.cor,
    percentual: totalStudents > 0 ? Math.round(((faixaCounts[f.faixa] || 0) / totalStudents) * 1000) / 10 : 0,
  }));

  // ── Meta ──
  const conceitoRange = nextConceitoTarget - prevConceitoTarget;
  const conceitoCovered = percentProficientes - prevConceitoTarget;
  const metaProgresso = conceitoRange > 0 ? Math.min(100, Math.round((conceitoCovered / conceitoRange) * 1000) / 10) : 100;

  const meta: MetaInstitucional = {
    proficienciaAtual: proficiencyForKpi ?? 0,
    meta: nextConceitoTarget,
    status: sancao ? 'Sanção ativa' : 'Regular',
    progresso: metaProgresso,
    gapProficiencia: distanciaPP,
    notaAtual: notaAtual ?? 0,
    notaMeta: 4,
    percentilMedio: proficiencyForKpi ?? 0,
    taxaAdesao,
    percentProficientes,
    totalIesUsers: realTotalIesUsers,
    totalStudentsSimulado: baseTotalForMeta ?? scopedTotalAlunos,
    sancaoRegulatoriaLabel: sancao ?? 'Nenhuma',
  };

  // ── Evolução ──
  let evolucao: EvolucaoSimulado[];
  if (triEvolution && triEvolution.length > 0) {
    evolucao = triEvolution.map((e) => {
      const proficiencia = e.mean_score !== null && e.mean_score !== undefined
        ? Math.round(e.mean_score * 10) / 10
        : 0;
      const pcpRaw = e.pcp ?? 0;
      const pct = Math.round((pcpRaw <= 1 ? pcpRaw * 100 : pcpRaw) * 10) / 10;
      const nota = e.concept !== null && e.concept !== undefined
        ? e.concept
        : getConceito(pct).nota;
      return {
        simulado: e.simulado_nome,
        proficiencia,
        nota,
        percentProficientes: pct,
      };
    });
  } else {
    const sortedEvolution = [...evolution].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    evolucao = sortedEvolution.map((e) => {
      const totalAll = e.areas.reduce((acc, a) => acc + a.total, 0);
      const acertosAll = e.areas.reduce((acc, a) => acc + a.acertos, 0);
      const accuracy = totalAll > 0 ? Math.round((acertosAll / totalAll) * 1000) / 10 : 0;
      const estimatedProficientes = Math.round(Math.max(0, Math.min(100, accuracy * 0.85 - 5)) * 10) / 10;
      return {
        simulado: e.simulado_nome,
        proficiencia: accuracy,
        nota: getConceito(accuracy).nota,
        percentProficientes: estimatedProficientes,
      };
    });
    if (evolucao.length > 0) {
      evolucao[evolucao.length - 1].percentProficientes = percentProficientes;
    }
  }

  // ── Distância para próxima faixa (cards por aluno) ──
  const distanciaBuckets = { proximos: 0, moderada: 0, critico: 0 };
  alunosAbaixoStrict.forEach((s) => {
    const dist = Math.round(PROFICIENCY_THRESHOLD - (s.triScore as number));
    if (dist <= 10) distanciaBuckets.proximos++;
    else if (dist <= 20) distanciaBuckets.moderada++;
    else distanciaBuckets.critico++;
  });
  const distanciaFaixa: DistanciaFaixa[] = [
    {
      label: 'Próximos de avançar (até 10pts)',
      value: `${distanciaBuckets.proximos} alunos`,
      status: 'good' as const,
      description: `A menos de 10pts da proficiência (${PROFICIENCY_THRESHOLD}pts)`,
    },
    {
      label: 'Distância moderada (10-20pts)',
      value: `${distanciaBuckets.moderada} alunos`,
      status: 'neutral' as const,
      description: 'Entre 10pts e 20pts da proficiência',
    },
    {
      label: 'Muito abaixo (>20pts)',
      value: `${distanciaBuckets.critico} alunos`,
      status: 'critical' as const,
      description: 'Mais de 20pts da proficiência',
    },
  ];

  // ── Header summary ──
  const headerSummary: HeaderSummary = {
    totalAlunos: scopedTotalAlunos,
    percentProficientes: hasTri ? percentProficientes : 0,
    alunosFaltamMeta: hasTri ? alunosFaltamMeta : 0,
    sancao: hasTri ? sancao : null,
    conceitoScoped: hasTri ? conceitoScoped : null,
    notaScoped: hasTri ? notaScoped : null,
    isSemestreScoped,
    semestresAtivos: activeBase.semestres ?? [],
    conceitoMode: activeBase.mode,
    sixthYearFallback: hasTri ? sixthYearFallback : false,
    basePctProficientes: hasTri ? basePctForConcept : null,
    baseLabel: activeBase.label,
    triPending: !hasTri,
  };


  // Alunos abaixo do esperado: classificação EXCLUSIVA por score TRI
  // (resultados_alunos_tri.score_proprio < 60). Alunos sem TRI não entram.
  const alunosAbaixoSorted = [...alunosAbaixoStrict].sort((a, b) => {
    const sa = a.triScore as number;
    const sb = b.triScore as number;
    return sb - sa;
  });

  // ── Curricular breakdown (area → specialty → tema) ──
  const temaNodes: CurricularTemaNode[] = (performance.bySubspecialty ?? []).map((t) => ({
    name: t.name,
    total: t.total,
    acertos: t.acertos,
    percentual: t.total > 0 ? Math.round((t.acertos / t.total) * 1000) / 10 : 0,
    areaName: t.area_name,
    specialtyName: t.specialty_name,
  }));

  const specialtyNodes: CurricularSpecialtyNode[] = (performance.bySpecialty ?? []).map((sp) => ({
    name: sp.name,
    total: sp.total,
    acertos: sp.acertos,
    percentual: sp.total > 0 ? Math.round((sp.acertos / sp.total) * 1000) / 10 : 0,
    areaName: sp.area_name,
    temas: temaNodes.filter((t) => t.specialtyName === sp.name && t.areaName === sp.area_name),
  }));

  const areaNodes: CurricularAreaNode[] = (performance.byArea ?? []).map((a) => ({
    name: a.name,
    total: a.total,
    acertos: a.acertos,
    percentual: a.total > 0 ? Math.round((a.acertos / a.total) * 1000) / 10 : 0,
    specialties: specialtyNodes.filter((sp) => sp.areaName === a.name),
  }));

  const curricular: CurricularBreakdown = { areas: areaNodes };

  Logger.info('[DesempenhoV2:Mapper]', 'Mapped:', {
    totalStudents,
    percentualAcertos,
    percentProficientes,
    conceito,
    faixas: faixaCounts,
    curricularAreas: areaNodes.length,
  });

  Logger.info('[Impact Model] audit completed');
  Logger.info('[Impact Model] formulas documented');
  Logger.info('[Impact Model] changes applied:', true);

  return {
    kpis,
    faixas,
    meta,
    evolucao,
    distanciaFaixa,
    alunosAbaixo: alunosAbaixoSorted,
    allStudents: [...students].sort((a, b) => b.percentual - a.percentual),
    headerSummary,
    curricular,
  };
}
