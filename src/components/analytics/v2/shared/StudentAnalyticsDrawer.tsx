import React, { useEffect, useState } from 'react';
import {
  User, TrendingDown, TrendingUp, Zap, BarChart3, Shield,
  Phone, Copy, Check, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { fetchAlunoContato } from '@/services/institutional';
import { maskPhone, onlyDigits, whatsappLink } from '@/utils/phone';
import { Logger } from '@/utils/logger';

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

  // Top 2 weakest areas (por % de acertos do aluno na área)
  const areaPcts: { name: string; pct: number }[] = [];
  Object.entries(student.totalsByArea ?? {}).forEach(([name, total]) => {
    if (!total || total <= 0) return;
    const acertos = student.scoresByArea?.[name] ?? 0;
    areaPcts.push({ name, pct: Math.round((acertos / total) * 100) });
  });
  const weakAreas = areaPcts.sort((a, b) => a.pct - b.pct).slice(0, 2);

  weakAreas.forEach(({ name, pct }, idx) => {
    indicators.push({
      label: idx === 0 ? 'Área de menor desempenho' : 'Segunda área de menor desempenho',
      value: `${name} (${pct}%)`,
      tone: pct < 50 ? 'attention' : 'neutral',
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
  // Telefone é buscado por aluno, só quando o drawer abre — a lista de alunos
  // nunca carrega contato em massa.
  const studentId = student?.studentId;
  const [contato, setContato] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    telefone: string | null;
  }>({ status: 'idle', telefone: null });

  useEffect(() => {
    if (!open || !studentId) {
      setContato({ status: 'idle', telefone: null });
      return;
    }
    let cancelled = false;
    setContato({ status: 'loading', telefone: null });
    fetchAlunoContato(studentId)
      .then(({ telefone }) => {
        if (!cancelled) setContato({ status: 'ok', telefone });
      })
      .catch((err) => {
        if (cancelled) return;
        Logger.warn('[StudentAnalyticsDrawer]', 'Falha ao carregar contato do aluno:', err);
        setContato({ status: 'error', telefone: null });
      });
    return () => { cancelled = true; };
  }, [open, studentId]);

  useEffect(() => {
    if (open && student) {
      const status = computeProficiencyStatus(student.percentual);
      const gap = Math.max(0, PROFICIENCY_THRESHOLD - student.percentual);
      Logger.info('[StudentDetailsPanel] Nota:', student.percentual);
      Logger.info('[StudentDetailsPanel] Gap:', gap);
      Logger.info('[StudentDetailsPanel] Status:', status);
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

  // Build area performance (% de acertos do aluno na área = acertos/total no simulado)
  const areaPerformance = Object.entries(student.totalsByArea ?? {})
    .filter(([, total]) => total > 0)
    .map(([name, total]) => {
      const acertos = student.scoresByArea?.[name] ?? 0;
      return { name, percentual: Math.round((acertos / total) * 100) };
    })
    .sort((a, b) => b.percentual - a.percentual);

  // Lookup area name por tema (apenas para rótulo de subtítulo)
  const temaToArea = new Map<string, string>();
  data.curricular.areas.forEach(a => a.specialties.forEach(sp => sp.temas.forEach(t => {
    temaToArea.set(t.name, a.name);
  })));

  // Temas: % de acertos do aluno no tema = acertos_aluno / total_tema_no_simulado
  const allTemas: { name: string; area: string; percentual: number }[] = [];
  Object.entries(student.totalsByTema ?? {}).forEach(([name, total]) => {
    if (!total || total <= 0) return;
    const acertos = student.scoresByTema?.[name] ?? 0;
    allTemas.push({
      name,
      area: temaToArea.get(name) ?? '',
      percentual: Math.round((acertos / total) * 100),
    });
  });
  // Críticos: 5 menores percentuais → exibidos em ordem decrescente
  const criticalTemas = [...allTemas]
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 5)
    .sort((a, b) => b.percentual - a.percentual);
  // Oportunidade: temas com acerto > 0 e abaixo de 60%, até 5 mais próximos de 60%, ordem decrescente
  const opportunityTemas = allTemas
    .filter(t => t.percentual > 0 && t.percentual < 60)
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 5);

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
          {studentId && (
            <ContactRow
              nome={student.nome}
              status={contato.status}
              telefone={contato.telefone}
            />
          )}
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

// ── Contato do aluno (copiar número / abrir WhatsApp) ──
const ContactRow: React.FC<{
  nome: string;
  status: 'idle' | 'loading' | 'ok' | 'error';
  telefone: string | null;
}> = ({ nome, status, telefone }) => {
  const [copied, setCopied] = useState(false);

  if (status === 'loading' || status === 'idle') {
    return <p className="text-xs text-muted-foreground">Carregando contato…</p>;
  }
  if (status === 'error') {
    return <p className="text-xs text-muted-foreground">Contato indisponível</p>;
  }

  const digits = onlyDigits(telefone ?? '');
  if (!digits) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 shrink-0" /> Telefone não cadastrado
      </p>
    );
  }

  const formatted = maskPhone(digits);
  const wa = whatsappLink(digits);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Telefone copiado', { description: `${nome} · ${formatted}` });
    } catch {
      toast.error('Não foi possível copiar o telefone');
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm tabular-nums select-all">{formatted}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={handleCopy}
        aria-label={`Copiar telefone de ${nome}`}
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
      {wa && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
        >
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp de ${nome}`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </Button>
      )}
    </div>
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
