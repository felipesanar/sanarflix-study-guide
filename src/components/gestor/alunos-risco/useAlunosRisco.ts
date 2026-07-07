import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentEngagement, type StudentEngagementEntry } from '@/services/gestor/engagement';
import { fetchStudentGrowthTri, type StudentGrowthEntry } from '@/services/institutional';
import type { StudentScore } from '@/types/desempenhoV2';

/** Limiar TRI de proficiência usado nas telas do console de Gestão. */
export const TRI_PROFICIENCY_THRESHOLD = 500;
/** Abaixo deste % de acerto num simulado sem TRI, o aluno é "risco crítico". */
export const RISCO_CRITICO_PCT = 45;

export type SegmentoAluno = 'proficiente' | 'proximo' | 'abaixo' | 'critico';

export type GapSeverity = 'critico' | 'atencao' | 'ok';

export interface AlunoRiscoRow {
  key: string;
  nome: string;
  semestre: number;
  /** Score de referência: TRI quando disponível, senão % de acerto do simulado. */
  score: number;
  hasTri: boolean;
  gap: number;
  /**
   * Severidade do gap, normalizada pela escala de referência (TRI: até 500 /
   * percentual: até 60%) — assim o limiar ">60 red / >30 amber" do TRI se
   * traduz proporcionalmente para alunos sem TRI, em vez de comparar valores
   * absolutos de escalas diferentes.
   */
  gapSeverity: GapSeverity;
  segmento: SegmentoAluno;
  horasPeriodo: number | null;
  sessionsCount: number | null;
}

/** Limiares de severidade do gap, expressos como fração da escala de referência (60/500 e 30/500). */
const GAP_SEVERITY_CRITICO_RATIO = 60 / TRI_PROFICIENCY_THRESHOLD;
const GAP_SEVERITY_ATENCAO_RATIO = 30 / TRI_PROFICIENCY_THRESHOLD;

function severityFromGapRatio(ratio: number): GapSeverity {
  if (ratio > GAP_SEVERITY_CRITICO_RATIO) return 'critico';
  if (ratio > GAP_SEVERITY_ATENCAO_RATIO) return 'atencao';
  return 'ok';
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Deriva o segmento de risco a partir do score (TRI ou %) do aluno. */
function segmentoFromScore(score: number, hasTri: boolean): SegmentoAluno {
  if (hasTri) {
    if (score >= TRI_PROFICIENCY_THRESHOLD) return 'proficiente';
    if (score >= TRI_PROFICIENCY_THRESHOLD - 50) return 'proximo';
    if (score < RISCO_CRITICO_PCT / 100 * TRI_PROFICIENCY_THRESHOLD) return 'critico';
    return 'abaixo';
  }
  if (score >= 60) return 'proficiente';
  if (score >= 50) return 'proximo';
  if (score < RISCO_CRITICO_PCT) return 'critico';
  return 'abaixo';
}

/** Junta `allStudents` (TRI/score) com engajamento (horas/sessões) por nome normalizado. */
function buildRows(
  students: StudentScore[],
  engagement: StudentEngagementEntry[],
): AlunoRiscoRow[] {
  const engagementByName = new Map<string, StudentEngagementEntry>();
  engagement.forEach((e) => engagementByName.set(normalize(e.nome), e));

  return students.map((s, i) => {
    const hasTri = s.triScore !== null && s.triScore !== undefined;
    const score = hasTri ? (s.triScore as number) : s.percentual;
    const segmento = segmentoFromScore(score, hasTri);
    const eng = s.studentId
      ? engagement.find((e) => e.user_id === s.studentId)
      : engagementByName.get(normalize(s.nome));
    const referenceMax = hasTri ? TRI_PROFICIENCY_THRESHOLD : 60;
    const gap = Math.max(0, referenceMax - score);
    const gapSeverity = severityFromGapRatio(gap / referenceMax);

    return {
      key: s.studentId ?? `${s.nome}-${s.semestre}-${i}`,
      nome: s.nome,
      semestre: s.semestre,
      score,
      hasTri,
      gap,
      gapSeverity,
      segmento,
      horasPeriodo: eng?.horas_periodo ?? null,
      sessionsCount: eng?.sessions_count ?? null,
    };
  });
}

/** Ponto do scatter engajamento × proficiência — só alunos com TRI e horas conhecidas. */
export interface EngagementScatterPoint {
  nome: string;
  horas: number;
  tri: number;
}

interface UseAlunosRiscoArgs {
  allStudents: StudentScore[];
  iesId?: string;
}

interface UseAlunosRiscoResult {
  rows: AlunoRiscoRow[];
  segmentCounts: Record<SegmentoAluno, number>;
  scatterData: EngagementScatterPoint[];
  engagementLoading: boolean;
  engagementError: boolean;
  hasEngagementData: boolean;
  casoDeVirada: StudentGrowthEntry | null;
  growthLoading: boolean;
  /** Entradas de crescimento TRI indexadas por `student_id`, para lookup O(1) no detalhe de um aluno. */
  growthByStudentId: Map<string, StudentGrowthEntry>;
}

/**
 * Hook central da tela Alunos & Risco: junta `allStudents` (TRI/score) com
 * engajamento (`get_institutional_student_engagement`) e crescimento
 * (`get_student_growth_tri`) via React Query. Nunca inventa dado — quando uma
 * RPC acessória falha ou vem vazia, os campos relacionados ficam `null`/vazios
 * e a UI degrada para estado vazio.
 */
export function useAlunosRisco({ allStudents, iesId }: UseAlunosRiscoArgs): UseAlunosRiscoResult {
  const engagementQuery = useQuery({
    queryKey: ['gestor', 'student-engagement', iesId ?? null],
    queryFn: () => fetchStudentEngagement(iesId, 90),
    staleTime: 5 * 60_000,
  });

  const growthQuery = useQuery({
    queryKey: ['gestor', 'student-growth-tri', iesId ?? null],
    queryFn: () => fetchStudentGrowthTri(iesId ?? ''),
    enabled: !!iesId,
    staleTime: 5 * 60_000,
  });

  const engagement = engagementQuery.data ?? [];

  const rows = useMemo(
    () => buildRows(allStudents, engagement),
    [allStudents, engagement],
  );

  const segmentCounts = useMemo<Record<SegmentoAluno, number>>(() => {
    const counts: Record<SegmentoAluno, number> = { proficiente: 0, proximo: 0, abaixo: 0, critico: 0 };
    rows.forEach((r) => { counts[r.segmento]++; });
    return counts;
  }, [rows]);

  const scatterData = useMemo<EngagementScatterPoint[]>(() => {
    return rows
      .filter((r) => r.hasTri && r.horasPeriodo !== null)
      .map((r) => ({ nome: r.nome, horas: r.horasPeriodo as number, tri: r.score }));
  }, [rows]);

  const casoDeVirada = useMemo<StudentGrowthEntry | null>(() => {
    const growth = growthQuery.data ?? [];
    const candidates = growth.filter(
      (g) => g.delta_score_enamed !== null && g.delta_score_enamed !== undefined && g.delta_score_enamed > 0,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, cur) =>
      (cur.delta_score_enamed as number) > (best.delta_score_enamed as number) ? cur : best,
    );
  }, [growthQuery.data]);

  const growthByStudentId = useMemo<Map<string, StudentGrowthEntry>>(() => {
    const map = new Map<string, StudentGrowthEntry>();
    (growthQuery.data ?? []).forEach((g) => map.set(g.student_id, g));
    return map;
  }, [growthQuery.data]);

  return {
    rows,
    segmentCounts,
    scatterData,
    engagementLoading: engagementQuery.isLoading,
    engagementError: engagementQuery.isError,
    hasEngagementData: engagement.length > 0,
    casoDeVirada,
    growthLoading: growthQuery.isLoading,
    growthByStudentId,
  };
}
