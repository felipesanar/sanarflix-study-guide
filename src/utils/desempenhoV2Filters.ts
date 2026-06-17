import type {
  CurricularAreaNode,
  CurricularSpecialtyNode,
  DesempenhoV2Filters,
  InstitutionalViewModel,
  StudentScore,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;


function computePercentual(acertos: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((acertos / total) * 1000) / 10;
}

function applyCurricularFilters(
  areas: CurricularAreaNode[],
  filters: DesempenhoV2Filters,
): CurricularAreaNode[] {
  const areaSet = new Set(filters.areas);
  const specialtySet = new Set(filters.especialidades);
  const temaSet = new Set(filters.temas);

  return areas
    .filter((area) => areaSet.size === 0 || areaSet.has(area.name))
    .map((area) => {
      const specialties = area.specialties
        .filter((sp) => specialtySet.size === 0 || specialtySet.has(sp.name))
        .map((sp) => {
          const temas = sp.temas.filter((tema) => temaSet.size === 0 || temaSet.has(tema.name));
          const useTemaAggregation = temaSet.size > 0;

          if (useTemaAggregation) {
            const total = temas.reduce((sum, tema) => sum + tema.total, 0);
            const acertos = temas.reduce((sum, tema) => sum + tema.acertos, 0);
            return {
              ...sp,
              temas,
              total,
              acertos,
              percentual: computePercentual(acertos, total),
            } satisfies CurricularSpecialtyNode;
          }

          return {
            ...sp,
            temas,
          } satisfies CurricularSpecialtyNode;
        })
        .filter((sp) => sp.temas.length > 0 || temaSet.size === 0);

      const useSpecialtyAggregation = specialtySet.size > 0 || temaSet.size > 0;
      if (useSpecialtyAggregation) {
        const total = specialties.reduce((sum, sp) => sum + sp.total, 0);
        const acertos = specialties.reduce((sum, sp) => sum + sp.acertos, 0);
        return {
          ...area,
          specialties,
          total,
          acertos,
          percentual: computePercentual(acertos, total),
        } satisfies CurricularAreaNode;
      }

      return {
        ...area,
        specialties,
      } satisfies CurricularAreaNode;
    })
    .filter((area) => area.specialties.length > 0 || (specialtySet.size === 0 && temaSet.size === 0));
}

function applyStudentFilters(
  students: StudentScore[],
  filters: DesempenhoV2Filters,
): StudentScore[] {
  const semestresSet = new Set(filters.semestres.map((value) => Number(value)));
  const areaSet = new Set(filters.areas);

  return students.filter((student) => {
    if (semestresSet.size > 0 && !semestresSet.has(student.semestre)) {
      return false;
    }

    if (areaSet.size > 0) {
      const hasAnyAreaScore = Array.from(areaSet).some((area) => student.scoresByArea[area] !== undefined);
      if (!hasAnyAreaScore) return false;
    }

    return true;
  });
}

function computeFaixas(students: StudentScore[]) {
  const total = students.length;
  const boundaries = [
    { faixa: 'Insuficiente', min: 0, max: 30, cor: 'hsl(0 84% 60%)' },
    { faixa: 'Regular', min: 30, max: 50, cor: 'hsl(24 100% 57%)' },
    { faixa: 'Intermediário', min: 50, max: 60, cor: 'hsl(45 100% 51%)' },
    { faixa: 'Bom', min: 60, max: 80, cor: 'hsl(142 71% 45%)' },
    { faixa: 'Excelente', min: 80, max: 101, cor: 'hsl(214 76% 38%)' },
  ] as const;

  return boundaries.map((boundary) => {
    const quantidade = students.filter(
      (student) => student.percentual >= boundary.min && student.percentual < boundary.max,
    ).length;

    return {
      faixa: boundary.faixa,
      quantidade,
      cor: boundary.cor,
      percentual: total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
    };
  });
}

function computeDistanciaFaixa(students: StudentScore[]) {
  // Classificação EXCLUSIVA por score TRI (resultados_alunos_tri.score_proprio).
  // Distância = 60 - score_proprio. Alunos sem TRI são ignorados.
  const abaixo = students.filter(
    (student) => student.triScore !== null && student.triScore !== undefined && (student.triScore as number) < PROFICIENCY_THRESHOLD,
  );
  let proximos = 0;
  let moderados = 0;
  let criticos = 0;
  abaixo.forEach((student) => {
    const dist = Math.round(PROFICIENCY_THRESHOLD - (student.triScore as number));
    if (dist <= 10) proximos++;
    else if (dist <= 20) moderados++;
    else criticos++;
  });

  return [
    {
      label: 'Próximos de avançar (até 10pts)',
      value: `${proximos} alunos`,
      status: 'good' as const,
      description: `A menos de 10pts da proficiência (${PROFICIENCY_THRESHOLD}pts)`,
    },
    {
      label: 'Distância moderada (10-20pts)',
      value: `${moderados} alunos`,
      status: 'neutral' as const,
      description: 'Entre 10pts e 20pts da proficiência',
    },
    {
      label: 'Muito abaixo (>20pts)',
      value: `${criticos} alunos`,
      status: 'critical' as const,
      description: 'Mais de 20pts da proficiência',
    },
  ];
}


function updateKpis(base: InstitutionalViewModel, students: StudentScore[], preserveScopedTotals: boolean) {
  // Percentual de acertos from filtered students
  const totalQuestoes = students.reduce((sum, s) => sum + s.total, 0);
  const totalAcertos = students.reduce((sum, s) => sum + s.acertos, 0);
  const percentualAcertos = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 1000) / 10 : 0;

  return base.kpis.map((kpi) => {
    // Quando o recorte de semestre já foi aplicado na RPC TRI, NÃO sobrescreve
    // Total de Alunos / Percentual de Acertos a partir da lista local (que pode
    // não conter todos os alunos do recorte, e.g. quando há alunos sem respostas).
    if (kpi.label === 'Total de Alunos') {
      if (preserveScopedTotals) return kpi;
      return { ...kpi, value: students.length, description: 'Alunos no recorte aplicado' };
    }
    if (kpi.label === 'Percentual de Acertos') {
      if (preserveScopedTotals) return kpi;
      return { ...kpi, value: `${percentualAcertos}%`, description: `${totalAcertos} acertos de ${totalQuestoes} questões aplicadas` };
    }
    return kpi;
  });
}

export function applyDesempenhoV2Filters(
  data: InstitutionalViewModel | null,
  filters: DesempenhoV2Filters,
): InstitutionalViewModel | null {
  if (!data) return null;

  const filteredAllStudents = applyStudentFilters(data.allStudents, filters);
  const filteredAbaixo = filteredAllStudents.filter(
    (s) => s.triScore !== null && s.triScore !== undefined && s.triScore < PROFICIENCY_THRESHOLD,
  );
  const filteredCurricular = applyCurricularFilters(data.curricular.areas, filters);
  const filteredFaixas = computeFaixas(filteredAllStudents);
  const filteredDistanciaFaixa = computeDistanciaFaixa(filteredAllStudents);

  // Quando exatamente 1 semestre está selecionado, o recorte já vem da RPC TRI
  // (autoritativo) — preservamos Total de Alunos / Percentual de Acertos.
  const preserveScopedTotals = filters.semestres.length === 1;
  const filteredKpis = updateKpis(data, filteredAllStudents, preserveScopedTotals);

  const filteredHeader = preserveScopedTotals
    ? data.headerSummary
    : { ...data.headerSummary, totalAlunos: filteredAllStudents.length };

  const meta = { ...data.meta };

  return {
    ...data,
    alunosAbaixo: filteredAbaixo,
    allStudents: filteredAllStudents,
    curricular: { areas: filteredCurricular },
    headerSummary: filteredHeader,
    faixas: filteredFaixas,
    distanciaFaixa: filteredDistanciaFaixa,
    kpis: filteredKpis,
    meta,
  };
}

export function hasActiveSecondaryFilters(filters: DesempenhoV2Filters): boolean {
  return (
    filters.areas.length > 0 ||
    filters.especialidades.length > 0 ||
    filters.temas.length > 0 ||
    filters.semestres.length > 0 ||
    filters.turmas.length > 0 ||
    Boolean(filters.periodo)
  );
}

export function hasNoResultData(data: InstitutionalViewModel | null): boolean {
  if (!data) return false;
  return data.allStudents.length === 0 && data.curricular.areas.length === 0;
}
