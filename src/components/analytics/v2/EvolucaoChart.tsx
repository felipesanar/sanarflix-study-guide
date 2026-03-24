import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { EvolucaoSimulado } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  evolucao: EvolucaoSimulado[];
}

export const EvolucaoChart: React.FC<Props> = ({ evolucao }) => {
  const [metric, setMetric] = useState<'proficiencia' | 'nota'>('proficiencia');

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Evolução entre Simulados</CardTitle>
            <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
              {(['proficiencia', 'nota'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    'text-[11px] font-medium px-2.5 py-1 rounded-md transition-all',
                    metric === m
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'proficiencia' ? 'Proficiência' : 'Nota'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis
                  dataKey="simulado"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  width={32}
                  axisLine={false}
                  tickLine={false}
                  domain={metric === 'nota' ? [0, 5] : ['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, metric === 'nota' ? 'Nota' : 'Proficiência']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
