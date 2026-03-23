import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FaixaDistribuicao } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  faixas: FaixaDistribuicao[];
}

export const FaixaDistribuicaoChart: React.FC<Props> = ({ faixas }) => {
  const sorted = [...faixas].sort((a, b) => b.quantidade - a.quantidade);
  const maxIndex = 0;
  const minIndex = Math.max(0, sorted.length - 1);

  const getExtremeFill = (_faixa: string, kind: 'max' | 'min') => {
    return kind === 'max' ? 'hsl(0 72% 40%)' : 'hsl(0 72% 46%)';
  };

  const getFill = (index: number) => {
    if (index === maxIndex) return getExtremeFill(sorted[index].faixa, 'max');
    if (index === minIndex) return getExtremeFill(sorted[index].faixa, 'min');
    // Barras do meio em cinza mais escuro
    return 'hsl(var(--muted-foreground))';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Distribuição por Faixa de Proficiência</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  type="category"
                  dataKey="faixa"
                  width={100}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} alunos (${props.payload.percentual}%)`,
                    'Quantidade',
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="quantidade" radius={[0, 6, 6, 0]} barSize={28}>
                  {sorted.map((f, i) => (
                    <Cell key={f.faixa} fill={getFill(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {sorted.map((f, i) => (
              <div key={f.faixa} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: getFill(i) }} />
                <span>{f.faixa}: {f.quantidade} ({f.percentual}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
