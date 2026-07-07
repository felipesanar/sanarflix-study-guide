import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { GestorPanel } from '@/experiences/gestor/ui';
import type { IesComparisonEntry } from '@/services/gestor/iesComparison';
import { pcpBarColor } from './conceitoColor';

interface IesComparisonBarChartProps {
  entries: IesComparisonEntry[];
}

const META_PROFICIENTES = 60;

/**
 * BarChart "% de proficientes por IES" com linha de meta tracejada em 60%
 * ("meta · conceito 3") e barras coloridas por faixa (≥60 emerald, ≥40 amber,
 * <40 red) — sem narrativa de rede, apenas o comparativo bruto.
 */
export const IesComparisonBarChart: React.FC<IesComparisonBarChartProps> = ({ entries }) => {
  const chartData = entries.map((e) => ({
    nome: e.ies_nome,
    pcp: e.pcp ?? 0,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
      <GestorPanel
        title="% de proficientes por IES"
        subtitle="Meta institucional: conceito 3 (60% de proficientes)"
        icon={BarChart3}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={chartData.length > 4 ? -20 : 0}
                textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                height={chartData.length > 4 ? 48 : 24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={36}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${Math.round(value)}%`, '% Proficientes']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                }}
              />
              <ReferenceLine
                y={META_PROFICIENTES}
                stroke="hsl(var(--foreground) / 0.4)"
                strokeDasharray="4 4"
                label={{
                  value: 'meta · conceito 3',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <Bar dataKey="pcp" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((d) => (
                  <Cell key={d.nome} fill={pcpBarColor(d.pcp)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GestorPanel>
    </motion.div>
  );
};
