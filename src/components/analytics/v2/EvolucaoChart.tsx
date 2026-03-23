import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EvolucaoSimulado } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  evolucao: EvolucaoSimulado[];
}

export const EvolucaoChart: React.FC<Props> = ({ evolucao }) => {
  const [activeTab, setActiveTab] = useState('proficiencia');

  const dataKey = activeTab === 'nota' ? 'nota' : 'proficiencia';
  const label = activeTab === 'nota' ? 'Nota' : 'Proficiência';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Evolução entre Simulados</CardTitle>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="proficiencia" className="text-xs px-3 h-6">Proficiência</TabsTrigger>
                <TabsTrigger value="nota" className="text-xs px-3 h-6">Nota</TabsTrigger>
                <TabsTrigger value="distribuicao" className="text-xs px-3 h-6" disabled>Distribuição por Faixa</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="simulado" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  domain={activeTab === 'nota' ? [0, 5] : ['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, label]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
