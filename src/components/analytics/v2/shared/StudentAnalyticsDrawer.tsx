import React, { useEffect } from 'react';
import {
  User, TrendingDown, TrendingUp, Zap, BarChart3, Shield,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type {
  StudentScore,
  CurricularAreaNode,
  InstitutionalViewModel,
} from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

// ── Proficiency status engine ──
export type ProficiencyStatus = 'proficiente' | 'proximo' | 'abaixo';

export function computeProficiencyStatus(percentual: number): ProficiencyStatus {
  if (percentual >= PROFICIENCY_THRESHOLD) return 'proficiente';
  if (percentual >= 50) return 'proximo';
  return 'abaixo';
}

export function getStatusColor(status: ProficiencyStatus): string {
  switch (status) {
    case 'proficiente': return 'text-emerald-600 dark:text-emerald-400';
    case 'proximo': return 'text-amber-600 dark:text-amber-400';
    case 'abaixo': return 'text-destructive';
  }
}

export function getStatusBadge(status: ProficiencyStatus): { label: string; className: string } {
  switch (status) {
    case 'proficiente':
      return {
        label: 'Proficiente',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900',
      };
    case 'proximo':
      return {
        label: 'Próximo da proficiência',
        className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900',
      };
    case 'abaixo':
      return {
        label: 'Abaixo da proficiência',
        className: 'bg-destructive/10 text-destructive border-destructive/20',
      };
  }
}

// ── Pedagogical indicators ──
export interface PedagogicalIndicator {
  label: string;
  value: string;
  tone: 'neutral' | 'attention' | 'good';
}

function buildPedagogicalIndicators(
  student: StudentScore,
  _areas: CurricularAreaNode[],
): PedagogicalIndicator[] {
  const indicators: PedagogicalIndicator[] = [];

  // Gap p/ proficiência derivado do score TRI quando disponível
  const triScore = student.triScore;
  if (triScore !== null && triScore !== undefined) {
    const triGap = Math.max(0, PROFICIENCY_THRESHOLD - triScore);
    indicators.push({
      label: 'Gap p/ proficiência',
      value: triGap > 0 ? `${triGap.toFixed(1)} pts` : 'Atingido',
      tone: triGap > 0 ? 'attention' : 'good',
    });
  } else {
    indicators.push({
      label: 'Gap p/ proficiência',
      value: 'Score TRI indisponível',
      tone: 'neutral',
    });
  }

  indicators.push({
    label: 'Percentual de acertos',
    value: `${student.percentual.toFixed(1)}% (${student.acertos}/${student.total})`,
    tone: student.percentual >= 60 ? 'good' : student.percentual >= 50 ? 'neutral' : 'attention',
  });

  // Top 2 weakest areas (by % de acertos)
  const weakAreas = Object.entries(student.scoresByArea)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2);

  weakAreas.forEach(([name, value], idx) => {
    indicators.push({
      label: idx === 0 ? 'Área de menor desempenho' : 'Segunda área de menor desempenho',
      value: `${name} (${Math.round(value)}%)`,
      tone: value < 50 ? 'attention' : 'neutral',
    });
  });

  return indicators;
}

function buildRecommendation(status: ProficiencyStatus): string {
  switch (status) {
    case 'abaixo':
      return 'Plano de reforço pedagógico individualizado, com foco nas áreas de menor desempenho e revisão dos temas críticos.';
    case 'proximo':
      return 'Acompanhamento próximo com revisão dirigida nas áreas de menor desempenho. Pequenas melhorias podem garantir a proficiência.';
    case 'proficiente':
      return 'Manter acompanhamento regular. Aluno pode atuar como referência para tutoria entre pares.';
  }
}

function getToneDot(tone: PedagogicalIndicator['tone']): string {
  switch (tone) {
    case 'good': return 'bg-emerald-500';
    case 'neutral': return 'bg-muted-foreground/40';
    case 'attention': return 'bg-amber-500';
  }
}

// ── Shared Student Analytics Drawer ──
interface StudentAnalyticsDrawerProps {
  student: StudentScore | null;
  data: InstitutionalViewModel | null;
  open: boolean;
  onClose: () => void;
}

export const StudentAnalyticsDrawer: React.FC<StudentAnalyticsDrawerProps> = ({
  student, data, open, onClose,
}) => {
  useEffect(() => {
    if (open && student) {
      const status = computeProficiencyStatus(student.percentual);
      const gap = Math.max(0, PROFICIENCY_THRESHOLD - student.percentual);
      console.log('[StudentDetailsPanel] Nota:', student.percentual);
      console.log('[StudentDetailsPanel] Gap:', gap);
      console.log('[StudentDetailsPanel] Status:', status);
    }
  }, [open, student]);

  if (!student || !data) return null;

  const status = computeProficiencyStatus(student.percentual);
  const statusBadge = getStatusBadge(status);
  const triScore = student.triScore;
  const hasTri = triScore !== null && triScore !== undefined;
  const triGap = hasTri ? Math.round(Math.max(0, PROFICIENCY_THRESHOLD - (triScore as number)) * 10) / 10 : null;
  const indicators = buildPedagogicalIndicators(student, data.curricular.areas);
  const recommendation = buildRecommendation(status);

  // Build area performance (sempre por % de acertos)
  const areaPerformance = data.curricular.areas.map(a => ({
    name: a.name,
    percentual: student.scoresByArea[a.name] ?? a.percentual,
  })).sort((a, b) => a.percentual - b.percentual);

  // Build all temas for critical/opportunity (sempre por % de acertos)
  const allTemas: { name: string; area: string; specialty: string; percentual: number }[] = [];
  data.curricular.areas.forEach(a => a.specialties.forEach(sp => sp.temas.forEach(t => {
    allTemas.push({ name: t.name, area: a.name, specialty: sp.name, percentual: t.percentual });
  })));
  const criticalTemas = allTemas.filter(t => t.percentual < 50).sort((a, b) => a.percentual - b.percentual).slice(0, 5);
  const opportunityTemas = allTemas.filter(t => t.percentual >= 55 && t.percentual < 65).sort((a, b) => b.percentual - a.percentual).slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-4 sm:px-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <User className="h-5 w-5" />
            <span className="truncate">{student.nome}</span>
            <Badge variant="outline" className={`text-[10px] border ${statusBadge.className}`}>
              {statusBadge.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4 pb-4">
          {/* KPIs (4 tiles) — primeiros 2 = Score TRI; últimos 2 = % de acertos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile
              label="Nota (Score TRI)"
              value={hasTri ? (triScore as number).toFixed(1) : '—'}
              color={hasTri ? ((triScore as number) >= PROFICIENCY_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive') : 'text-muted-foreground'}
            />
            <MetricTile
              label="Gap p/ proficiência"
              value={hasTri
                ? ((triScore as number) >= PROFICIENCY_THRESHOLD ? 'Proficiente' : `${(triGap as number).toFixed(1)} pts`)
                : '—'}
              color={hasTri
                ? ((triScore as number) >= PROFICIENCY_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')
                : 'text-muted-foreground'}
            />
            <MetricTile
              label="Percentual de Acertos"
              value={`${student.percentual.toFixed(1)}%`}
            />
            <MetricTile
              label="Semestre"
              value={`${student.semestre}º`}
            />
          </div>

          {/* Recommendation */}
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recomendação de Intervenção Pedagógica</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pedagogical indicators */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Indicadores de Desempenho</h4>
            <div className="space-y-1.5">
              {indicators.map((ind, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm border border-transparent">
                  <span className="text-muted-foreground">{ind.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{ind.value}</span>
                    <div className={`h-2 w-2 rounded-full ${getToneDot(ind.tone)}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Evolution */}
          {evolution.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Evolução entre Simulados
              </h4>
              <div className="space-y-2">
                {evolution.map((e, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs w-24 truncate text-muted-foreground">{e.simulado}</span>
                    <Progress value={e.score} className="h-2 flex-1" />
                    <span className={`text-xs font-medium w-10 text-right ${e.score >= PROFICIENCY_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {Math.round(e.score)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance by area */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Desempenho por Área
            </h4>
            <div className="space-y-2">
              {areaPerformance.map(a => {
                const aStatus = computeProficiencyStatus(a.percentual);
                return (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="text-xs w-32 truncate text-muted-foreground">{a.name}</span>
                    <Progress value={a.percentual} className="h-2 flex-1" />
                    <span className={`text-xs font-medium w-10 text-right ${getStatusColor(aStatus)}`}>{a.percentual}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Critical temas */}
          {criticalTemas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-destructive">
                <TrendingDown className="h-4 w-4" /> Temas Críticos
              </h4>
              <div className="space-y-1">
                {criticalTemas.map(t => (
                  <div key={t.name} className="flex items-center justify-between p-2 rounded-md bg-destructive/5 text-sm border border-destructive/10">
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.area}</span>
                    </div>
                    <span className="text-destructive font-semibold shrink-0">{t.percentual}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunity temas */}
          {opportunityTemas.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Zap className="h-4 w-4" /> Temas de Oportunidade
              </h4>
              <div className="space-y-1">
                {opportunityTemas.map(t => (
                  <div key={t.name} className="flex items-center justify-between p-2 rounded-md bg-blue-500/5 text-sm border border-blue-500/10">
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.area}</span>
                    </div>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0">{t.percentual}%</span>
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

const MetricTile: React.FC<{ label: string; value: string; color?: string }> = ({
  label, value, color = 'text-foreground',
}) => (
  <div className="p-3 rounded-lg bg-muted/50 flex flex-col justify-between gap-2 min-h-[88px]">
    <p className="text-xs text-muted-foreground leading-tight line-clamp-2">{label}</p>
    <p className={`text-2xl font-bold tabular-nums truncate ${color}`}>{value}</p>
  </div>
);
