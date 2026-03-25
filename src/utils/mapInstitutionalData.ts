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

function getSancao(percentProficientes: number): string | null {
  if (percentProficientes < 40) return 'Redução de 50% das vagas';
  if (percentProficientes < 50) return 'Redução de 25% das vagas';
  if (percentProficientes < 60) return 'Proibição de aumento de vagas';
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

  const percentProficientes = totalStudents > 0
    ? Math.round((proficientes.length / totalStudents) * 1000) / 10
    : 0;

  const { conceito, nota: notaAtual } = getConceito(percentProficientes);
  const sancao = getSancao(percentProficientes);

  // Next conceito target
  const conceitoTargets = [40, 50, 60, 75, 90];
  const nextTarget = conceitoTargets.find((t) => percentProficientes < t) ?? 90;
  const alunosFaltamMeta = Math.max(0, Math.ceil((nextTarget / 100) * totalStudents) - proficientes.length);

  // Distância média para proficiência entre alunos abaixo
  const distanciaMedia = abaixo.length > 0
    ? Math.round(abaixo.reduce((acc, s) => acc + (PROFICIENCY_THRESHOLD - s.percentual), 0) / abaixo.length)
    : 0;

  // ── KPIs ──
  const kpis: KpiData[] = [
    { label: 'Total de Alunos', value: totalStudents, icon: 'Users', status: 'neutral', description: 'Alunos que realizaram o simulado' },
    { label: 'Proficiência Média (TRI)', value: Math.round(overallAccuracy), icon: 'Target', status: getKpiStatus(overallAccuracy, { good: 60, warning: 40 }), description: 'Valor de 0 a 100' },
    { label: 'Alunos Proficientes', value: `${percentProficientes}%`, icon: 'CheckCircle', status: getKpiStatus(percentProficientes, { good: 60, warning: 40 }), description: `${proficientes.length} de ${totalStudents} alunos` },
    { label: 'Nota Prevista da IES', value: conceito, icon: 'School', status: getKpiStatus(notaAtual, { good: 4, warning: 3 }), description: `Nota ${notaAtual}` },
    { label: 'Distância Próxima Faixa', value: `${distanciaMedia} pts`, icon: 'TrendingUp', status: distanciaMedia > 15 ? 'critical' : distanciaMedia > 5 ? 'warning' : 'good', description: 'Distância média dos alunos abaixo' },
    { label: 'Alunos Abaixo do Esperado', value: abaixo.length, icon: 'AlertTriangle', status: getKpiStatus(100 - (abaixo.length / Math.max(totalStudents, 1)) * 100, { good: 60, warning: 40 }), description: `Abaixo de ${PROFICIENCY_THRESHOLD}% de acerto` },
    { label: 'Taxa de Adesão', value: `${totalStudents > 0 ? '—' : '0'}`, icon: 'CheckCircle', status: 'neutral', description: 'Dados de adesão indisponíveis' },
  ];

  // ── Faixas ──
  const faixas: FaixaDistribuicao[] = FAIXA_BOUNDARIES.map((f) => ({
    faixa: f.faixa,
    quantidade: faixaCounts[f.faixa] || 0,
    cor: f.cor,
    percentual: totalStudents > 0 ? Math.round(((faixaCounts[f.faixa] || 0) / totalStudents) * 1000) / 10 : 0,
  }));

  // ── Meta ──
  const meta: MetaInstitucional = {
    proficienciaAtual: overallAccuracy,
    meta: PROFICIENCY_THRESHOLD,
    status: sancao ? 'Sanção ativa' : 'Regular',
    progresso: Math.min(100, Math.round((overallAccuracy / PROFICIENCY_THRESHOLD) * 100)),
    gapProficiencia: Math.max(0, Math.round((PROFICIENCY_THRESHOLD - overallAccuracy) * 10) / 10),
    notaAtual,
    notaMeta: 4,
    percentilMedio: Math.round(overallAccuracy),
    taxaAdesao: 0,
    percentProficientes,
  };

  // ── Evolução ──
  const evolucao: EvolucaoSimulado[] = evolution.map((e) => {
    const totalAll = e.areas.reduce((acc, a) => acc + a.total, 0);
    const acertosAll = e.areas.reduce((acc, a) => acc + a.acertos, 0);
    const accuracy = totalAll > 0 ? Math.round((acertosAll / totalAll) * 1000) / 10 : 0;
    return {
      simulado: e.simulado_nome,
      proficiencia: accuracy,
      nota: getConceito(accuracy).nota,
    };
  });

  // ── Distância para próxima faixa ──
  const distanciaFaixa: DistanciaFaixa[] = [
    {
      label: 'Próximos de avançar (até 10pp)',
      value: `${proximosDeAvancar.length} alunos`,
      status: 'good' as const,
      description: `A menos de 10pp da proficiência (${PROFICIENCY_THRESHOLD}%)`,
    },
    {
      label: 'Distância moderada (10-20pp)',
      value: `${abaixo.filter((s) => s.percentual >= PROFICIENCY_THRESHOLD - 20 && s.percentual < PROFICIENCY_THRESHOLD - 10).length} alunos`,
      status: 'neutral' as const,
      description: 'Entre 10pp e 20pp da proficiência',
    },
    {
      label: 'Muito abaixo (>20pp)',
      value: `${abaixo.filter((s) => s.percentual < PROFICIENCY_THRESHOLD - 20).length} alunos`,
      status: 'critical' as const,
      description: 'Mais de 20pp da proficiência',
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
