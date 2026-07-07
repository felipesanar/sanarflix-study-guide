import type { DesempenhoV2Filters, InstitutionalViewModel } from '@/types/desempenhoV2';

/** Tom semântico do insight — define a cor usada pela {@link CopilotoStrip}. */
export type CopilotoTone = 'critical' | 'opportunity' | 'positive' | 'info';

export interface CopilotoAction {
  /** Rótulo do botão de ação (ex.: "Simular impacto"). */
  label: string;
  /** Rota de destino, já com querystring de contexto (ex.: `/gestor/intervencao-impacto?tema=Cardiologia`). */
  to: string;
}

export interface CopilotoInsight {
  /** Identificador estável do insight — usado para "lembrar" dispensa em sessionStorage. */
  id: string;
  tone: CopilotoTone;
  /** Frase única, específica, com números reais do recorte atual. */
  text: string;
  /** Ação de navegação opcional (leva a outra tela do console com contexto). */
  action?: CopilotoAction;
  /** Pergunta pronta para abrir no drawer de conversa via "Perguntar". */
  question?: string;
}

const MAX_INSIGHTS_PER_SCREEN = 2;

// ── Helpers de leitura do ViewModel (mesma lógica das telas — não duplicar regras de negócio, só ler) ──

interface FlatTema {
  name: string;
  areaName: string;
  specialtyName: string;
  percentual: number;
  total: number;
}

function flattenTemas(data: InstitutionalViewModel): FlatTema[] {
  const out: FlatTema[] = [];
  for (const area of data.curricular.areas) {
    for (const sp of area.specialties) {
      for (const t of sp.temas) {
        out.push({ name: t.name, areaName: area.name, specialtyName: sp.name, percentual: t.percentual, total: t.total });
      }
    }
  }
  return out;
}

/** Pior tema do recorte por % de acerto, entre os que têm questões respondidas. */
function worstTema(data: InstitutionalViewModel): FlatTema | null {
  const temas = flattenTemas(data).filter((t) => t.total > 0);
  if (temas.length === 0) return null;
  return [...temas].sort((a, b) => a.percentual - b.percentual)[0];
}

/** Réplica leve da fórmula de impacto de `priorizacao.ts` (prevalência × (1 − acerto)) — só leitura, não decide UI. */
function worstImpactTema(data: InstitutionalViewModel): (FlatTema & { prevalencia: number; impacto: number }) | null {
  const totalQuestoes = data.curricular.areas.reduce((sum, a) => sum + a.total, 0) || 1;
  const temas = flattenTemas(data)
    .filter((t) => t.total > 0)
    .map((t) => {
      const prevalencia = (t.total / totalQuestoes) * 100;
      const impacto = prevalencia * (1 - t.percentual / 100);
      return { ...t, prevalencia, impacto };
    });
  if (temas.length === 0) return null;
  return [...temas].sort((a, b) => b.impacto - a.impacto)[0];
}

function round(n: number): number {
  return Math.round(n);
}

function withTemaQuery(to: string, tema: string): string {
  return `${to}?tema=${encodeURIComponent(tema)}`;
}

// ── Regras por tela ──

function insightsPanorama(data: InstitutionalViewModel): CopilotoInsight[] {
  const insights: CopilotoInsight[] = [];
  const { headerSummary, evolucao, meta } = data;

  if (headerSummary.sancao) {
    const pior = worstTema(data);
    insights.push({
      id: `panorama-sancao-${headerSummary.conceitoScoped ?? 'na'}`,
      tone: 'critical',
      text: pior
        ? `Conceito ${headerSummary.conceitoScoped ?? '—'} projetado com sanção — ${pior.name} é o maior ofensor (${round(pior.percentual)}% de acerto).`
        : `Conceito ${headerSummary.conceitoScoped ?? '—'} projetado com sanção — ${headerSummary.sancao}.`,
      action: pior
        ? { label: 'Simular impacto', to: withTemaQuery('/gestor/intervencao-impacto', pior.name) }
        : { label: 'Ver plano de ação', to: '/gestor/intervencao-impacto' },
      question: pior
        ? `Por que ${pior.name} está puxando o conceito para baixo e o que fazer primeiro?`
        : `Por que a IES está em risco de sanção e o que fazer primeiro?`,
    });
  }

  if (evolucao.length >= 2) {
    const atual = evolucao[evolucao.length - 1];
    const anterior = evolucao[evolucao.length - 2];
    const deltaProficientes = (atual.percentProficientes ?? 0) - (anterior.percentProficientes ?? 0);
    if (deltaProficientes < 0) {
      insights.push({
        id: `panorama-delta-${atual.simulado}`,
        tone: 'critical',
        text: `Proficiência caiu ${Math.abs(round(deltaProficientes))}pp de ${anterior.simulado} para ${atual.simulado}.`,
        question: `O que explica a queda de ${anterior.simulado} para ${atual.simulado}?`,
      });
    }
  }

  if (insights.length < MAX_INSIGHTS_PER_SCREEN && meta.taxaAdesao > 0 && meta.taxaAdesao < 80) {
    insights.push({
      id: `panorama-adesao-${round(meta.taxaAdesao)}`,
      tone: 'opportunity',
      text: `Adesão do recorte está em ${round(meta.taxaAdesao)}% — abaixo do ideal para o conceito refletir a turma inteira.`,
      question: 'Como aumentar a adesão dos alunos ao próximo simulado?',
    });
  }

  return insights.slice(0, MAX_INSIGHTS_PER_SCREEN);
}

function insightsDiagnosticoCurricular(data: InstitutionalViewModel): CopilotoInsight[] {
  const pior = worstTema(data);
  if (!pior) return [];

  return [
    {
      id: `diagnostico-pior-${pior.name}`,
      tone: 'critical',
      text: `${pior.name} (${pior.areaName}) é o pior tema do recorte — ${round(pior.percentual)}% de acerto em ${pior.total} questões.`,
      action: { label: 'Ver questões', to: withTemaQuery('/gestor/simulados-questoes', pior.name) },
      question: `Por que ${pior.name} tem desempenho tão baixo e como priorizar a correção?`,
    },
  ];
}

function insightsAlunosRisco(data: InstitutionalViewModel): CopilotoInsight[] {
  const insights: CopilotoInsight[] = [];
  const students = data.allStudents;
  if (students.length === 0) return insights;

  const criticos = students.filter((s) => s.percentual < 50).length;
  // "Quase lá": abaixo da proficiência (60%) mas a menos de 30 pontos percentuais dela (>= 30%).
  const quaseLa = students.filter((s) => s.percentual >= 30 && s.percentual < 60).length;

  if (quaseLa > 0) {
    insights.push({
      id: `alunos-quase-la-${quaseLa}`,
      tone: 'opportunity',
      text: `${quaseLa} ${quaseLa === 1 ? 'aluno está' : 'alunos estão'} a menos de 30 pontos da proficiência — resgate rápido.`,
      question: 'Quais alunos estão mais próximos de virar proficientes e o que fazer por eles?',
    });
  }

  if (insights.length < MAX_INSIGHTS_PER_SCREEN && criticos > 0) {
    insights.push({
      id: `alunos-criticos-${criticos}`,
      tone: 'critical',
      text: `${criticos} ${criticos === 1 ? 'aluno está' : 'alunos estão'} em risco crítico (< 50% de acerto) no recorte atual.`,
      question: 'Quem são os alunos em risco crítico e o que os aproxima do problema?',
    });
  }

  return insights.slice(0, MAX_INSIGHTS_PER_SCREEN);
}

function insightsIntervencaoImpacto(data: InstitutionalViewModel): CopilotoInsight[] {
  const top = worstImpactTema(data);
  if (!top) return [];

  return [
    {
      id: `intervencao-top-${top.name}`,
      tone: 'opportunity',
      text: `Comece por ${top.name}: ${round(top.prevalencia)}% do exame e ${round(top.percentual)}% de acerto da turma.`,
      action: { label: 'Ver fila de intervenções', to: '/gestor/intervencao-impacto' },
      question: `Por que ${top.name} é o item de maior impacto agora?`,
    },
  ];
}

function insightsSimuladosQuestoes(data: InstitutionalViewModel): CopilotoInsight[] {
  const pior = worstTema(data);
  if (!pior) return [];

  return [
    {
      id: `simulados-pior-tema-${pior.name}`,
      tone: 'critical',
      text: `${pior.name} teve só ${round(pior.percentual)}% de acerto no recorte — leve ao colegiado.`,
      question: `Quais questões de ${pior.name} tiveram pior desempenho e por quê?`,
    },
  ];
}

function insightsCompararIes(_data: InstitutionalViewModel, filters: DesempenhoV2Filters): CopilotoInsight[] {
  // A comparação entre IES do grupo é calculada por um data-fetch próprio da
  // tela (CompararIesModule), fora do ViewModel do recorte atual — aqui só
  // sinalizamos que a análise depende do simulado selecionado, sem inventar
  // números que o insightEngine não pode calcular com o ViewModel disponível.
  if (!filters.simuladoId) return [];
  return [
    {
      id: 'comparar-ies-info',
      tone: 'info',
      text: 'Compare o desempenho das IES do grupo no mesmo simulado para identificar quem precisa de apoio.',
      question: 'Qual IES do grupo teve a pior variação neste simulado?',
    },
  ];
}

function insightsRelatorios(data: InstitutionalViewModel, filters: DesempenhoV2Filters, simuladoNome?: string): CopilotoInsight[] {
  const base = data.headerSummary.baseLabel ?? 'IES inteira';
  const simulado = simuladoNome ?? filters.simuladoId ?? 'nenhum simulado selecionado';
  return [
    {
      id: `relatorios-recorte-${simulado}-${base}`,
      tone: 'info',
      text: `O recorte atual entra no relatório: ${simulado} · ${base}.`,
    },
  ];
}

/**
 * Deriva os insights do copiloto condutor para a rota ativa a partir do
 * {@link InstitutionalViewModel} já filtrado (`filteredData` do
 * `GestorFiltersProvider`). Puramente determinístico — sem LLM, sem I/O.
 *
 * Regras por tela documentadas nas funções `insights*` acima. No máximo 2
 * insights por tela, o mais severo primeiro. Retorna `[]` quando não há dado
 * suficiente para uma leitura confiável.
 */
export function deriveInsights(
  route: string,
  data: InstitutionalViewModel | null,
  filters: DesempenhoV2Filters,
  simuladoNome?: string,
): CopilotoInsight[] {
  if (!data) return [];

  if (route.startsWith('/gestor/panorama')) return insightsPanorama(data);
  if (route.startsWith('/gestor/diagnostico-curricular')) return insightsDiagnosticoCurricular(data);
  if (route.startsWith('/gestor/alunos-risco')) return insightsAlunosRisco(data);
  if (route.startsWith('/gestor/intervencao-impacto')) return insightsIntervencaoImpacto(data);
  if (route.startsWith('/gestor/simulados-questoes')) return insightsSimuladosQuestoes(data);
  if (route.startsWith('/gestor/comparar-ies')) return insightsCompararIes(data, filters);
  if (route.startsWith('/gestor/relatorios')) return insightsRelatorios(data, filters, simuladoNome);

  return [];
}
