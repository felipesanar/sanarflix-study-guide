import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import type { FaixaDistribuicao } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  faixas: FaixaDistribuicao[];
}

export const FaixaDistribuicaoChart: React.FC<Props> = ({ faixas }) => {
  const sorted = [...faixas].sort((a, b) => b.quantidade - a.quantidade);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Distribuição por Faixa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="faixa"
                  width={100}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} alunos`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                />
                <Bar dataKey="quantidade" radius={[0, 6, 6, 0]} barSize={24}>
                  {sorted.map((f) => (
                    <Cell key={f.faixa} fill={f.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {sorted.map((f) => (
              <div key={f.faixa} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.cor }} />
                <span>{f.faixa}: {f.quantidade} ({f.percentual}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
