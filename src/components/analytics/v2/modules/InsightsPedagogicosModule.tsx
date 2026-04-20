import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, Lightbulb, TrendingDown, TrendingUp, Zap,
  ChevronRight, Users, BookOpen, BarChart3, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { estimateAffectedStudents } from '@/utils/mapInstitutionalData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { TooltipInfo } from '@/components/analytics/v2/TooltipInfo';
import type {
  InstitutionalViewModel,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

// ── Explicação do cálculo de prioridade ──
function getPriorityFormulaExplanation(type: PrioritizedInsight['type']): string {
  switch (type) {
    case 'critical-area':
      return `Score = (Gap × 1,2) + (Prevalência × 0,8) + min(Alunos afetados, 30)\n\n• Gap: distância em pontos até ${PROFICIENCY_THRESHOLD}% de proficiência\n• Prevalência: % de questões da área no simulado\n• Alunos afetados: estimativa baseada no gap\n\nLimitado a 100.`;
    case 'critical-tema':
      return `Score = (Gap × 1,5) + (Prevalência × 1,2) + (Alunos afetados × 0,5)\n\n• Gap: distância em pontos até ${PROFICIENCY_THRESHOLD}% de proficiência\n• Prevalência: % de questões do tema no simulado\n• Alunos afetados: estimativa de impacto\n\nTemas críticos têm pesos maiores por exigirem intervenção urgente. Limitado a 100.`;
    case 'quick-win':
    case 'opportunity-tema':
      return `Score = (Gap × 3) + (Prevalência × 2) + Alunos próximos\n\n• Gap: pontos restantes até ${PROFICIENCY_THRESHOLD}% (ganhos rápidos têm gap pequeno)\n• Prevalência: % de questões do tema no simulado\n• Alunos próximos: alunos que podem subir de faixa\n\nPesos altos no gap pois pequenos esforços geram grande impacto. Limitado a 100.`;
    case 'strength':
      return `Pontos fortes recebem score fixo de 10 pois não exigem intervenção — servem apenas como referência de boas práticas.`;
  }
}

const GENERAL_PRIORITY_EXPLANATION =
  'O Score de Prioridade (0–100) combina 3 fatores ponderados:\n\n' +
  `• Gap de proficiência: distância até ${PROFICIENCY_THRESHOLD}% de acertos\n` +
  '• Prevalência: peso do tema/área no total de questões do simulado\n' +
  '• Alunos afetados: estimativa de quantos alunos seriam impactados\n\n' +
  'Cada tipo de insight (Crítico, Ganho Rápido, etc.) usa pesos diferentes — críticos enfatizam o gap, ganhos rápidos enfatizam a proximidade da meta. Quanto maior o score, maior a urgência.';

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// ── Insight engine ──

interface PrioritizedInsight {
  id: string;
  type: 'critical-tema' | 'opportunity-tema' | 'critical-area' | 'quick-win' | 'strength';
  title: string;
  description: string;
  /** 0-100 priority score */
  priority: number;
  priorityFactors: { label: string; value: string }[];
  // Context for drill-down
  areaName: string;
  specialtyName?: string;
  temaName?: string;
  percentual: number;
  gap: number;
  questoes: number;
  alunosAfetados: number;
  prevalencia: number; // % of total questions
}

function buildInsights(data: InstitutionalViewModel): PrioritizedInsight[] {
  const insights: PrioritizedInsight[] = [];
  const totalQuestions = data.curricular.areas.reduce((sum, a) => sum + a.total, 0);
  const totalStudents = data.allStudents.length || 1;

  for (const area of data.curricular.areas) {
    const areaPrevalencia = totalQuestions > 0 ? (area.total / totalQuestions) * 100 : 0;

    // Area-level insights
    if (area.percentual < PROFICIENCY_THRESHOLD) {
      const gap = Math.round((PROFICIENCY_THRESHOLD - area.percentual) * 10) / 10;
      const alunosAfetados = estimateAffectedStudents(totalStudents, gap);
      const priority = Math.min(100, gap * 1.2 + areaPrevalencia * 0.8 + Math.min(alunosAfetados, 30));
      insights.push({
        id: `area-${area.name}`,
        type: 'critical-area',
        title: `Área ${area.name} abaixo da proficiência`,
        description: `${area.name} está a ${gap.toFixed(0)}pts da proficiência com ${area.specialties.length} especialidades e ${area.total} questões no simulado.`,
        priority,
        priorityFactors: [
          { label: 'Gap', value: `${gap.toFixed(0)}pts` },
          { label: 'Prevalência', value: `${areaPrevalencia.toFixed(0)}%` },
          { label: 'Especialidades', value: String(area.specialties.length) },
        ],
        areaName: area.name,
        percentual: area.percentual,
        gap,
        questoes: area.total,
        alunosAfetados,
        prevalencia: areaPrevalencia,
      });
    }

    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        const temaPrevalencia = totalQuestions > 0 ? (tema.total / totalQuestions) * 100 : 0;
        const gap = Math.round(Math.max(0, PROFICIENCY_THRESHOLD - tema.percentual) * 10) / 10;
        const alunosAfetados = gap > 0 ? estimateAffectedStudents(totalStudents, gap) : 0;

        if (tema.percentual < 50) {
          // Critical tema
          const priority = Math.min(100, gap * 1.5 + temaPrevalencia * 1.2 + alunosAfetados * 0.5);
          insights.push({
            id: `critical-${tema.name}-${sp.name}`,
            type: 'critical-tema',
            title: `${tema.name} é crítico`,
            description: `Apenas ${tema.percentual}% de acerto em ${tema.name} (${sp.name}). Tema requer intervenção prioritária.`,
            priority,
            priorityFactors: [
              { label: 'Acerto', value: `${tema.percentual}%` },
              { label: 'Gap', value: `${gap.toFixed(1)}pts` },
              { label: 'Prevalência', value: `${temaPrevalencia.toFixed(1)}%` },
              { label: 'Alunos afetados', value: `~${alunosAfetados}` },
            ],
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap,
            questoes: tema.total,
            alunosAfetados,
            prevalencia: temaPrevalencia,
          });
        } else if (tema.percentual >= 55 && tema.percentual < PROFICIENCY_THRESHOLD) {
          // Opportunity / quick win
          const priority = Math.min(100, (PROFICIENCY_THRESHOLD - tema.percentual) * 3 + temaPrevalencia * 2 + alunosAfetados);
          insights.push({
            id: `opportunity-${tema.name}-${sp.name}`,
            type: 'quick-win',
            title: `${tema.name} é ganho rápido`,
            description: `A apenas ${gap.toFixed(1)}pts da proficiência. Intervenção focada em ${tema.name} pode impactar rapidamente.`,
            priority,
            priorityFactors: [
              { label: 'Gap', value: `${gap.toFixed(1)}pts` },
              { label: 'Prevalência', value: `${temaPrevalencia.toFixed(1)}%` },
              { label: 'Alunos próximos', value: `~${alunosAfetados}` },
            ],
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap,
            questoes: tema.total,
            alunosAfetados,
            prevalencia: temaPrevalencia,
          });
        } else if (tema.percentual >= 75) {
          // Strength
          insights.push({
            id: `strength-${tema.name}-${sp.name}`,
            type: 'strength',
            title: `${tema.name} é ponto forte`,
            description: `${tema.percentual}% de acerto. Manter monitoramento e usar como referência.`,
            priority: 10,
            priorityFactors: [
              { label: 'Acerto', value: `${tema.percentual}%` },
              { label: 'Questões', value: String(tema.total) },
            ],
            areaName: area.name,
            specialtyName: sp.name,
            temaName: tema.name,
            percentual: tema.percentual,
            gap: 0,
            questoes: tema.total,
            alunosAfetados: 0,
            prevalencia: temaPrevalencia,
          });
        }
      }
    }
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

// ── Type config ──
function getInsightConfig(type: PrioritizedInsight['type']) {
  switch (type) {
    case 'critical-tema':
      return { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const, label: 'Crítico' };
    case 'critical-area':
      return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const, label: 'Área Crítica' };
    case 'quick-win':
      return { icon: Zap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', badge: 'secondary' as const, label: 'Ganho Rápido' };
    case 'opportunity-tema':
      return { icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', badge: 'secondary' as const, label: 'Oportunidade' };
    case 'strength':
      return { icon: Target, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', badge: 'default' as const, label: 'Ponto Forte' };
  }
}

export const InsightsPedagogicosModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [selectedInsight, setSelectedInsight] = useState<PrioritizedInsight | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'critical-tema' | 'critical-area' | 'quick-win' | 'strength'>('all');

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
    'critical-tema': insights.filter(i => i.type === 'critical-tema').length,
    'critical-area': insights.filter(i => i.type === 'critical-area').length,
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
  console.log('[InsightsPedagogicos]', 'Render do módulo', {
    totalInsights: insights.length,
    filteredInsights: filtered.length,
    filterType,
  });

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">
          {insights.length} insights gerados
        </h2>
        <span className="text-xs text-muted-foreground">• priorizados por prevalência e impacto</span>
      </div>

      {/* Top priority highlights */}
      {topPriority.length > 0 && (
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
                    <span className="flex items-center gap-1">
                      Prioridade: {Math.round(insight.priority)}/100
                      <TooltipInfo
                        text={getPriorityFormulaExplanation(insight.type)}
                        position="top"
                      />
                    </span>
                    <span>{insight.gap > 0 ? `${insight.gap.toFixed(1)}pts gap` : `${insight.percentual}%`}</span>
                  </div>
                  <Progress value={insight.priority} className="h-1.5 mt-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label={`Todos (${counts.all})`} active={filterType === 'all'} onClick={() => setFilterType('all')} />
        <FilterChip label={`Críticos (${counts['critical-tema'] + counts['critical-area']})`} active={filterType === 'critical'} onClick={() => setFilterType('critical')} />
        <FilterChip label={`Ganhos Rápidos (${counts['quick-win']})`} active={filterType === 'quick-win'} onClick={() => setFilterType('quick-win')} />
        <FilterChip label={`Pontos Fortes (${counts.strength})`} active={filterType === 'strength'} onClick={() => setFilterType('strength')} />
      </div>

      {/* Insight list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight nesta categoria.</p>
        ) : (
          filtered.map((insight) => {
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
                    <span>Prioridade {Math.round(insight.priority)}</span>
                    <span>{insight.prevalencia.toFixed(0)}% prevalência</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Prioritization explainer */}
      <Card className="border-dashed">
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Como o Score de Prioridade é calculado</p>
              <p className="text-xs text-muted-foreground">
                Cada insight recebe uma nota de <strong>0 a 100</strong> que combina três fatores ponderados:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-1">
                <li>• <strong>Gap de proficiência</strong> — distância em pontos até o limiar de {PROFICIENCY_THRESHOLD}% de acertos</li>
                <li>• <strong>Prevalência</strong> — peso do tema/área no total de questões do simulado</li>
                <li>• <strong>Alunos afetados</strong> — estimativa de quantos alunos seriam impactados pela intervenção</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                Os pesos variam por tipo: <strong>insights críticos</strong> enfatizam o gap (×1,5) e a prevalência (×1,2);
                <strong> ganhos rápidos</strong> dão peso maior ao gap (×3) pois pequenos esforços geram grande impacto;
                <strong> pontos fortes</strong> recebem score fixo (10) por não exigirem intervenção.
                Quanto maior o score, maior a urgência de atuação.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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

          {/* Priority breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Score de Prioridade
                <TooltipInfo
                  text={getPriorityFormulaExplanation(insight.type)}
                  position="right"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Progress value={insight.priority} className="h-3 flex-1" />
                <span className="text-lg font-bold text-foreground">{Math.round(insight.priority)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {insight.priorityFactors.map(f => (
                  <div key={f.label} className="p-2 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-sm font-semibold">{f.value}</p>
                  </div>
                ))}
              </div>
              {/* Inline formula explanation */}
              <div className="rounded-md bg-muted/30 border border-border/50 p-2.5 mt-2">
                <p className="text-[11px] font-semibold text-foreground mb-1">Como este score foi calculado</p>
                <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">
                  {getPriorityFormulaExplanation(insight.type)}
                </p>
              </div>
            </CardContent>
          </Card>

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
