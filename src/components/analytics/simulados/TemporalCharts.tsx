import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TemporalData } from '@/hooks/useSimuladosAnalytics';

interface TemporalChartsProps {
  data: TemporalData;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-1">
          {format(parseISO(label), "dd 'de' MMMM", { locale: ptBR })}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TemporalCharts: React.FC<TemporalChartsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Evolução Temporal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    );
  }

  // Merge inicio and conclusao data
  const allDates = new Set([
    ...data.inicioPorDia.map(d => d.data),
    ...data.conclusaoPorDia.map(d => d.data),
  ]);

  const inicioMap = new Map(data.inicioPorDia.map(d => [d.data, d.count]));
  const conclusaoMap = new Map(data.conclusaoPorDia.map(d => [d.data, d.count]));

  const chartData = Array.from(allDates)
    .sort()
    .map(data => ({
      data,
      inicios: inicioMap.get(data) || 0,
      conclusoes: conclusaoMap.get(data) || 0,
    }));

  if (chartData.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">Sem dados temporais</h3>
          <p className="text-sm text-muted-foreground">
            Não há inícios ou conclusões no período selecionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Evolução Temporal
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Inícios e conclusões de simulados por dia no período selecionado
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInicios" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorConclusoes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="data" 
              tick={{ fontSize: 11 }}
              tickFormatter={(val) => {
                try {
                  return format(parseISO(val), "dd/MM", { locale: ptBR });
                } catch {
                  return val;
                }
              }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '1rem' }}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="inicios"
              name="Inícios"
              stroke="hsl(var(--chart-1))"
              fillOpacity={1}
              fill="url(#colorInicios)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="conclusoes"
              name="Conclusões"
              stroke="hsl(var(--chart-2))"
              fillOpacity={1}
              fill="url(#colorConclusoes)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Mini insights */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total no período</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">
                {data.inicioPorDia.reduce((acc, d) => acc + d.count, 0)}
              </span>
              <span className="text-xs text-muted-foreground">inícios</span>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total no período</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">
                {data.conclusaoPorDia.reduce((acc, d) => acc + d.count, 0)}
              </span>
              <span className="text-xs text-muted-foreground">conclusões</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
