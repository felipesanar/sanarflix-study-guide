/**
 * Insights estruturados do Caderno de Erros (SanarFlix Academy).
 *
 * Computa os 5 tipos de insight de forma DETERMINÍSTICA no cliente, a partir de
 * error_notebook_entries + review_attempts. Não usa IA — o AIInsightsCard (prosa)
 * permanece como complemento. Portado da ideia do enamde (motor de padrões),
 * adaptado às 4 causas do academy.
 */
import type { ErrorReason } from '@/hooks/useErrorNotebook';
import type { SrsConfidence } from '@/lib/srs';
import { REASON_LABELS } from '@/hooks/useErrorNotebook';

export type InsightType = 'weak_area' | 'dominant_cause' | 'recurring_confusion' | 'overconfidence' | 'roi';
export type InsightSeverity = 'critical' | 'attention' | 'positive' | 'info';

export interface InsightInput {
  entries: {
    reason: ErrorReason;
    grandeArea: string | null;
    tema: string | null;
    masteredAt: string | null;
  }[];
  reviews: { confidence: SrsConfidence; wasCorrect: boolean }[];
}

export interface Insight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  metric?: string;
}

const MIN_ENTRIES = 5;
const WEAK_AREA_SHARE = 0.3;
const WEAK_AREA_CRITICAL_SHARE = 0.5;
const DOMINANT_CAUSE_SHARE = 0.4;
const RECURRING_CONFUSION_MIN = 3;
const OVERCONF_MIN_ALTA = 3;
const OVERCONF_RATE = 0.3;

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, attention: 1, positive: 2, info: 3 };

function topByCount<T extends string>(values: (T | null)[]): { key: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: { key: T; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function computeInsights(input: InsightInput): Insight[] {
  const { entries, reviews } = input;
  if (entries.length < MIN_ENTRIES) return [];

  const total = entries.length;
  const insights: Insight[] = [];

  // 1. Área fraca
  const topArea = topByCount(entries.map((e) => e.grandeArea));
  if (topArea && topArea.count / total >= WEAK_AREA_SHARE) {
    const share = topArea.count / total;
    insights.push({
      type: 'weak_area',
      severity: share >= WEAK_AREA_CRITICAL_SHARE ? 'critical' : 'attention',
      title: `Concentre-se em ${topArea.key}`,
      body: `${pct(share)} dos seus erros estão em ${topArea.key}. Priorize a revisão dessa área.`,
      metric: `${topArea.count}/${total}`,
    });
  }

  // 2. Causa dominante
  const topCause = topByCount(entries.map((e) => e.reason));
  if (topCause && topCause.count / total > DOMINANT_CAUSE_SHARE) {
    insights.push({
      type: 'dominant_cause',
      severity: 'attention',
      title: `Causa mais comum: ${REASON_LABELS[topCause.key]}`,
      body: `${pct(topCause.count / total)} dos seus erros são por "${REASON_LABELS[topCause.key]}". Ataque esse padrão.`,
      metric: `${topCause.count}/${total}`,
    });
  }

  // 3. Confusão recorrente (did_not_understand_statement por tema)
  const confusionByTheme = topByCount(
    entries.filter((e) => e.reason === 'did_not_understand_statement').map((e) => e.tema),
  );
  if (confusionByTheme && confusionByTheme.count >= RECURRING_CONFUSION_MIN) {
    insights.push({
      type: 'recurring_confusion',
      severity: 'attention',
      title: `Interpretação travando em ${confusionByTheme.key}`,
      body: `Você errou ${confusionByTheme.count} questões de "${confusionByTheme.key}" por não entender o enunciado. Treine leitura de enunciado nesse tema.`,
      metric: `${confusionByTheme.count}×`,
    });
  }

  // 4. Overconfidence (alta confiança mas errou)
  const alta = reviews.filter((r) => r.confidence === 'alta');
  const altaWrong = alta.filter((r) => !r.wasCorrect).length;
  if (alta.length >= OVERCONF_MIN_ALTA && altaWrong / alta.length >= OVERCONF_RATE) {
    insights.push({
      type: 'overconfidence',
      severity: 'attention',
      title: 'Cuidado com o excesso de confiança',
      body: `Em ${altaWrong} de ${alta.length} revisões você disse "tinha certeza" e errou. Confirme o raciocínio antes de fechar a resposta.`,
      metric: `${altaWrong}/${alta.length}`,
    });
  }

  // 5. ROI (questões dominadas)
  const mastered = entries.filter((e) => e.masteredAt).length;
  if (mastered > 0) {
    insights.push({
      type: 'roi',
      severity: 'positive',
      title: `Você já dominou ${mastered} ${mastered === 1 ? 'questão' : 'questões'}`,
      body: 'Itens dominados saem da fila de revisão. Continue revisando para consolidar mais.',
      metric: `${mastered}/${total}`,
    });
  }

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
