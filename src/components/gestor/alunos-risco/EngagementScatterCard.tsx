import * as React from 'react';
import { ArrowRight, TrendingUp, Activity } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import type { EngagementScatterPoint } from './useAlunosRisco';
import type { StudentGrowthEntry } from '@/services/institutional';
import { TRI_PROFICIENCY_THRESHOLD } from './useAlunosRisco';

interface EngagementScatterCardProps {
  data: EngagementScatterPoint[];
  loading: boolean;
  hasEngagementSource: boolean;
  casoDeVirada: StudentGrowthEntry | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ScatterTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as EngagementScatterPoint;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-semibold text-sm">{d.nome}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span className="text-muted-foreground">Horas no período</span>
        <span className="font-medium text-right font-mono">{d.horas.toFixed(1)}h</span>
        <span className="text-muted-foreground">TRI</span>
        <span className="font-medium text-right font-mono">{d.tri.toFixed(0)}</span>
      </div>
    </div>
  );
};

function dotColor(tri: number): string {
  return tri >= TRI_PROFICIENCY_THRESHOLD ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))';
}

/**
 * Card "Engajamento × proficiência" — cruza horas de consumo (RPC
 * `get_institutional_student_engagement`) com TRI do aluno (join por
 * user_id/nome com `allStudents`). Quando não há dados de engajamento no
 * período (tabela nova/rala), mostra estado vazio elegante em vez de
 * inventar dado. O box "caso de virada" só aparece quando há um aluno com
 * delta de score positivo real (`get_student_growth_tri`).
 */
export const EngagementScatterCard: React.FC<EngagementScatterCardProps> = ({
  data,
  loading,
  hasEngagementSource,
  casoDeVirada,
}) => {
  const maxHoras = Math.max(10, ...data.map((d) => d.horas)) * 1.1;

  return (
    <GestorPanel
      title="Engajamento × proficiência"
      subtitle="Horas de estudo no período vs. TRI do aluno"
      className="h-full"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center">
            <Activity className="h-5 w-5 animate-pulse text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center px-6">
            <div className="mb-3 rounded-full bg-muted/60 p-3">
              <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              {hasEngagementSource ? 'Sem alunos com TRI e engajamento cruzados' : 'Ainda não há sessões registradas no período'}
            </h4>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {hasEngagementSource
                ? 'Os alunos com dados de consumo ainda não têm score TRI neste simulado, ou vice-versa.'
                : 'Assim que os alunos começarem a estudar na plataforma, o cruzamento entre horas de consumo e proficiência aparecerá aqui.'}
            </p>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  type="number"
                  dataKey="horas"
                  name="Horas"
                  unit="h"
                  domain={[0, maxHoras]}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  label={{ value: 'Horas no período', position: 'bottom', offset: 0, fontSize: 11, className: 'fill-muted-foreground' }}
                />
                <YAxis
                  type="number"
                  dataKey="tri"
                  name="TRI"
                  domain={['dataMin - 20', 'dataMax + 20']}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  label={{ value: 'TRI', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, className: 'fill-muted-foreground' }}
                />
                <ReferenceLine
                  y={TRI_PROFICIENCY_THRESHOLD}
                  stroke="hsl(var(--chart-1))"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: 'proficiência', position: 'right', fontSize: 10, className: 'fill-muted-foreground' }}
                />
                <RechartsTooltip content={<ScatterTooltipContent />} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((point, i) => (
                    <Cell key={i} fill={dotColor(point.tri)} fillOpacity={0.8} r={5} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {casoDeVirada && (
          <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] to-emerald-500/[0.02] p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Caso de virada</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground">
                  <MetricValue size="sm">{Math.round(casoDeVirada.first_score_enamed ?? 0)}</MetricValue>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <MetricValue size="sm" className="text-emerald-600 dark:text-emerald-400">
                    {Math.round(casoDeVirada.last_score_enamed ?? 0)}
                  </MetricValue>
                  <span className="text-xs text-muted-foreground">
                    (+{Math.round(casoDeVirada.delta_score_enamed ?? 0)} pts em {casoDeVirada.num_simulados} simulados)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GestorPanel>
  );
};
