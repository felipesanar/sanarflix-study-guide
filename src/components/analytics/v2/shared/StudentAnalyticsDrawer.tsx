import React, { useEffect } from 'react';
import {
  User, TrendingDown, TrendingUp, Zap, BarChart3,
  AlertTriangle, Shield,
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

// ── Risk engine ──
export type RiskLevel = 'critico' | 'atencao' | 'oportunidade' | 'proficiente';

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0-100, higher = more at risk
  label: string;
  justification: string;
  recommendation: string;
  factors: { label: string; value: string; severity: 'high' | 'medium' | 'low' }[];
}

export function computeRiskLevel(percentual: number): RiskLevel {
  if (percentual >= PROFICIENCY_THRESHOLD) return 'proficiente';
  if (percentual >= PROFICIENCY_THRESHOLD - 5) return 'oportunidade';
  if (percentual >= PROFICIENCY_THRESHOLD - 15) return 'atencao';
  return 'critico';
}

export function computeRiskAssessment(student: StudentScore, _areas: CurricularAreaNode[]): RiskAssessment {
  const gap = Math.max(0, PROFICIENCY_THRESHOLD - student.percentual);
  const level = computeRiskLevel(student.percentual);

  // Calculate risk score: higher = more risky
  const gapFactor = Math.min(gap * 2.5, 50);
  const areaWeaknessFactor = Object.values(student.scoresByArea).filter(v => v < 50).length * 10;
  const consistencyFactor = student.total > 0 ? Math.max(0, 40 - student.percentual) * 0.5 : 0;
  const score = Math.min(100, Math.round(gapFactor + areaWeaknessFactor + consistencyFactor));

  const factors: RiskAssessment['factors'] = [];
  factors.push({
    label: 'Gap de proficiência',
    value: `${gap}pp`,
    severity: gap >= 15 ? 'high' : gap >= 5 ? 'medium' : 'low',
  });

  const weakAreas = Object.entries(student.scoresByArea)
    .filter(([, v]) => v < 50)
    .map(([k]) => k);
  if (weakAreas.length > 0) {
    factors.push({
      label: 'Áreas fracas',
      value: weakAreas.join(', '),
      severity: weakAreas.length >= 2 ? 'high' : 'medium',
    });
  }

  factors.push({
    label: 'Acurácia geral',
    value: `${student.percentual}% (${student.acertos}/${student.total})`,
    severity: student.percentual < 45 ? 'high' : student.percentual < 55 ? 'medium' : 'low',
  });

  let justification: string;
  let recommendation: string;

  switch (level) {
    case 'critico':
      justification = `Distante ${gap}pp da proficiência. ${weakAreas.length > 0 ? `Apresenta fragilidade em ${weakAreas.length} área(s): ${weakAreas.join(', ')}.` : 'Desempenho baixo generalizado.'} Score de risco ${score}/100.`;
      recommendation = 'Plano de recuperação estrutural com tutoria individualizada, reforço nos temas mais críticos e acompanhamento semanal.';
      break;
    case 'atencao':
      justification = `A ${gap}pp da proficiência. ${weakAreas.length > 0 ? `Precisa melhorar em ${weakAreas.join(', ')}.` : 'Desempenho intermediário.'} Score de risco ${score}/100.`;
      recommendation = 'Monitoramento próximo com revisão focada nos temas de maior gap. Sessões de reforço em grupo podem ser eficazes.';
      break;
    case 'oportunidade':
      justification = `Muito próximo da proficiência — apenas ${gap}pp. Pequena melhoria pode resultar em reclassificação como proficiente. Score de risco ${score}/100.`;
      recommendation = 'Intervenção focada e pontual. Revisar 2-3 temas mais fracos pode ser suficiente para cruzar o limiar.';
      break;
    default:
      justification = `Acima do limiar de proficiência. Score de risco ${score}/100. Manter acompanhamento regular.`;
      recommendation = 'Manter monitoramento. Pode servir como referência para tutoria entre pares.';
  }

  return { level, score, label: getRiskLabel(level), justification, recommendation, factors };
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'critico': return 'Crítico';
    case 'atencao': return 'Atenção';
    case 'oportunidade': return 'Próximo de virar';
    case 'proficiente': return 'Proficiente';
  }
}

export function getRiskVariant(level: RiskLevel): 'destructive' | 'secondary' | 'outline' | 'default' {
  switch (level) {
    case 'critico': return 'destructive';
    case 'atencao': return 'secondary';
    case 'oportunidade': return 'outline';
    case 'proficiente': return 'default';
  }
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'critico': return 'text-destructive';
    case 'atencao': return 'text-amber-600 dark:text-amber-400';
    case 'oportunidade': return 'text-blue-600 dark:text-blue-400';
    case 'proficiente': return 'text-emerald-600 dark:text-emerald-400';
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
      console.log('[GlobalDetailDrawer]', 'Drawer de aluno aberto', { aluno: student.nome });
    }
  }, [open, student]);

  if (!student || !data) return null;

  const risk = computeRiskAssessment(student, data.curricular.areas);
  const gap = Math.max(0, PROFICIENCY_THRESHOLD - student.percentual);

  // Build area performance
  const areaPerformance = data.curricular.areas.map(a => ({
    name: a.name,
    percentual: student.scoresByArea[a.name] ?? a.percentual,
  })).sort((a, b) => a.percentual - b.percentual);

  // Build all temas for critical/opportunity
  const allTemas: { name: string; area: string; specialty: string; percentual: number }[] = [];
  data.curricular.areas.forEach(a => a.specialties.forEach(sp => sp.temas.forEach(t => {
    allTemas.push({ name: t.name, area: a.name, specialty: sp.name, percentual: t.percentual });
  })));
  const criticalTemas = allTemas.filter(t => t.percentual < 50).sort((a, b) => a.percentual - b.percentual).slice(0, 5);
  const opportunityTemas = allTemas.filter(t => t.percentual >= 55 && t.percentual < 65).sort((a, b) => b.percentual - a.percentual).slice(0, 5);

  // Evolution from mock data (simulated)
  const evolution = data.evolucao?.map((e, i) => ({
    simulado: e.simulado,
    score: Math.max(30, student.percentual - (data.evolucao.length - i - 1) * (2 + Math.random() * 3)),
  })) ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {student.nome}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Overview metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Acurácia" value={`${student.percentual}%`} color={getRiskColor(risk.level)} />
            <MetricTile label="Gap p/ proficiência" value={gap > 0 ? `${gap}pp` : '✓'} color={gap > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'} />
            <MetricTile label="Semestre" value={`${student.semestre}º`} />
            <MetricTile label="Score de Risco" value={`${risk.score}/100`} color={getRiskColor(risk.level)} />
          </div>

          {/* Risk assessment card */}
          <Card className={risk.level === 'critico' ? 'bg-destructive/5 border-destructive/20' : risk.level === 'oportunidade' ? 'bg-blue-500/5 border-blue-500/20' : ''}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                {risk.level === 'critico' ? (
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                ) : risk.level === 'oportunidade' ? (
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                ) : risk.level === 'atencao' ? (
                  <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                ) : (
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">Nível de Risco</p>
                    <Badge variant={getRiskVariant(risk.level)}>{risk.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{risk.justification}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk factors */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Fatores de Risco</h4>
            <div className="space-y-1.5">
              {risk.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{f.value}</span>
                    <div className={`h-2 w-2 rounded-full ${
                      f.severity === 'high' ? 'bg-destructive' : f.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recomendação de Intervenção</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{risk.recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                const aLevel = computeRiskLevel(a.percentual);
                return (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="text-xs w-32 truncate text-muted-foreground">{a.name}</span>
                    <Progress value={a.percentual} className="h-2 flex-1" />
                    <span className={`text-xs font-medium w-10 text-right ${getRiskColor(aLevel)}`}>{a.percentual}%</span>
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
                  <div key={t.name} className="flex items-center justify-between p-2 rounded-md bg-destructive/5 text-sm">
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
                  <div key={t.name} className="flex items-center justify-between p-2 rounded-md bg-blue-500/5 text-sm">
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

const MetricTile: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-foreground' }) => (
  <div className="p-3 rounded-lg bg-muted/50">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);
