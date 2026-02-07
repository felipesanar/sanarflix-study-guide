import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  Cell, LabelList
} from 'recharts';
import { Building2, GraduationCap, Layers, BookOpen, Target, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  SegmentacaoIES, 
  SegmentacaoSemestre, 
  SegmentacaoDimensao 
} from '@/hooks/useSimuladosAnalytics';

interface SegmentacaoChartsProps {
  byIES: SegmentacaoIES[];
  bySemestre: SegmentacaoSemestre[];
  byArea: SegmentacaoDimensao[];
  byEspecialidade: SegmentacaoDimensao[];
  byTema: SegmentacaoDimensao[];
  byDificuldade: SegmentacaoDimensao[];
  isLoading?: boolean;
}

const MIN_SAMPLE_SIZE = 30;

const getBarColor = (acuracia: number): string => {
  if (acuracia >= 70) return 'hsl(var(--chart-1))';
  if (acuracia >= 50) return 'hsl(var(--chart-3))';
  return 'hsl(var(--chart-5))';
};

const DimensaoList: React.FC<{
  data: SegmentacaoDimensao[];
  title: string;
  icon: React.ReactNode;
}> = ({ data, title, icon }) => {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Sem dados para exibir</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.acuracia - b.acuracia);

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-1">
        {sorted.map((item) => {
          const lowSample = item.n_respostas < MIN_SAMPLE_SIZE;
          return (
            <TooltipProvider key={item.nome}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "p-3 rounded-lg border transition-all hover:bg-muted/50",
                    lowSample && "opacity-70"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "font-medium text-sm truncate max-w-[200px]",
                        lowSample && "text-muted-foreground"
                      )}>
                        {item.nome}
                      </span>
                      <div className="flex items-center gap-2">
                        {lowSample && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Info className="w-3 h-3" />
                            n={item.n_respostas}
                          </Badge>
                        )}
                        <Badge 
                          variant={
                            item.acuracia >= 70 ? 'default' :
                            item.acuracia >= 50 ? 'secondary' : 'destructive'
                          }
                          className="font-mono"
                        >
                          {item.acuracia}%
                        </Badge>
                      </div>
                    </div>
                    <Progress 
                      value={item.acuracia} 
                      className={cn("h-1.5", lowSample && "opacity-50")}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p><strong>{item.nome}</strong></p>
                  <p>Acurácia: {item.acuracia}%</p>
                  <p>Respostas: {item.n_respostas.toLocaleString('pt-BR')}</p>
                  {lowSample && (
                    <p className="text-yellow-500 text-xs mt-1">
                      ⚠️ Amostra pequena ({'<'}{MIN_SAMPLE_SIZE})
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </ScrollArea>
  );
};

const IESBarChart: React.FC<{ data: SegmentacaoIES[] }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Sem dados de IES para exibir</p>
      </div>
    );
  }

  const chartData = data
    .slice(0, 10)
    .map(d => ({
      ...d,
      name: d.ies_nome.length > 15 ? d.ies_nome.slice(0, 15) + '...' : d.ies_nome,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis 
          type="category" 
          dataKey="name" 
          width={120}
          tick={{ fontSize: 12 }}
        />
        <Bar dataKey="acuracia" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.acuracia)} />
          ))}
          <LabelList 
            dataKey="acuracia" 
            position="right" 
            formatter={(v: number) => `${v}%`}
            className="text-xs fill-foreground"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const SegmentacaoCharts: React.FC<SegmentacaoChartsProps> = ({
  byIES,
  bySemestre,
  byArea,
  byEspecialidade,
  byTema,
  byDificuldade,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState('ies');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Segmento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Desempenho Segmentado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-4">
            <TabsTrigger value="ies" className="gap-1 text-xs">
              <Building2 className="w-3 h-3 hidden sm:block" />
              IES
            </TabsTrigger>
            <TabsTrigger value="semestre" className="gap-1 text-xs">
              <GraduationCap className="w-3 h-3 hidden sm:block" />
              Semestre
            </TabsTrigger>
            <TabsTrigger value="area" className="gap-1 text-xs">
              <Target className="w-3 h-3 hidden sm:block" />
              Área
            </TabsTrigger>
            <TabsTrigger value="especialidade" className="gap-1 text-xs">
              <BookOpen className="w-3 h-3 hidden sm:block" />
              Espec.
            </TabsTrigger>
            <TabsTrigger value="tema" className="gap-1 text-xs">
              <Layers className="w-3 h-3 hidden sm:block" />
              Tema
            </TabsTrigger>
            <TabsTrigger value="dificuldade" className="gap-1 text-xs">
              <Target className="w-3 h-3 hidden sm:block" />
              Dific.
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ies">
            <IESBarChart data={byIES} />
            <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <strong>Interpretação:</strong> Comparativo de acurácia média por instituição. 
              Verde (≥70%), amarelo (50-69%), vermelho ({'<'}50%).
            </div>
          </TabsContent>

          <TabsContent value="semestre">
            <DimensaoList 
              data={bySemestre.map(s => ({ 
                nome: s.semestre, 
                acuracia: s.acuracia, 
                n_respostas: s.n_respostas 
              }))}
              title="Semestre"
              icon={<GraduationCap className="w-4 h-4" />}
            />
          </TabsContent>

          <TabsContent value="area">
            <DimensaoList 
              data={byArea}
              title="Grande Área"
              icon={<Target className="w-4 h-4" />}
            />
          </TabsContent>

          <TabsContent value="especialidade">
            <DimensaoList 
              data={byEspecialidade}
              title="Especialidade"
              icon={<BookOpen className="w-4 h-4" />}
            />
          </TabsContent>

          <TabsContent value="tema">
            <DimensaoList 
              data={byTema}
              title="Tema"
              icon={<Layers className="w-4 h-4" />}
            />
          </TabsContent>

          <TabsContent value="dificuldade">
            <DimensaoList 
              data={byDificuldade}
              title="Dificuldade"
              icon={<Target className="w-4 h-4" />}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
