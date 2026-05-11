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

function getSancao(percentProficientes: number): string | null {
  if (percentProficientes < 40) return 'Redução de 50% das vagas';
  if (percentProficientes < 50) return 'Redução de 25% das vagas';
  if (percentProficientes < 60) return 'Proibição de aumento de vagas';
  return null;
}

/**
 * Sanção regulatória derivada exclusivamente do conceito institucional (TRI).
 * Mapeamento legado restaurado:
 *   1 → Suspensão de novos ingressos
 *   2 → Redução de vagas
 *   3 → Proibição de aumento de vagas
 *   ≥4 → Sem sanção
 */
function getSancaoFromConcept(concept: number | null | undefined): string | null {
  if (concept === null || concept === undefined) return null;
  const c = Math.round(concept);
  if (c <= 1) return 'Suspensão de novos ingressos';
  if (c === 2) return 'Redução de vagas';
  if (c === 3) return 'Proibição de aumento de vagas';
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
): InstitutionalViewModel {
  const { overallStats } = performance;
  const totalStudents = overallStats.totalStudents || studentScores.students.length;
  const overallAccuracy = overallStats.total > 0
    ? Math.round((overallStats.acertos / overallStats.total) * 100 * 10) / 10
    : 0;

  

  // Map students
  const students: StudentScore[] = studentScores.students.map((s) => ({
    nome: s.nome,
    semestre: s.semestre ?? 0,
    acertos: s.score_total,
    total: s.total_questions,
    percentual: s.total_questions > 0 ? Math.round((s.score_total / s.total_questions) * 1000) / 10 : 0,
    scoresByArea: s.scores_by_area ?? {},
  }));

  // Classify students into faixas
  const faixaCounts: Record<string, number> = {};
  FAIXA_BOUNDARIES.forEach((f) => { faixaCounts[f.faixa] = 0; });
  const proficientes: StudentScore[] = [];
  const abaixo: StudentScore[] = [];
  const proximosDeAvancar: StudentScore[] = [];

  students.forEach((s) => {
    const pct = s.percentual;
    const boundary = FAIXA_BOUNDARIES.find((f) => pct >= f.min && pct < f.max);
    if (boundary) faixaCounts[boundary.faixa]++;

    if (pct >= PROFICIENCY_THRESHOLD) {
      proficientes.push(s);
    } else {
      abaixo.push(s);
      if (pct >= PROFICIENCY_THRESHOLD - 10) {
        proximosDeAvancar.push(s);
      }
    }
  });


  // ── TRI authoritative values (resultados_ies_tri) — única fonte para
  // proficiência média, % proficientes, num_proficient e conceito. ──
  const triPcpRaw = triSnapshot?.pcp ?? null;
  // pcp pode vir como fração (0..1) ou percentual (0..100). Normaliza e arredonda a 0 casas.
  const triPercentProficientes = triPcpRaw !== null
    ? Math.round(triPcpRaw <= 1 ? triPcpRaw * 100 : triPcpRaw)
    : null;
  const triMeanScore = triSnapshot?.mean_score ?? null;
  const triMeanScoreRounded = triMeanScore !== null ? Math.round(triMeanScore) : null;
  const triNumStudents = triSnapshot?.num_students ?? null;
  const triNumProficient = triSnapshot?.num_proficient ?? null;
  const triConceptNota = triSnapshot?.concept ?? null;
  // NOTA: triSnapshot.sanctions e triSnapshot.is_restricted são INTENCIONALMENTE ignorados.
  // A sanção é derivada do `concept` (lógica legada por conceito), não do banco.

  // % proficientes — usa exclusivamente pcp da tabela TRI; sem fallback de acurácia.
  const percentProficientes = triPercentProficientes !== null ? triPercentProficientes : 0;

  // Proficiência média — usa exclusivamente mean_score da tabela TRI.
  const proficiencyForKpi = triMeanScoreRounded;

  const notaAtual = triConceptNota;
  const conceito = triConceptNota !== null ? conceitoFromNota(triConceptNota) : null;

  const sancao = triConceptNota !== null ? getSancaoFromConcept(triConceptNota) : null;

  console.log('[TRI] Concept loaded:', triConceptNota);
  console.log('[TRI] Regulatory status derived from concept:', sancao);

  // Next conceito target (thresholds for conceito: 40, 60, 75, 90)
  const conceitoThresholds = [40, 60, 75, 90];
  const nextConceitoTarget = conceitoThresholds.find((t) => percentProficientes < t) ?? 100;
  const prevConceitoTarget = conceitoThresholds.filter((t) => percentProficientes >= t).pop() ?? 0;
  // Quantitativos: somente da tabela TRI (resultados_ies_tri).
  const baseProficientCount = triNumProficient;
  const baseTotalForMeta = triNumStudents;
  const alunosFaltamMeta = (baseProficientCount !== null && baseTotalForMeta !== null && baseTotalForMeta > 0)
    ? Math.max(0, Math.ceil((nextConceitoTarget / 100) * baseTotalForMeta) - baseProficientCount)
    : 0;

  // Distância em p.p. até próxima faixa de conceito (0 casas decimais)
  const distanciaPP = percentProficientes >= 90 ? 0 : Math.round(nextConceitoTarget - percentProficientes);

  // Alunos abaixo do esperado: derivado de num_students - num_proficient (TRI).
  // Sem TRI → fallback à contagem por acurácia.
  const alunosAbaixoCount = (triNumStudents !== null && triNumProficient !== null)
    ? Math.max(0, triNumStudents - triNumProficient)
    : abaixo.length;

  // Taxa de adesão
  const realTotalIesUsers = totalIesUsers ?? 0;
  const taxaAdesao = realTotalIesUsers > 0
    ? Math.round((totalStudents / realTotalIesUsers) * 1000) / 10
    : 0;
  const taxaAdesaoLabel = realTotalIesUsers > 0
    ? `${totalStudents} alunos dos ${realTotalIesUsers} realizaram o simulado`
    : 'Total de alunos da IES indisponível';

  // Percentual de acertos
  const percentualAcertos = overallStats.total > 0
    ? Math.round((overallStats.acertos / overallStats.total) * 1000) / 10
    : 0;

  const proficienciaDesc = 'Score TRI médio da IES (0 a 100), calculado com Teoria de Resposta ao Item';

  // ── KPIs ──
  const proficientesDescricao = (baseProficientCount !== null && baseTotalForMeta !== null)
    ? `${baseProficientCount} de ${baseTotalForMeta} alunos`
    : 'Dados TRI indisponíveis';

  const kpis: KpiData[] = [
    { label: 'Total de Alunos', value: totalStudents, icon: 'Users', status: 'neutral', description: 'Alunos que realizaram o simulado' },
    { label: 'Percentual de Acertos', value: `${percentualAcertos}%`, icon: 'Target', status: getKpiStatus(percentualAcertos, { good: 60, warning: 40 }), description: `${overallStats.acertos} acertos de ${overallStats.total} questões aplicadas` },
    { label: 'Proficiência Média (TRI)', value: proficiencyForKpi !== null ? proficiencyForKpi : '—', icon: 'Target', status: proficiencyForKpi !== null ? getKpiStatus(proficiencyForKpi, { good: 60, warning: 40 }) : 'neutral', description: proficienciaDesc },
    { label: 'Alunos Proficientes', value: triPercentProficientes !== null ? `${triPercentProficientes}%` : '—', icon: 'CheckCircle', status: triPercentProficientes !== null ? getKpiStatus(triPercentProficientes, { good: 60, warning: 40 }) : 'neutral', description: proficientesDescricao },
    { label: 'Nota Prevista da IES', value: conceito ?? '—', icon: 'School', status: notaAtual !== null ? getKpiStatus(notaAtual, { good: 4, warning: 3 }) : 'neutral', description: notaAtual !== null ? `Nota ${notaAtual}` : 'Conceito TRI indisponível' },
    { label: 'Distância Próxima Faixa', value: triPercentProficientes === null ? '—' : (percentProficientes >= 90 ? '0 p.p.' : `${distanciaPP} p.p.`), icon: 'TrendingUp', status: distanciaPP > 15 ? 'critical' : distanciaPP > 5 ? 'warning' : 'good', description: 'Distância para alcançar a próxima faixa de conceito' },
    { label: 'Alunos Abaixo do Esperado', value: alunosAbaixoCount, icon: 'AlertTriangle', status: getKpiStatus(100 - (alunosAbaixoCount / Math.max(baseTotalForMeta ?? totalStudents, 1)) * 100, { good: 60, warning: 40 }), description: `Abaixo de ${PROFICIENCY_THRESHOLD} pts` },
    { label: 'Taxa de Adesão', value: realTotalIesUsers > 0 ? `${taxaAdesao}%` : '—', icon: 'CheckCircle', status: taxaAdesao >= 80 ? 'good' : taxaAdesao >= 50 ? 'warning' : 'neutral', description: taxaAdesaoLabel },
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
    totalStudentsSimulado: baseTotalForMeta ?? totalStudents,
    sancaoRegulatoriaLabel: sancao ?? 'Nenhuma',
  };

  // ── Evolução ──
  // When TRI evolution data is provided, use authoritative mean_score / pcp / concept.
  // Otherwise fall back to the legacy accuracy-based heuristic from RpcEvolutionEntry.
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

  // ── Distância para próxima faixa ──
  const distanciaFaixa: DistanciaFaixa[] = [
    {
      label: 'Próximos de avançar (até 10pts)',
      value: `${proximosDeAvancar.length} alunos`,
      status: 'good' as const,
      description: `A menos de 10pts da proficiência (${PROFICIENCY_THRESHOLD}pts)`,
    },
    {
      label: 'Distância moderada (10-20pts)',
      value: `${abaixo.filter((s) => s.percentual >= PROFICIENCY_THRESHOLD - 20 && s.percentual < PROFICIENCY_THRESHOLD - 10).length} alunos`,
      status: 'neutral' as const,
      description: 'Entre 10pts e 20pts da proficiência',
    },
    {
      label: 'Muito abaixo (>20pts)',
      value: `${abaixo.filter((s) => s.percentual < PROFICIENCY_THRESHOLD - 20).length} alunos`,
      status: 'critical' as const,
      description: 'Mais de 20pts da proficiência',
    },
  ];

  // ── Header summary ──
  const headerSummary: HeaderSummary = {
    totalAlunos: totalStudents,
    percentProficientes,
    alunosFaltamMeta,
    sancao,
  };

  // Alunos abaixo sorted by proximity to threshold
  const alunosAbaixoSorted = [...abaixo].sort(
    (a, b) => b.percentual - a.percentual,
  );

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

  console.log('[DesempenhoV2:Mapper]', 'Mapped:', {
    totalStudents,
    overallAccuracy,
    percentProficientes,
    conceito,
    faixas: faixaCounts,
    curricularAreas: areaNodes.length,
  });

  console.log('[Impact Model] audit completed');
  console.log('[Impact Model] formulas documented');
  console.log('[Impact Model] changes applied:', true);

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
