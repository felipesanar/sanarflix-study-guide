import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, Lightbulb, TrendingDown, Zap,
  ChevronRight, Users, BookOpen, BarChart3, Target,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { estimateAffectedStudents } from '@/utils/mapInstitutionalData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import type {
  InstitutionalViewModel,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

// Critérios de classificação (centralizados)
const CRITICAL_ACCURACY_MAX = 50;
const CRITICAL_PREVALENCE_MIN = 10;
const QUICKWIN_ACCURACY_MIN = 50;
const QUICKWIN_ACCURACY_MAX = 65;
const QUICKWIN_PREVALENCE_MIN = 8;
const STRENGTH_ACCURACY_MIN = 70;

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// ── Insight engine ──

interface PrioritizedInsight {
  id: string;
  type: 'critical-tema' | 'critical-area' | 'quick-win' | 'strength';
  title: string;
  description: string;
  // Context for drill-down
  areaName: string;
  specialtyName?: string;
  temaName?: string;
  percentual: number;
  gap: number;
  questoes: number;
  alunosAfetados: number;
  prevalencia: number; // % of total questions
  /** Internal sort key — não exibido na UI */
  impacto: number;
}

function classify(
  percentualAcerto: number,
  prevalencia: number,
): 'critical' | 'quick-win' | 'strength' | 'neutral' {
  if (percentualAcerto < CRITICAL_ACCURACY_MAX && prevalencia >= CRITICAL_PREVALENCE_MIN) {
    return 'critical';
  }
  if (
    percentualAcerto >= QUICKWIN_ACCURACY_MIN &&
    percentualAcerto <= QUICKWIN_ACCURACY_MAX &&
    prevalencia >= QUICKWIN_PREVALENCE_MIN
  ) {
    return 'quick-win';
  }
  if (percentualAcerto >= STRENGTH_ACCURACY_MIN) {
    return 'strength';
  }
  return 'neutral';
}

function buildInsights(data: InstitutionalViewModel): PrioritizedInsight[] {
  const insights: PrioritizedInsight[] = [];
  const totalQuestions = data.curricular.areas.reduce((sum, a) => sum + a.total, 0);
  const totalStudents = data.allStudents.length || 1;

  for (const area of data.curricular.areas) {
    const areaPrevalencia = totalQuestions > 0 ? (area.total / totalQuestions) * 100 : 0;
    const areaCategoria = classify(area.percentual, areaPrevalencia);

    console.log('[Insights] Classificação', {
      nome: `Área: ${area.name}`,
      percentualAcerto: area.percentual,
      prevalencia: Math.round(areaPrevalencia * 10) / 10,
      categoria: areaCategoria,
    });

    // Áreas só geram insight quando críticas
    if (areaCategoria === 'critical') {
      const gap = Math.round((PROFICIENCY_THRESHOLD - area.percentual) * 10) / 10;
      const alunosAfetados = estimateAffectedStudents(totalStudents, gap);
      insights.push({
        id: `area-${area.name}`,
        type: 'critical-area',
        title: `Área ${area.name} abaixo da proficiência`,
        description: 'Alta incidência no simulado e baixo desempenho dos alunos.',
        areaName: area.name,
        percentual: area.percentual,
        gap,
        questoes: area.total,
        alunosAfetados,
        prevalencia: areaPrevalencia,
        impacto: areaPrevalencia * (100 - area.percentual),
      });
    }

    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        const temaPrevalencia = totalQuestions > 0 ? (tema.total / totalQuestions) * 100 : 0;
        const categoria = classify(tema.percentual, temaPrevalencia);

        console.log('[Insights] Classificação', {
          nome: tema.name,
          percentualAcerto: tema.percentual,
          prevalencia: Math.round(temaPrevalencia * 10) / 10,
          categoria,
        });

        if (categoria === 'neutral') continue;

        const gap = Math.round(Math.max(0, PROFICIENCY_THRESHOLD - tema.percentual) * 10) / 10;
        const alunosAfetados = gap > 0 ? estimateAffectedStudents(totalStudents, gap) : 0;
        const impacto = temaPrevalencia * (100 - tema.percentual);

        if (categoria === 'critical') {
          insights.push({
            id: `critical-${tema.name}-${sp.name}`,
            type: 'critical-tema',
            title: `${tema.name} é crítico`,
            description: 'Alta incidência no simulado e baixo desempenho dos alunos.',
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap,
            questoes: tema.total,
            alunosAfetados,
            prevalencia: temaPrevalencia,
            impacto,
          });
        } else if (categoria === 'quick-win') {
          insights.push({
            id: `quickwin-${tema.name}-${sp.name}`,
            type: 'quick-win',
            title: `${tema.name} é ganho rápido`,
            description: 'Tema relevante e alunos próximos da proficiência — pequeno esforço, alto impacto.',
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap,
            questoes: tema.total,
            alunosAfetados,
            prevalencia: temaPrevalencia,
            impacto,
          });
        } else if (categoria === 'strength') {
          insights.push({
            id: `strength-${tema.name}-${sp.name}`,
            type: 'strength',
            title: `${tema.name} é ponto forte`,
            description: 'Tema dominado pela turma — manter consistência.',
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap: 0,
            questoes: tema.total,
            alunosAfetados: 0,
            prevalencia: temaPrevalencia,
            impacto: 0,
          });
        }
      }
    }
  }

  // Ordenação: críticos > ganhos rápidos > pontos fortes; dentro de cada grupo por impacto desc
  const groupOrder: Record<PrioritizedInsight['type'], number> = {
    'critical-area': 0,
    'critical-tema': 0,
    'quick-win': 1,
    'strength': 2,
  };

  return insights.sort((a, b) => {
    const ga = groupOrder[a.type];
    const gb = groupOrder[b.type];
    if (ga !== gb) return ga - gb;
    return b.impacto - a.impacto;
  });
}

// ── Type config ──
function getInsightConfig(type: PrioritizedInsight['type']) {
  switch (type) {
    case 'critical-tema':
      return { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const, label: 'Crítico' };
    case 'critical-area':
      return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const, label: 'Área Crítica' };
    case 'quick-win':
      return { icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', badge: 'secondary' as const, label: 'Ganho Rápido' };
    case 'strength':
      return { icon: Target, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', badge: 'default' as const, label: 'Ponto Forte' };
  }
}

function getCategoryReason(insight: PrioritizedInsight): string {
  const acerto = `${insight.percentual.toFixed(0)}%`;
  const prev = `${insight.prevalencia.toFixed(1)}%`;
  switch (insight.type) {
    case 'critical-area':
    case 'critical-tema':
      return `Classificado como Crítico porque o acerto médio (${acerto}) está abaixo de 50% e a prevalência no simulado (${prev}) é maior ou igual a 10%.`;
    case 'quick-win':
      return `Classificado como Ganho Rápido porque o acerto médio (${acerto}) está entre 50% e 65% e a prevalência no simulado (${prev}) é maior ou igual a 8%.`;
    case 'strength':
      return `Classificado como Ponto Forte porque o acerto médio (${acerto}) é igual ou superior a 70%.`;
  }
}

function getInterpretation(insight: PrioritizedInsight): string {
  const P = insight.percentual.toFixed(0);
  const V = insight.prevalencia.toFixed(1);
  switch (insight.type) {
    case 'critical-tema':
      return `Este tema apresenta baixo desempenho (${P}% de acerto) e alta incidência no simulado (${V}%), indicando forte impacto no resultado institucional.`;
    case 'critical-area':
      return `A área ${insight.areaName} concentra ${V}% das questões do simulado e está com desempenho médio de ${P}%, abaixo da proficiência institucional.`;
    case 'quick-win':
      return `Os alunos estão próximos da proficiência (${P}% de acerto) em um tema relevante (${V}% de prevalência) — um pequeno reforço pode gerar grande impacto.`;
    case 'strength':
      return `A turma demonstra domínio consistente neste tema (${P}% de acerto, ${V}% de prevalência). Manter a abordagem atual.`;
  }
}

function getRecommendationText(insight: PrioritizedInsight): string {
  const alvo = insight.temaName ?? insight.areaName;
  switch (insight.type) {
    case 'critical-tema':
    case 'critical-area':
      return `Priorizar revisão dirigida em ${alvo} para alunos abaixo da proficiência, com foco nos subtemas de maior incidência.`;
    case 'quick-win':
      return `Disponibilizar lista de exercícios direcionada em ${alvo} para consolidar a proficiência da turma.`;
    case 'strength':
      return `Manter a estratégia atual de ensino em ${alvo} e usá-lo como referência para outros temas.`;
  }
}

export const InsightsPedagogicosModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [selectedInsight, setSelectedInsight] = useState<PrioritizedInsight | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'quick-win' | 'strength'>('all');

  const insights = useMemo(() => data ? buildInsights(data) : [], [data]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return insights;
    if (filterType === 'critical') {
      return insights.filter((insight) => insight.type === 'critical-tema' || insight.type === 'critical-area');
    }
    return insights.filter(i => i.type === filterType);
  }, [insights, filterType]);

  const counts = useMemo(() => ({
    all: insights.length,
    critical: insights.filter(i => i.type === 'critical-tema' || i.type === 'critical-area').length,
    'quick-win': insights.filter(i => i.type === 'quick-win').length,
    strength: insights.filter(i => i.type === 'strength').length,
  }), [insights]);

  if (loading) return <DesempenhoV2Skeleton />;

  if (error && !data) {
    return (
      <Card className="border-dashed border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{error}</p>
          {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-lg font-semibold mb-2">Selecione um simulado</h3>
          <p className="text-sm text-muted-foreground">Escolha um simulado para gerar insights pedagógicos.</p>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <ModuleEmptyState
        title="Sem insights para o recorte atual"
        description="Amplie o recorte nos filtros globais para gerar recomendações pedagógicas acionáveis."
      />
    );
  }

  const topPriority = filtered.filter(i => i.type !== 'strength').slice(0, 3);

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">
          {insights.length} insights gerados
        </h2>
        <span className="text-xs text-muted-foreground">
          • priorizados por relevância no simulado e desempenho dos alunos
        </span>
      </div>

      {(() => {
        const mode: 'single-highlight' | 'compact-grid' | 'default' =
          filtered.length === 1 ? 'single-highlight' :
          filtered.length > 1 && filtered.length <= 3 ? 'compact-grid' :
          'default';

        console.log('[Insights] Layout adaptativo', { totalInsights: filtered.length, mode });

        const categoryLabel = filtered[0] ? getInsightConfig(filtered[0].type).label.toLowerCase() : '';

        return (
          <>
            {/* Top priority highlights — apenas no default */}
            {mode === 'default' && topPriority.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topPriority.map((insight) => {
                  const cfg = getInsightConfig(insight.type);
                  return (
                    <Card
                      key={insight.id}
                      className="cursor-pointer hover:shadow-md transition-all border-l-4 border-border/70 hover:border-primary/30"
                      style={{ borderLeftColor: insight.type.includes('critical') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <CardContent className="py-4 px-4">
                        <div className="flex items-start gap-2 mb-2">
                          <cfg.icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{insight.title}</p>
                            <Badge variant={cfg.badge} className="text-[10px] mt-1">{cfg.label}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                          <span>{insight.percentual}% acerto</span>
                          <span>{insight.prevalencia.toFixed(0)}% prevalência</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
              <FilterChip label={`Todos (${counts.all})`} active={filterType === 'all'} onClick={() => setFilterType('all')} />
              <FilterChip label={`Críticos (${counts.critical})`} active={filterType === 'critical'} onClick={() => setFilterType('critical')} />
              <FilterChip label={`Ganhos Rápidos (${counts['quick-win']})`} active={filterType === 'quick-win'} onClick={() => setFilterType('quick-win')} />
              <FilterChip label={`Pontos Fortes (${counts.strength})`} active={filterType === 'strength'} onClick={() => setFilterType('strength')} />
            </div>

            {/* Insight list — adaptive */}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight nesta categoria.</p>
            ) : mode === 'single-highlight' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Apenas 1 insight {categoryLabel} identificado
                </p>
                <SingleHighlightCard
                  insight={filtered[0]}
                  onOpenDetails={() => setSelectedInsight(filtered[0])}
                />
              </div>
            ) : mode === 'compact-grid' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} insights identificados nesta categoria
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                  {filtered.map((insight) => {
                    const cfg = getInsightConfig(insight.type);
                    const borderColor = insight.type.includes('critical')
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--primary))';
                    return (
                      <button
                        key={insight.id}
                        onClick={() => setSelectedInsight(insight)}
                        className="w-full flex items-start gap-3 p-4 sm:p-5 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/20 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
                      >
                        <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                          <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{insight.title}</span>
                            <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0 h-5">{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{insight.description}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
                            <span>{insight.percentual}% acerto</span>
                            <span>•</span>
                            <span>{insight.prevalencia.toFixed(1)}% prevalência</span>
                            {insight.alunosAfetados > 0 && (
                              <>
                                <span>•</span>
                                <span>{insight.alunosAfetados} alunos afetados</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((insight) => {
                  const cfg = getInsightConfig(insight.type);
                  return (
                    <button
                      key={insight.id}
                      onClick={() => setSelectedInsight(insight)}
                      className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/20 transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                        <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{insight.title}</span>
                          <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0 h-5 shrink-0">{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{insight.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                          <span>{insight.percentual}% acerto</span>
                          <span>{insight.prevalencia.toFixed(0)}% prevalência</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Classification explainer */}
            <Card className="border-dashed">
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como classificamos os insights</p>
                    <p className="text-xs text-muted-foreground">
                      Cada tema é avaliado por dois critérios objetivos:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-1">
                      <li>• <strong>Percentual de acerto</strong> — desempenho médio dos alunos no tema</li>
                      <li>• <strong>Prevalência</strong> — peso do tema no total de questões do simulado</li>
                    </ul>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-1 pt-1">
                      <li>🔴 <strong>Crítico</strong> — acerto abaixo de 50% e prevalência ≥ 10%</li>
                      <li>🟡 <strong>Ganho Rápido</strong> — acerto entre 50% e 65% e prevalência ≥ 8%</li>
                      <li>🟢 <strong>Ponto Forte</strong> — acerto igual ou superior a 70%</li>
                    </ul>
                    <p className="text-xs text-muted-foreground pt-1">
                      A ordem dentro de cada grupo prioriza temas com maior impacto (combinação de prevalência alta e desempenho mais baixo).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* Insight detail drawer */}
      <InsightDetailSheet
        insight={selectedInsight}
        data={data}
        onClose={() => setSelectedInsight(null)}
      />
    </motion.div>
  );
};

// ── Filter chip ──
const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <Button
    variant={active ? 'secondary' : 'outline'}
    size="sm"
    className="h-7 text-xs"
    onClick={onClick}
  >
    {label}
  </Button>
);

// ── Insight detail drawer ──
const InsightDetailSheet: React.FC<{
  insight: PrioritizedInsight | null;
  data: InstitutionalViewModel;
  onClose: () => void;
}> = ({ insight, data, onClose }) => {
  if (!insight) return null;
  const cfg = getInsightConfig(insight.type);

  // Find related students
  const relatedStudents = data.allStudents
    .filter(s => {
      const areaScore = s.scoresByArea[insight.areaName];
      return areaScore !== undefined ? areaScore < PROFICIENCY_THRESHOLD : s.percentual < PROFICIENCY_THRESHOLD;
    })
    .sort((a, b) => (a.scoresByArea[insight.areaName] ?? a.percentual) - (b.scoresByArea[insight.areaName] ?? b.percentual))
    .slice(0, 10);

  // Find related temas in same area
  const area = data.curricular.areas.find(a => a.name === insight.areaName);
  const relatedTemas = area
    ? area.specialties.flatMap(sp => sp.temas.map(t => ({ ...t, specialty: sp.name })))
        .filter(t => t.name !== insight.temaName)
        .sort((a, b) => a.percentual - b.percentual)
        .slice(0, 5)
    : [];

  return (
    <Sheet open={!!insight} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
            {insight.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground">{insight.description}</p>

          {/* Context path */}
          <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
            <span>{insight.areaName}</span>
            {insight.specialtyName && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>{insight.specialtyName}</span>
              </>
            )}
            {insight.temaName && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-foreground">{insight.temaName}</span>
              </>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Percentual Médio de Acertos</p>
              <p className={`text-xl font-bold ${cfg.color}`}>{insight.percentual}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Questões</p>
              <p className="text-xl font-bold text-foreground">{insight.questoes}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Alunos afetados</p>
              <p className="text-xl font-bold text-foreground">~{insight.alunosAfetados}</p>
            </div>
          </div>

          {/* Why classified this way */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground mb-1">Por que este insight foi classificado assim</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getCategoryReason(insight)}
            </p>
          </div>

          {/* Recommendation */}
          <Card className={`${cfg.bg} border-0`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recomendação</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {insight.type === 'critical-tema' || insight.type === 'critical-area'
                      ? `Priorizar revisão de conteúdo e reforço em ${insight.temaName ?? insight.areaName}. Considerar atividades de recuperação dirigida para os ${insight.alunosAfetados} alunos afetados.`
                      : insight.type === 'quick-win'
                        ? `Investir em intervenção focada — faltam apenas ${insight.gap}pts para proficiência. Potencial de mover ~${insight.alunosAfetados} alunos para faixa proficiente com esforço direcionado.`
                        : `Manter monitoramento de ${insight.temaName}. Usar como referência de boas práticas para áreas com desempenho inferior.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related students */}
          {relatedStudents.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Alunos Relacionados ({relatedStudents.length})
              </h4>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {relatedStudents.map((s, i) => {
                    const score = s.scoresByArea[insight.areaName] ?? s.percentual;
                    return (
                      <div key={`${s.nome}-${i}`} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                        <span className="font-medium truncate">{s.nome}</span>
                        <span className={`font-semibold shrink-0 ${score < 50 ? 'text-destructive' : score < 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {score}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Related temas */}
          {relatedTemas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Outros Temas em {insight.areaName}
              </h4>
              <div className="space-y-1">
                {relatedTemas.map((t, i) => (
                  <div key={`${t.name}-${i}`} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.specialty}</span>
                    </div>
                    <span className={`font-semibold shrink-0 ${t.percentual < 50 ? 'text-destructive' : t.percentual < 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {t.percentual}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
