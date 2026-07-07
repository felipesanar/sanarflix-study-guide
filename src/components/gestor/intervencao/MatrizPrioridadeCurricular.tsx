import * as React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Crosshair } from 'lucide-react';
import { GestorPanel } from '@/experiences/gestor/ui';
import { scatterColorFromStatus, type TemaPrioridade } from './priorizacao';

interface MatrizPrioridadeCurricularProps {
  temas: TemaPrioridade[];
}

const ALTO_IMPACTO_ACERTO_MAX = 50;
const ALTO_IMPACTO_PREVALENCIA_MIN = 5;

interface TooltipPayload {
  payload: TemaPrioridade;
}

const ScatterTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-semibold text-sm text-foreground">{d.tema}</p>
      <p className="text-muted-foreground">{d.area} · {d.especialidade}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span className="text-muted-foreground">Prevalência</span>
        <span className="font-mono tabular-nums text-right text-foreground">{d.prevalencia.toFixed(1)}%</span>
        <span className="text-muted-foreground">% acerto</span>
        <span className="font-mono tabular-nums text-right text-foreground">{d.acerto.toFixed(1)}%</span>
        <span className="text-muted-foreground">Questões</span>
        <span className="font-mono tabular-nums text-right text-foreground">{d.questoes}</span>
      </div>
    </div>
  );
};

/**
 * Matriz de prioridade curricular — cruza prevalência do tema no exame (X)
 * com % de acerto da turma (Y); tamanho do ponto = nº de questões do tema.
 * Zona sombreada "ALTO IMPACTO" marca temas com prevalência relevante e
 * acerto abaixo de 50% — candidatos a intervenção imediata.
 */
export const MatrizPrioridadeCurricular: React.FC<MatrizPrioridadeCurricularProps> = ({ temas }) => {
  const maxPrevalencia = React.useMemo(
    () => Math.max(10, ...temas.map((t) => t.prevalencia)) * 1.15,
    [temas],
  );
  const questoesRange = React.useMemo(() => {
    const values = temas.map((t) => t.questoes);
    return { min: Math.min(...values, 1), max: Math.max(...values, 1) };
  }, [temas]);

  return (
    <GestorPanel
      className="col-span-full"
      title="Matriz de prioridade curricular"
      subtitle="Prevalência no exame × % de acerto da turma — tamanho do ponto = nº de questões"
      icon={Crosshair}
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
            <XAxis
              type="number"
              dataKey="prevalencia"
              name="Prevalência"
              unit="%"
              domain={[0, maxPrevalencia]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Prevalência no exame (%)',
                position: 'bottom',
                offset: 0,
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            <YAxis
              type="number"
              dataKey="acerto"
              name="% acerto"
              unit="%"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              label={{
                value: '% acerto da turma',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fontSize: 11,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            <ZAxis
              type="number"
              dataKey="questoes"
              range={[60, 400]}
              domain={[questoesRange.min, questoesRange.max]}
            />
            <ReferenceArea
              x1={ALTO_IMPACTO_PREVALENCIA_MIN}
              x2={maxPrevalencia}
              y1={0}
              y2={ALTO_IMPACTO_ACERTO_MAX}
              fill="hsl(var(--destructive))"
              fillOpacity={0.07}
              strokeOpacity={0}
              label={{
                value: 'ALTO IMPACTO · intervir já',
                position: 'insideTopRight',
                fontSize: 10,
                fontWeight: 600,
                fill: 'hsl(var(--destructive))',
              }}
            />
            <ReferenceLine
              y={50}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: '50%', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={temas} isAnimationActive={false}>
              {temas.map((t) => (
                <Cell key={t.id} fill={scatterColorFromStatus(t.status)} fillOpacity={0.75} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-1 justify-center text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--destructive))' }} />
          Crítico (&lt;50%)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
          Próximo (50-60%)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
          Proficiente (≥60%)
        </div>
      </div>
    </GestorPanel>
  );
};
