import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Crosshair, BarChart3 } from 'lucide-react';
import { estimateAffectedStudents } from '@/utils/mapInstitutionalData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell,
  BarChart, Bar, LabelList,
} from 'recharts';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { SimuladorImpactoModule } from './SimuladorImpactoModule';
import { TooltipInfo } from '@/components/analytics/v2/TooltipInfo';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';

const PROFICIENCY_THRESHOLD = 60;

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

interface ScatterPoint {
  name: string;
  area: string;
  specialty: string;
  prevalencia: number;
  proficiencia: number;
  gap: number;
  impacto: number;
  questoes: number;
}

interface ImpactItem {
  name: string;
  area: string;
  impacto: number;
  gap: number;
  prevalencia: number;
  alunosAfetados: number;
}

function buildChartData(data: InstitutionalViewModel) {
  const totalQuestions = data.curricular.areas.reduce((s, a) => s + a.total, 0) || 1;
  const totalStudents = data.allStudents.length || 1;
  const scatterPoints: ScatterPoint[] = [];
  const impactItems: ImpactItem[] = [];

  for (const area of data.curricular.areas) {
    for (const sp of area.specialties) {
      for (const tema of sp.temas) {
        const prevalencia = (tema.total / totalQuestions) * 100;
        const proficiencia = tema.percentual;
        const gap = Math.max(0, PROFICIENCY_THRESHOLD - proficiencia);

        scatterPoints.push({
          name: tema.name,
          area: area.name,
          specialty: sp.name,
          prevalencia: Math.round(prevalencia * 10) / 10,
          proficiencia: Math.round(proficiencia * 10) / 10,
          gap: Math.round(gap * 10) / 10,
          impacto: 0,
          questoes: tema.total,
        });

        if (gap > 0) {
          const alunosAfetados = estimateAffectedStudents(totalStudents, gap);
          const impacto = Math.round(prevalencia * alunosAfetados * gap) / 100;
          impactItems.push({
            name: tema.name,
            area: area.name,
            impacto: Math.round(impacto * 10) / 10,
            gap: Math.round(gap * 10) / 10,
            prevalencia: Math.round(prevalencia * 10) / 10,
            alunosAfetados,
          });
        }
      }
    }
  }

  const top10Impact = impactItems.sort((a, b) => b.impacto - a.impacto).slice(0, 10);
  const maxImpact = top10Impact[0]?.impacto || 1;
  const normalizedImpact = top10Impact.map(item => ({
    ...item,
    impactoNorm: Math.round((item.impacto / maxImpact) * 100),
  }));

  return { scatterPoints, impactItems: normalizedImpact };
}

// ── Scatter Tooltip ──
const ScatterTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ScatterPoint;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-semibold text-sm">{d.name}</p>
      <p className="text-muted-foreground">{d.area} → {d.specialty}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span className="text-muted-foreground">Prevalência</span>
        <span className="font-medium text-right">{d.prevalencia}%</span>
        <span className="text-muted-foreground">Proficiência</span>
        <span className="font-medium text-right">{d.proficiencia}pts</span>
        <span className="text-muted-foreground">Gap</span>
        <span className="font-medium text-right text-destructive">{d.gap}pts</span>
        <span className="text-muted-foreground">Questões</span>
        <span className="font-medium text-right">{d.questoes}</span>
      </div>
    </div>
  );
};

// ── Bar Tooltip ──
const ImpactBarTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ImpactItem & { impactoNorm: number };
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-semibold text-sm">{d.name}</p>
      <p className="text-muted-foreground">{d.area}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span className="text-muted-foreground">Índice de Impacto</span>
        <span className="font-medium text-right">{d.impactoNorm}</span>
        <span className="text-muted-foreground">Gap</span>
        <span className="font-medium text-right text-destructive">{d.gap}pts</span>
        <span className="text-muted-foreground">Prevalência</span>
        <span className="font-medium text-right">{d.prevalencia}%</span>
        <span className="text-muted-foreground">Alunos afetados</span>
        <span className="font-medium text-right">~{d.alunosAfetados}</span>
      </div>
    </div>
  );
};

// ── Scatter dot colors ──
function getScatterColor(point: ScatterPoint): string {
  if (point.proficiencia < PROFICIENCY_THRESHOLD && point.prevalencia > 5) {
    return 'hsl(0 84% 60%)'; // destructive — priority zone
  }
  if (point.proficiencia < PROFICIENCY_THRESHOLD) {
    return 'hsl(38 92% 50%)'; // amber — below threshold
  }
  return 'hsl(142 71% 45%)'; // green — proficient
}

// ── Impact bar colors ──
function getBarColor(impactoNorm: number): string {
  if (impactoNorm >= 70) return 'hsl(0 84% 60%)';
  if (impactoNorm >= 40) return 'hsl(38 92% 50%)';
  return 'hsl(221 83% 53%)';
}

export const InteligenciaDecisoriModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  const { scatterPoints, impactItems } = useMemo(
    () => (data ? buildChartData(data) : { scatterPoints: [], impactItems: [] }),
    [data]
  );

  const maxPrevalencia = useMemo(
    () => Math.max(10, ...scatterPoints.map(p => p.prevalencia)) * 1.1,
    [scatterPoints]
  );

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
          <p className="text-sm text-muted-foreground">Escolha um simulado para gerar análises decisórias.</p>
        </CardContent>
      </Card>
    );
  }

  if (scatterPoints.length === 0) {
    return (
      <ModuleEmptyState
        title="Sem dados para análise"
        description="Nenhum tema encontrado com os filtros aplicados."
      />
    );
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Section 1 — Strategic Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart A — Priority Scatter Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              Mapa de Prioridades
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Prevalência no exame vs. proficiência média — quadrante inferior-direito = prioridade de intervenção
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    type="number"
                    dataKey="prevalencia"
                    name="Prevalência"
                    unit="%"
                    domain={[0, maxPrevalencia]}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    label={{ value: 'Prevalência (%)', position: 'bottom', offset: 0, fontSize: 11, className: 'fill-muted-foreground' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="proficiencia"
                    name="Proficiência"
                    unit="pts"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    label={{ value: 'Proficiência (pts)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, className: 'fill-muted-foreground' }}
                  />
                  {/* Priority intervention zone — high prevalence + low proficiency */}
                  <ReferenceArea
                    x1={5}
                    x2={maxPrevalencia}
                    y1={0}
                    y2={PROFICIENCY_THRESHOLD}
                    fill="hsl(0 84% 60%)"
                    fillOpacity={0.06}
                    strokeOpacity={0}
                  />
                  <ReferenceLine
                    y={PROFICIENCY_THRESHOLD}
                    stroke="hsl(142 71% 45%)"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: '60pts', position: 'right', fontSize: 10, className: 'fill-muted-foreground' }}
                  />
                  <RechartsTooltip content={<ScatterTooltipContent />} />
                  <Scatter data={scatterPoints} isAnimationActive={false}>
                    {scatterPoints.map((point, i) => (
                      <Cell
                        key={i}
                        fill={getScatterColor(point)}
                        fillOpacity={0.8}
                        r={Math.max(5, Math.min(12, point.questoes * 1.5))}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-2 justify-center text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(0 84% 60%)' }} />
                Prioridade de Intervenção
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(38 92% 50%)' }} />
                Abaixo da proficiência
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(142 71% 45%)' }} />
                Proficiente
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart B — Curricular Impact Index */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Índice de Impacto Curricular
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Top 10 temas ordenados por impacto = prevalência × alunos afetados × gap
            </p>
          </CardHeader>
          <CardContent>
            {impactItems.length === 0 ? (
              <div className="flex items-center justify-center h-[340px] text-sm text-muted-foreground">
                Todos os temas estão acima da proficiência
              </div>
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={impactItems}
                    layout="vertical"
                    margin={{ top: 5, right: 40, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <RechartsTooltip content={<ImpactBarTooltipContent />} />
                    <Bar dataKey="impactoNorm" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {impactItems.map((item, i) => (
                        <Cell key={i} fill={getBarColor(item.impactoNorm)} fillOpacity={0.85} />
                      ))}
                      <LabelList dataKey="impactoNorm" position="right" fontSize={11} className="fill-foreground" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — Impact Simulator (reuse existing component) */}
      <SimuladorImpactoModule
        data={data}
        loading={false}
        error={null}
        onRetry={onRetry}
      />
    </motion.div>
  );
};
