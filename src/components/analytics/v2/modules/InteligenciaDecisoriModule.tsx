import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, Zap, TrendingDown, TrendingUp, Target,
  ChevronRight, Users, BookOpen, ArrowRight, Crosshair,
  Gauge, Layers, Star, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import type {
  InstitutionalViewModel,
  StudentScore,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// ── Decision item model ──
interface DecisionItem {
  id: string;
  category: 'max-priority' | 'quick-win' | 'prevalent-low' | 'critical-students';
  title: string;
  subtitle: string;
  percentual: number;
  gap: number;
  prevalencia: number;
  alunosAfetados: number;
  impactoPotencial: number; // estimated pp gain on institutional %
  compositeScore: number;
  justification: string;
  areaName: string;
  specialtyName: string;
  temaName: string;
  questoes: number;
}

function buildDecisionItems(data: InstitutionalViewModel): DecisionItem[] {
  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0) || 1;
  const totalStudents = data.alunosAbaixo.length || 1;
  const items: DecisionItem[] = [];

  for (const area of data.curricular.areas) {
    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        if (tema.percentual >= PROFICIENCY_THRESHOLD) continue;

        const gap = PROFICIENCY_THRESHOLD - tema.percentual;
        const prevalencia = (tema.total / totalQuestions) * 100;
        // Estimate students affected proportionally
        const alunosAfetados = Math.ceil(totalStudents * Math.min(gap / 40, 1) * 0.7);
        // Estimate institutional impact: if this tema improves to proficiency
        const impactoPotencial = Math.round(prevalencia * (gap / 100) * 0.5 * 10) / 10;

        // Composite score: weighted combination
        const compositeScore = Math.min(100, Math.round(
          gap * 1.0 +
          prevalencia * 1.5 +
          alunosAfetados * 0.8 +
          impactoPotencial * 3
        ));

        let category: DecisionItem['category'];
        if (gap >= 15 && prevalencia >= 5) category = 'max-priority';
        else if (gap <= 5) category = 'quick-win';
        else if (prevalencia >= 4 && gap >= 10) category = 'prevalent-low';
        else if (gap >= 10) category = 'max-priority';
        else category = 'quick-win';

        items.push({
          id: `${tema.name}-${sp.name}`,
          category,
          title: tema.name,
          subtitle: `${area.name} → ${sp.name}`,
          percentual: tema.percentual,
          gap,
          prevalencia,
          alunosAfetados,
          impactoPotencial,
          compositeScore,
          justification: buildJustification(tema.name, gap, prevalencia, alunosAfetados, impactoPotencial),
          areaName: area.name,
          specialtyName: sp.name,
          temaName: tema.name,
          questoes: tema.total,
        });
      }
    }
  }

  return items.sort((a, b) => b.compositeScore - a.compositeScore);
}

function buildJustification(tema: string, gap: number, prev: number, alunos: number, impacto: number): string {
  const parts: string[] = [];
  if (gap >= 15) parts.push(`distante ${gap}pp da proficiência`);
  else if (gap >= 5) parts.push(`a ${gap}pp da proficiência`);
  else parts.push(`muito próximo da proficiência (${gap}pp)`);

  if (prev >= 5) parts.push(`alta prevalência no simulado (${prev.toFixed(0)}%)`);
  if (alunos >= 5) parts.push(`afeta ~${alunos} alunos`);
  if (impacto >= 1) parts.push(`potencial de +${impacto}pp no índice institucional`);

  return `${tema} é prioritário porque: ${parts.join('; ')}.`;
}

const categoryConfig = {
  'max-priority': {
    label: 'Prioridade Máxima',
    icon: Crosshair,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    borderColor: 'border-l-destructive',
    badge: 'destructive' as const,
  },
  'quick-win': {
    label: 'Quick Win',
    icon: Zap,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    borderColor: 'border-l-blue-500',
    badge: 'secondary' as const,
  },
  'prevalent-low': {
    label: 'Prevalente + Baixo',
    icon: Layers,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    borderColor: 'border-l-amber-500',
    badge: 'outline' as const,
  },
  'critical-students': {
    label: 'Alunos Críticos',
    icon: Users,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    borderColor: 'border-l-destructive',
    badge: 'destructive' as const,
  },
};

export const InteligenciaDecisoriModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const [selectedItem, setSelectedItem] = useState<DecisionItem | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'max-priority' | 'quick-win' | 'prevalent-low'>('all');

  const items = useMemo(() => data ? buildDecisionItems(data) : [], [data]);

  const filtered = useMemo(() => {
    if (viewMode === 'all') return items;
    return items.filter(i => i.category === viewMode);
  }, [items, viewMode]);

  const counts = useMemo(() => ({
    all: items.length,
    'max-priority': items.filter(i => i.category === 'max-priority').length,
    'quick-win': items.filter(i => i.category === 'quick-win').length,
    'prevalent-low': items.filter(i => i.category === 'prevalent-low').length,
  }), [items]);

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
          <p className="text-sm text-muted-foreground">Escolha um simulado para gerar recomendações decisórias.</p>
        </CardContent>
      </Card>
    );
  }

  // Top 3 for executive summary
  const top3 = items.slice(0, 3);
  const totalImpact = top3.reduce((s, i) => s + i.impactoPotencial, 0);

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Executive summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-5 px-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold mb-1">Resumo Executivo</h2>
              <p className="text-sm text-muted-foreground">
                Identificados <strong>{items.length} temas</strong> abaixo da proficiência.
                {' '}As <strong>3 intervenções prioritárias</strong> podem gerar até
                {' '}<strong>+{totalImpact.toFixed(1)}pp</strong> no índice institucional,
                {' '}impactando ~<strong>{top3.reduce((s, i) => s + i.alunosAfetados, 0)} alunos</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 decision cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((item, i) => {
            const cfg = categoryConfig[item.category];
            return (
              <Card
                key={item.id}
                className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${cfg.borderColor}`}
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={cfg.badge} className="text-[10px]">
                      #{i + 1} {cfg.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Score {item.compositeScore}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{item.subtitle}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gap</span>
                      <p className="font-semibold text-destructive">{item.gap}pp</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impacto</span>
                      <p className="font-semibold text-primary">+{item.impactoPotencial}pp</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Alunos</span>
                      <p className="font-semibold">~{item.alunosAfetados}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prevalência</span>
                      <p className="font-semibold">{item.prevalencia.toFixed(0)}%</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-3 gap-1 text-xs">
                    Analisar tema <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label={`Todos (${counts.all})`} active={viewMode === 'all'} onClick={() => setViewMode('all')} />
        <FilterChip label={`Prioridade Máxima (${counts['max-priority']})`} active={viewMode === 'max-priority'} onClick={() => setViewMode('max-priority')} />
        <FilterChip label={`Quick Wins (${counts['quick-win']})`} active={viewMode === 'quick-win'} onClick={() => setViewMode('quick-win')} />
        <FilterChip label={`Prevalentes (${counts['prevalent-low']})`} active={viewMode === 'prevalent-low'} onClick={() => setViewMode('prevalent-low')} />
      </div>

      {/* Full list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum item nesta categoria.</p>
        ) : (
          filtered.map((item, i) => {
            const cfg = categoryConfig[item.category];
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left group"
              >
                <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                  <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0 h-5 shrink-0">{cfg.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:grid grid-cols-3 gap-3 text-xs text-center">
                    <div>
                      <p className="text-muted-foreground">Gap</p>
                      <p className="font-semibold text-destructive">{item.gap}pp</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Impacto</p>
                      <p className="font-semibold text-primary">+{item.impactoPotencial}pp</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Score</p>
                      <p className="font-semibold">{item.compositeScore}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Methodology card */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Metodologia do Score Composto</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cada tema recebe um score (0-100) calculado como: <strong>Gap × 1.0</strong> + <strong>Prevalência × 1.5</strong> +
                {' '}<strong>Alunos afetados × 0.8</strong> + <strong>Impacto institucional × 3.0</strong>.
                Itens com maior score representam as intervenções com melhor retorno esperado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <DecisionDetailSheet
        item={selectedItem}
        data={data}
        onClose={() => setSelectedItem(null)}
      />
    </motion.div>
  );
};

const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <Button variant={active ? 'secondary' : 'outline'} size="sm" className="h-7 text-xs" onClick={onClick}>{label}</Button>
);

// ── Decision detail drawer ──
const DecisionDetailSheet: React.FC<{
  item: DecisionItem | null;
  data: InstitutionalViewModel;
  onClose: () => void;
}> = ({ item, data, onClose }) => {
  if (!item) return null;
  const cfg = categoryConfig[item.category];

  // Related students
  const relatedStudents = data.alunosAbaixo
    .map(s => ({
      ...s,
      areaScore: s.scoresByArea[item.areaName] ?? s.percentual,
    }))
    .filter(s => s.areaScore < PROFICIENCY_THRESHOLD)
    .sort((a, b) => a.areaScore - b.areaScore)
    .slice(0, 8);

  // Other temas in same specialty for comparison
  const area = data.curricular.areas.find(a => a.name === item.areaName);
  const specialty = area?.specialties.find(sp => sp.name === item.specialtyName);
  const siblingTemas = specialty?.temas.filter(t => t.name !== item.temaName).sort((a, b) => a.percentual - b.percentual) ?? [];

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
            {item.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>

          {/* Score breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Score Composto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Progress value={item.compositeScore} className="h-3 flex-1" />
                <span className="text-xl font-bold">{item.compositeScore}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label="Acurácia" value={`${item.percentual}%`} />
                <MetricBox label="Gap" value={`${item.gap}pp`} />
                <MetricBox label="Prevalência" value={`${item.prevalencia.toFixed(1)}%`} />
                <MetricBox label="Questões" value={String(item.questoes)} />
                <MetricBox label="Alunos afetados" value={`~${item.alunosAfetados}`} />
                <MetricBox label="Impacto potencial" value={`+${item.impactoPotencial}pp`} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Justification */}
          <Card className={`${cfg.bg} border-0`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Star className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Por que é prioritário</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.justification}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recomendação de Intervenção</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.category === 'quick-win'
                      ? `Intervenção focada e rápida: revisar ${item.temaName} com turmas afetadas. Potencial de mover ~${item.alunosAfetados} alunos para proficiência com esforço mínimo.`
                      : `Ação estrutural necessária: plano de recuperação em ${item.temaName} com reforço de conteúdo, exercícios dirigidos e acompanhamento individualizado dos ${item.alunosAfetados} alunos afetados.`
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related students */}
          {relatedStudents.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Alunos Críticos Relacionados
              </h4>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {relatedStudents.map((s, i) => (
                    <div key={`${s.nome}-${i}`} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium truncate block">{s.nome}</span>
                        <span className="text-xs text-muted-foreground">{s.semestre}º sem.</span>
                      </div>
                      <span className={`font-semibold shrink-0 ${s.areaScore < 50 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
                        {s.areaScore}%
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Sibling temas comparison */}
          {siblingTemas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Outros Temas em {item.specialtyName}
              </h4>
              <div className="space-y-1">
                {siblingTemas.slice(0, 5).map((t, i) => (
                  <div key={`${t.name}-${i}`} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                    <span className="font-medium truncate">{t.name}</span>
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

const MetricBox: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="p-2 rounded-md bg-muted/50">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</p>
  </div>
);
